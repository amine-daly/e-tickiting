package com.eticketing.app.ticket;

import com.eticketing.app.common.TargetInput;
import com.eticketing.app.currency.CurrencyRepository;
import com.eticketing.app.currency.CurrencyType;
import com.eticketing.app.trip.*;
import com.eticketing.app.web.error.ApiExceptions.BadRequestException;
import com.eticketing.app.web.error.ApiExceptions.ConflictException;
import com.eticketing.app.web.error.ApiExceptions.NotFoundException;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Booking orchestrator — TRIP_SPEC section 10.
 * <p>
 * 7-step flow: resolve segments → check express fare → calculate price → atomic
 * CAS reserve → create PENDING ticket → rollback on failure → return ticket.
 */
@Service
@RequiredArgsConstructor
public class BookingService {

    private static final Logger LOG = LoggerFactory.getLogger(BookingService.class);

    private final TripTypeRepository tripRepository;
    private final TicketRepository ticketRepository;
    private final SeatReservationService seatReservationService;
    private final CurrencyRepository currencyRepository;

    // ════════════════════════════════════════════════════════════════════
    // CREATE BOOKING
    // ════════════════════════════════════════════════════════════════════
    /**
     * Creates a new booking (PENDING ticket) per TRIP_SPEC section 10.
     *
     * @param tripId the trip to book
     * @param fromPlaceId journey origin
     * @param toPlaceId journey destination
     * @param pickupPointId where passenger boards
     * @param dropoffPointId where passenger alights
     * @param passengerId passenger identifier
     * @param idempotencyKey exactly-once key
     * @param companyId company from auth context
     * @param posId POS from auth context (nullable)
     * @return the created ticket
     */
    public TicketType createBooking(String tripId, String fromPlaceId, String toPlaceId,
            String pickupPointId, String dropoffPointId,
            String passengerId, String idempotencyKey,
            String companyId, String posId) {

        // ── 0. Idempotency check ───────────────────────────────────────
        Optional<TicketType> existing = ticketRepository.findByIdempotencyKey(idempotencyKey);
        if (existing.isPresent()) {
            LOG.info("TICKET_IDEMPOTENCY_REPLAY: key={} returning existing ticket={}", idempotencyKey, existing.get().getId());
            return existing.get();
        }

        // ── 1. Load trip & validate status ──────────────────────────────
        TripType trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new NotFoundException("Trip not found: " + tripId));

        if (trip.getStatus() != TripStatusEnum.ACTIVE) {
            throw new BadRequestException("TRIP_NOT_ACTIVE: booking is only allowed on ACTIVE trips");
        }

        // ── 2. Resolve segment chain ────────────────────────────────────
        List<String> segmentIds = resolveSegmentChain(trip.getSegments(), fromPlaceId, toPlaceId);
        if (segmentIds.isEmpty()) {
            throw new BadRequestException("NO_SEGMENT_CHAIN: no continuous segment path from " + fromPlaceId + " to " + toPlaceId);
        }

        // ── 3. Check express fare match ─────────────────────────────────
        BigDecimal appliedPrice;
        String expressId = null;

        Optional<ExpressFareType> matchingFare = findMatchingExpressFare(trip.getExpressFares(), segmentIds);
        if (matchingFare.isPresent()) {
            ExpressFareType fare = matchingFare.get();
            appliedPrice = fare.getPrice();
            expressId = fare.getExpressId();
        } else {
            // Sum base prices of individual segments
            appliedPrice = calculateSegmentSum(trip.getSegments(), segmentIds);
        }

        // ── 4. Validate pickup/dropoff ──────────────────────────────────
        validatePickupPoint(trip, pickupPointId, fromPlaceId);
        validateDropoffPoint(trip, dropoffPointId, toPlaceId);

        // ── 5. Atomic CAS reserve ───────────────────────────────────────
        boolean reserved = seatReservationService.reserveSeats(tripId, segmentIds);
        if (!reserved) {
            throw new ConflictException("SEGMENT_CAPACITY_EXCEEDED: no seats available on one or more segments");
        }

        // ── 6. Create PENDING ticket ────────────────────────────────────
        try {
            Instant now = Instant.now();
            Instant expiresAt = now.plusSeconds((long) trip.getSeatHoldMinutes() * 60);
            String ticketCurrency = resolveTicketCurrency(trip);

            TicketType ticket = TicketType.builder()
                    .tripId(tripId)
                    .target(new TargetInput(companyId, posId))
                    .segmentIds(new ArrayList<>(segmentIds))
                    .expressId(expressId)
                    .pickupPointId(pickupPointId)
                    .dropoffPointId(dropoffPointId)
                    .passengerId(passengerId)
                    .appliedPrice(appliedPrice)
                    .currency(ticketCurrency)
                    .status(TicketStatusEnum.PENDING)
                    .idempotencyKey(idempotencyKey)
                    .expiresAt(expiresAt)
                    .build();

            return ticketRepository.save(ticket);
        } catch (Exception e) {
            // ── 7. Rollback CAS on DB error ─────────────────────────────
            LOG.error("Ticket creation failed, rolling back seat reservation for trip={}", tripId, e);
            seatReservationService.releaseSeats(tripId, segmentIds);
            throw e;
        }
    }

    // ════════════════════════════════════════════════════════════════════
    // CONFIRM BOOKING (US-8.5)
    // ════════════════════════════════════════════════════════════════════
    public TicketType confirmBooking(String ticketId) {
        TicketType ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new NotFoundException("Ticket not found: " + ticketId));

        if (ticket.getStatus() == TicketStatusEnum.EXPIRED) {
            throw new ConflictException("TICKET_EXPIRED: cannot confirm an expired ticket — seats already released");
        }
        if (ticket.getStatus() != TicketStatusEnum.PENDING) {
            throw new ConflictException("INVALID_TICKET_TRANSITION: ticket is " + ticket.getStatus() + ", expected PENDING");
        }

        ticket.setStatus(TicketStatusEnum.CONFIRMED);
        ticket.setConfirmedAt(Instant.now());
        return ticketRepository.save(ticket);
    }

    private String resolveTicketCurrency(TripType trip) {
        String currencyId = trip.getCurrency() != null ? trip.getCurrency().getCurrencyId() : null;
        if (currencyId == null || currencyId.isBlank()) {
            throw new NotFoundException("Trip currency reference is missing for trip: " + trip.getId());
        }

        CurrencyType currency = currencyRepository.findById(currencyId)
                .orElseThrow(() -> new NotFoundException("Currency not found: " + currencyId));

        return currency.getCode();
    }

    // ════════════════════════════════════════════════════════════════════
    // CANCEL BOOKING (US-8.6)
    // ════════════════════════════════════════════════════════════════════
    /**
     * Cancels a CONFIRMED ticket. Creates a Refund record with status
     * REQUESTED. Seats are NOT released here — that happens on Refund APPROVED
     * (Sprint 9).
     *
     * @return the cancelled ticket
     */
    public TicketType cancelBooking(String ticketId, RefundRepository refundRepository) {
        TicketType ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new NotFoundException("Ticket not found: " + ticketId));

        if (ticket.getStatus() != TicketStatusEnum.CONFIRMED) {
            throw new ConflictException("INVALID_TICKET_TRANSITION: only CONFIRMED tickets can be cancelled, current=" + ticket.getStatus());
        }

        ticket.setStatus(TicketStatusEnum.CANCELLED);
        ticket.setCancelledAt(Instant.now());
        TicketType saved = ticketRepository.save(ticket);

        // Create refund record
        RefundType refund = RefundType.builder()
                .ticketId(ticketId)
                .segmentsRefunded(new ArrayList<>(ticket.getSegmentIds()))
                .amount(ticket.getAppliedPrice())
                .currency(ticket.getCurrency())
                .status(RefundStatusEnum.REQUESTED)
                .build();
        refundRepository.save(refund);

        LOG.info("Ticket {} cancelled. Refund created for amount={} {}", ticketId, ticket.getAppliedPrice(), ticket.getCurrency());
        return saved;
    }

    // ════════════════════════════════════════════════════════════════════
    // SEGMENT CHAIN RESOLUTION
    // ════════════════════════════════════════════════════════════════════
    /**
     * Finds the continuous chain of segment IDs from {@code fromPlaceId} to
     * {@code toPlaceId}. Segments must be in sequence order and consecutive.
     */
    List<String> resolveSegmentChain(List<SegmentType> segments, String fromPlaceId, String toPlaceId) {
        // Sort by sequence
        List<SegmentType> sorted = segments.stream()
                .sorted(Comparator.comparingInt(SegmentType::getSequence))
                .toList();

        // Find the starting segment
        int startIdx = -1;
        for (int i = 0; i < sorted.size(); i++) {
            if (sorted.get(i).getFromPlaceId().equals(fromPlaceId)) {
                startIdx = i;
                break;
            }
        }
        if (startIdx == -1) {
            return List.of();
        }

        // Collect consecutive segments until toPlaceId
        List<String> chain = new ArrayList<>();
        for (int i = startIdx; i < sorted.size(); i++) {
            chain.add(sorted.get(i).getSegmentId());
            if (sorted.get(i).getToPlaceId().equals(toPlaceId)) {
                return chain;
            }
        }

        // toPlaceId not reached
        return List.of();
    }

    /**
     * Finds an active express fare that exactly covers the given segment chain.
     */
    Optional<ExpressFareType> findMatchingExpressFare(List<ExpressFareType> expressFares, List<String> segmentIds) {
        if (expressFares == null) {
            return Optional.empty();
        }
        Instant now = Instant.now();
        return expressFares.stream()
                .filter(ExpressFareType::isActive)
                .filter(f -> f.getValidFrom() == null || !now.isBefore(f.getValidFrom()))
                .filter(f -> f.getValidUntil() == null || !now.isAfter(f.getValidUntil()))
                .filter(f -> f.getSegmentsCovered().equals(segmentIds))
                .findFirst();
    }

    /**
     * Sums basePrice of the segments in the chain.
     */
    BigDecimal calculateSegmentSum(List<SegmentType> allSegments, List<String> segmentIds) {
        return allSegments.stream()
                .filter(s -> segmentIds.contains(s.getSegmentId()))
                .map(SegmentType::getBasePrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    // ════════════════════════════════════════════════════════════════════
    // PICKUP / DROPOFF VALIDATION
    // ════════════════════════════════════════════════════════════════════
    private void validatePickupPoint(TripType trip, String pickupPointId, String fromPlaceId) {
        PickupPointType pp = trip.getPickupPoints().stream()
                .filter(p -> p.getPointId().equals(pickupPointId))
                .findFirst()
                .orElseThrow(() -> new BadRequestException("INVALID_PICKUP_POINT: pickup point not found: " + pickupPointId));

        if (!pp.isActive()) {
            throw new BadRequestException("INACTIVE_PICKUP_POINT: pickup point is inactive: " + pickupPointId);
        }
        if (!pp.getPlaceId().equals(fromPlaceId)) {
            throw new BadRequestException("PICKUP_PLACE_MISMATCH: pickup point placeId does not match fromPlaceId");
        }
    }

    private void validateDropoffPoint(TripType trip, String dropoffPointId, String toPlaceId) {
        DropoffPointType dp = trip.getDropoffPoints().stream()
                .filter(d -> d.getPointId().equals(dropoffPointId))
                .findFirst()
                .orElseThrow(() -> new BadRequestException("INVALID_DROPOFF_POINT: dropoff point not found: " + dropoffPointId));

        if (!dp.isActive()) {
            throw new BadRequestException("INACTIVE_DROPOFF_POINT: dropoff point is inactive: " + dropoffPointId);
        }
        if (!dp.getPlaceId().equals(toPlaceId)) {
            throw new BadRequestException("DROPOFF_PLACE_MISMATCH: dropoff point placeId does not match toPlaceId");
        }
    }
}
