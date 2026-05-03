package com.eticketing.app.ticket;

import com.eticketing.app.bus.BusService;
import com.eticketing.app.bus.BusType;
import com.eticketing.app.trip.ExpressSegmentType;
import com.eticketing.app.trip.SegmentType;
import com.eticketing.app.trip.TripInventoryAvailabilityCalculator;
import com.eticketing.app.trip.TripType;
import com.eticketing.app.trip.TripTypeRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Atomic seat reservation on trip inventory using optimistic CAS on the trip
 * document version. Local bookings increment segment.bookedCount, while express
 * bookings increment expressSegment.bookedCount and derive physical
 * availability from bus.totalSeats.
 */
@Service
@RequiredArgsConstructor
public class SeatReservationService {

    private static final Logger LOG = LoggerFactory.getLogger(SeatReservationService.class);
    private static final int MAX_CAS_RETRIES = 5;

    private final TripTypeRepository tripRepository;
    private final BusService busService;

    public boolean reserveSeats(String tripId, List<String> segmentIds) {
        return reserveSeats(tripId, segmentIds, null, 1);
    }

    public boolean reserveSeats(String tripId, List<String> segmentIds, int count) {
        return reserveSeats(tripId, segmentIds, null, count);
    }

    public boolean reserveSeats(String tripId, List<String> segmentIds, String expressSegmentId) {
        return reserveSeats(tripId, segmentIds, expressSegmentId, 1);
    }

    public boolean reserveSeats(String tripId, List<String> segmentIds, String expressSegmentId, int count) {
        validateCount(count);
        List<String> normalizedSegmentIds = normalizeSegmentIds(segmentIds);
        if (normalizedSegmentIds.isEmpty()) {
            return true;
        }

        boolean expressReservation = isExpressReservation(expressSegmentId);
        for (int attempt = 1; attempt <= MAX_CAS_RETRIES; attempt++) {
            TripType trip = tripRepository.findById(tripId).orElse(null);
            if (trip == null) {
                LOG.warn("Seat reservation failed: trip {} not found", tripId);
                return false;
            }

            List<SegmentType> requestedSegments = resolveSegments(trip, normalizedSegmentIds);
            if (requestedSegments == null) {
                return false;
            }

            ExpressSegmentType expressSegment = resolveExpressSegment(trip, expressSegmentId, normalizedSegmentIds);
            if (expressReservation && expressSegment == null) {
                return false;
            }

            int busTotalSeats = resolveBusTotalSeats(trip);
            if (busTotalSeats < 0) {
                return false;
            }

            Map<String, Integer> expressBookedBySegmentId = TripInventoryAvailabilityCalculator.buildExpressBookedBySegmentId(
                    trip,
                    normalizedSegmentIds);
            int availableSeats = expressReservation
                    ? TripInventoryAvailabilityCalculator.computeExpressAvailability(
                            requestedSegments,
                            expressBookedBySegmentId,
                            busTotalSeats)
                    : TripInventoryAvailabilityCalculator.computeLocalAvailability(
                            requestedSegments,
                            expressBookedBySegmentId,
                            busTotalSeats);

            if (availableSeats < count) {
                LOG.warn("SEGMENT_CAPACITY_EXCEEDED: trip={} expressSegmentId={} requested={} available={} segments={}",
                        tripId, expressSegmentId, count, availableSeats, normalizedSegmentIds);
                return false;
            }

            if (expressReservation) {
                expressSegment.setBookedCount(expressSegment.getBookedCount() + count);
            } else {
                requestedSegments.forEach(segment -> segment.setBookedCount(segment.getBookedCount() + count));
            }

            try {
                tripRepository.save(trip);
                return true;
            } catch (OptimisticLockingFailureException ex) {
                LOG.debug("Seat reservation CAS retry {}/{} for trip={} expressSegmentId={} segments={}",
                        attempt, MAX_CAS_RETRIES, tripId, expressSegmentId, normalizedSegmentIds);
            }
        }

        LOG.warn("Seat reservation CAS retries exhausted for trip={} expressSegmentId={} count={} segments={}",
                tripId, expressSegmentId, count, normalizedSegmentIds);
        return false;
    }

    public void releaseSeats(String tripId, List<String> segmentIds) {
        releaseSeats(tripId, segmentIds, null, 1);
    }

    public void releaseSeats(String tripId, List<String> segmentIds, int count) {
        releaseSeats(tripId, segmentIds, null, count);
    }

    public void releaseSeats(String tripId, List<String> segmentIds, String expressSegmentId) {
        releaseSeats(tripId, segmentIds, expressSegmentId, 1);
    }

    public void releaseSeats(String tripId, List<String> segmentIds, String expressSegmentId, int count) {
        validateCount(count);
        List<String> normalizedSegmentIds = normalizeSegmentIds(segmentIds);
        if (normalizedSegmentIds.isEmpty()) {
            return;
        }

        boolean expressReservation = isExpressReservation(expressSegmentId);
        for (int attempt = 1; attempt <= MAX_CAS_RETRIES; attempt++) {
            TripType trip = tripRepository.findById(tripId).orElse(null);
            if (trip == null) {
                LOG.error("Seat release failed: trip {} not found", tripId);
                return;
            }

            if (expressReservation) {
                ExpressSegmentType expressSegment = resolveExpressSegment(trip, expressSegmentId, normalizedSegmentIds);
                if (expressSegment == null) {
                    return;
                }
                if (expressSegment.getBookedCount() < count) {
                    LOG.error("Seat release failed for trip={} expressSegmentId={} count={} — express bookedCount is only {}",
                            tripId, expressSegmentId, count, expressSegment.getBookedCount());
                    return;
                }
                expressSegment.setBookedCount(expressSegment.getBookedCount() - count);
            } else {
                List<SegmentType> requestedSegments = resolveSegments(trip, normalizedSegmentIds);
                if (requestedSegments == null) {
                    return;
                }
                if (requestedSegments.stream().anyMatch(segment -> segment.getBookedCount() < count)) {
                    LOG.error("Seat release failed for trip={} count={} segments={} — local bookedCount is insufficient",
                            tripId, count, normalizedSegmentIds);
                    return;
                }
                requestedSegments.forEach(segment -> segment.setBookedCount(segment.getBookedCount() - count));
            }

            try {
                tripRepository.save(trip);
                return;
            } catch (OptimisticLockingFailureException ex) {
                LOG.debug("Seat release CAS retry {}/{} for trip={} expressSegmentId={} segments={}",
                        attempt, MAX_CAS_RETRIES, tripId, expressSegmentId, normalizedSegmentIds);
            }
        }

        LOG.error("Seat release CAS retries exhausted for trip={} expressSegmentId={} count={} segments={}",
                tripId, expressSegmentId, count, normalizedSegmentIds);
    }

    public void releaseReservations(String tripId, List<TicketType> tickets) {
        if (tickets == null || tickets.isEmpty()) {
            return;
        }

        Map<ReservationKey, Long> countsByReservation = tickets.stream()
                .filter(ticket -> ticket.getSegmentIds() != null && !ticket.getSegmentIds().isEmpty())
                .collect(Collectors.groupingBy(
                        ticket -> new ReservationKey(ticket.getExpressSegmentId(), List.copyOf(normalizeSegmentIds(ticket.getSegmentIds()))),
                        LinkedHashMap::new,
                        Collectors.counting()));

        countsByReservation.forEach((reservation, ticketCount) -> {
            if (!reservation.segmentIds().isEmpty()) {
                releaseSeats(tripId, reservation.segmentIds(), reservation.expressSegmentId(), Math.toIntExact(ticketCount));
            }
        });
    }

    private List<SegmentType> resolveSegments(TripType trip, List<String> segmentIds) {
        Map<String, SegmentType> segmentsById = trip.getSegments() == null
                ? Map.of()
                : trip.getSegments().stream()
                        .collect(Collectors.toMap(SegmentType::getSegmentId, segment -> segment));

        List<SegmentType> resolvedSegments = segmentIds.stream()
                .map(segmentsById::get)
                .toList();

        if (resolvedSegments.stream().anyMatch(Objects::isNull)) {
            LOG.warn("Inventory mutation failed: trip={} is missing one of the segments {}", trip.getId(), segmentIds);
            return null;
        }

        return resolvedSegments;
    }

    private ExpressSegmentType resolveExpressSegment(TripType trip, String expressSegmentId, List<String> segmentIds) {
        if (!isExpressReservation(expressSegmentId)) {
            return null;
        }
        if (trip.getExpressSegments() == null) {
            LOG.warn("Inventory mutation failed: trip={} has no express segments but expressSegmentId={} was requested",
                    trip.getId(), expressSegmentId);
            return null;
        }

        ExpressSegmentType expressSegment = trip.getExpressSegments().stream()
                .filter(segment -> expressSegmentId.equals(segment.getExpressSegmentId()))
                .findFirst()
                .orElse(null);
        if (expressSegment == null) {
            LOG.warn("Inventory mutation failed: express segment {} not found on trip {}", expressSegmentId, trip.getId());
            return null;
        }
        if (expressSegment.getSegmentsCovered() == null || !segmentIds.equals(expressSegment.getSegmentsCovered())) {
            LOG.warn("Inventory mutation failed: express segment {} does not match requested segment chain {} on trip {}",
                    expressSegmentId, segmentIds, trip.getId());
            return null;
        }
        return expressSegment;
    }

    private int resolveBusTotalSeats(TripType trip) {
        if (trip.getBus() == null || trip.getBus().getBusId() == null || trip.getBus().getBusId().isBlank()) {
            LOG.error("Inventory mutation failed: trip {} has no bus reference", trip.getId());
            return -1;
        }
        try {
            BusType bus = busService.getById(trip.getBus().getBusId());
            return bus.getTotalSeats();
        } catch (RuntimeException ex) {
            LOG.error("Inventory mutation failed: unable to load bus {} for trip {}",
                    trip.getBus().getBusId(), trip.getId(), ex);
            return -1;
        }
    }

    private List<String> normalizeSegmentIds(List<String> segmentIds) {
        if (segmentIds == null) {
            return List.of();
        }
        return segmentIds.stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }

    private boolean isExpressReservation(String expressSegmentId) {
        return expressSegmentId != null && !expressSegmentId.isBlank();
    }

    private void validateCount(int count) {
        if (count <= 0) {
            throw new IllegalArgumentException("count must be greater than 0");
        }
    }

    private record ReservationKey(String expressSegmentId, List<String> segmentIds) {

    }
}
