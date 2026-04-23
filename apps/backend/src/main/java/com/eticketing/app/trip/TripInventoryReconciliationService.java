package com.eticketing.app.trip;

import com.eticketing.app.ticket.TicketRepository;
import com.eticketing.app.ticket.TicketStatusEnum;
import com.eticketing.app.ticket.TicketType;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

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
        for (TripType trip : trips) {
            if (trip.getSegments() == null || trip.getSegments().isEmpty()) {
                continue;
            }

            Map<String, Integer> bookedSeatsBySegmentId = new HashMap<>();
            for (SegmentType segment : trip.getSegments()) {
                bookedSeatsBySegmentId.put(segment.getSegmentId(), 0);
            }

            for (TicketType ticket : ticketsByTripId.getOrDefault(trip.getId(), List.of())) {
                Set<String> uniqueSegmentIds = new HashSet<>(ticket.getSegmentIds());
                for (String segmentId : uniqueSegmentIds) {
                    if (bookedSeatsBySegmentId.containsKey(segmentId)) {
                        bookedSeatsBySegmentId.computeIfPresent(segmentId, (key, count) -> count + 1);
                    }
                }
            }

            boolean changed = false;
            for (SegmentType segment : trip.getSegments()) {
                int reconciledBookedSeats = bookedSeatsBySegmentId.getOrDefault(segment.getSegmentId(), 0);
                if (segment.getBookedSeats() != reconciledBookedSeats) {
                    segment.setBookedSeats(reconciledBookedSeats);
                    changed = true;
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
}
