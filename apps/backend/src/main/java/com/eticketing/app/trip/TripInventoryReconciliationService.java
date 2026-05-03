package com.eticketing.app.trip;

import com.eticketing.app.ticket.TicketRepository;
import com.eticketing.app.ticket.TicketStatusEnum;
import com.eticketing.app.ticket.TicketType;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TripInventoryReconciliationService {

    private static final Logger LOG = LoggerFactory.getLogger(TripInventoryReconciliationService.class);

    private final TripTypeRepository tripRepository;
    private final TicketRepository ticketRepository;

    public int deactivateExpiredExpressSegments() {
        Instant now = Instant.now();
        List<TripType> trips = tripRepository.findByActiveExpressSegmentsExpiredBefore(now);
        if (trips.isEmpty()) {
            return 0;
        }

        List<TripType> dirtyTrips = new ArrayList<>();
        int deactivatedSegments = 0;
        for (TripType trip : trips) {
            int tripDeactivatedSegments = deactivateExpiredExpressSegments(trip, now);
            if (tripDeactivatedSegments <= 0) {
                continue;
            }

            dirtyTrips.add(trip);
            deactivatedSegments += tripDeactivatedSegments;
        }

        if (!dirtyTrips.isEmpty()) {
            tripRepository.saveAll(dirtyTrips);
            LOG.info("TRIP_EXPRESS_SEGMENT_DEACTIVATION: deactivated {} express segments across {} trips",
                    deactivatedSegments, dirtyTrips.size());
        }

        return deactivatedSegments;
    }

    public List<TripType> reconcile(List<TripType> trips) {
        if (trips == null || trips.isEmpty()) {
            return List.of();
        }

        List<String> tripIds = trips.stream()
                .map(TripType::getId)
                .filter(id -> id != null && !id.isBlank())
                .toList();
        if (tripIds.isEmpty()) {
            return trips;
        }

        List<TicketType> activeTickets = ticketRepository.findByTripIdInAndStatusIn(
                tripIds,
                List.of(TicketStatusEnum.PENDING, TicketStatusEnum.CONFIRMED));

        Map<String, List<TicketType>> ticketsByTripId = activeTickets.stream()
                .collect(Collectors.groupingBy(TicketType::getTripId));

        List<TripType> dirtyTrips = new ArrayList<>();
        Instant now = Instant.now();
        for (TripType trip : trips) {
            boolean changed = deactivateExpiredExpressSegments(trip, now) > 0;
            if (trip.getSegments() == null || trip.getSegments().isEmpty()) {
                if (changed) {
                    dirtyTrips.add(trip);
                }
                continue;
            }

            Map<String, Integer> localBookedCountBySegmentId = new HashMap<>();
            for (SegmentType segment : trip.getSegments()) {
                localBookedCountBySegmentId.put(segment.getSegmentId(), 0);
            }

            Map<String, Integer> expressBookedCountByExpressSegmentId = new HashMap<>();
            if (trip.getExpressSegments() != null) {
                for (ExpressSegmentType expressSegment : trip.getExpressSegments()) {
                    expressBookedCountByExpressSegmentId.put(expressSegment.getExpressSegmentId(), 0);
                }
            }

            for (TicketType ticket : ticketsByTripId.getOrDefault(trip.getId(), List.of())) {
                if (ticket.getExpressSegmentId() != null && !ticket.getExpressSegmentId().isBlank()) {
                    if (expressBookedCountByExpressSegmentId.containsKey(ticket.getExpressSegmentId())) {
                        expressBookedCountByExpressSegmentId.computeIfPresent(ticket.getExpressSegmentId(), (key, count) -> count + 1);
                    } else {
                        LOG.warn("TRIP_INVENTORY_RECONCILIATION: express segment {} referenced by ticket {} was not found on trip {}",
                                ticket.getExpressSegmentId(), ticket.getId(), trip.getId());
                    }
                    continue;
                }

                Set<String> uniqueSegmentIds = new HashSet<>(ticket.getSegmentIds());
                for (String segmentId : uniqueSegmentIds) {
                    if (localBookedCountBySegmentId.containsKey(segmentId)) {
                        localBookedCountBySegmentId.computeIfPresent(segmentId, (key, count) -> count + 1);
                    }
                }
            }

            for (SegmentType segment : trip.getSegments()) {
                int reconciledBookedCount = localBookedCountBySegmentId.getOrDefault(segment.getSegmentId(), 0);
                if (segment.getBookedCount() != reconciledBookedCount) {
                    segment.setBookedCount(reconciledBookedCount);
                    changed = true;
                }
            }

            if (trip.getExpressSegments() != null) {
                for (ExpressSegmentType expressSegment : trip.getExpressSegments()) {
                    int reconciledBookedCount = expressBookedCountByExpressSegmentId.getOrDefault(expressSegment.getExpressSegmentId(), 0);
                    if (expressSegment.getBookedCount() != reconciledBookedCount) {
                        expressSegment.setBookedCount(reconciledBookedCount);
                        changed = true;
                    }
                }
            }

            if (changed) {
                dirtyTrips.add(trip);
            }
        }

        if (!dirtyTrips.isEmpty()) {
            tripRepository.saveAll(dirtyTrips);
            LOG.info("TRIP_INVENTORY_RECONCILED: corrected {} trips from active ticket state", dirtyTrips.size());
        }

        return trips;
    }

    private int deactivateExpiredExpressSegments(TripType trip, Instant now) {
        if (trip.getExpressSegments() == null || trip.getExpressSegments().isEmpty()) {
            return 0;
        }

        int deactivatedSegments = 0;
        for (ExpressSegmentType expressSegment : trip.getExpressSegments()) {
            if (!isExpiredActiveExpressSegment(expressSegment, now)) {
                continue;
            }

            expressSegment.setActive(false);
            deactivatedSegments++;
        }

        return deactivatedSegments;
    }

    private boolean isExpiredActiveExpressSegment(ExpressSegmentType expressSegment, Instant now) {
        return expressSegment != null
                && expressSegment.isActive()
                && expressSegment.getValidUntil() != null
                && !expressSegment.getValidUntil().isAfter(now);
    }
}
