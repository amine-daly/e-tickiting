package com.eticketing.app.ticket;

import com.eticketing.app.common.TargetInput;
import com.eticketing.app.currency.CurrencyRepository;
import com.eticketing.app.currency.CurrencyType;
import com.eticketing.app.ticket.dto.GroupBookingRequest;
import com.eticketing.app.ticket.dto.GroupSeatUpdateRequest;
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
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Booking orchestrator — TRIP_SPEC section 10.
 * <p>
 * 7-step flow: resolve segments → check express segment → calculate price →
 * atomic CAS reserve → create PENDING ticket → rollback on failure → return
 * ticket.
 */
@Service
@RequiredArgsConstructor
public class BookingService {

    private static final Logger LOG = LoggerFactory.getLogger(BookingService.class);

    /**
     * Global seat-hold duration: 10 minutes (in seconds).
     */
    private static final long SEAT_HOLD_SECONDS = 600;

    private final TripTypeRepository tripRepository;
    private final TicketRepository ticketRepository;
    private final OrderRepository orderRepository;
    private final SeatReservationService seatReservationService;
    private final CurrencyRepository currencyRepository;
    private final BookingEmailNotifier bookingEmailNotifier;

    // ════════════════════════════════════════════════════════════════════
    // CREATE BOOKING
    // ════════════════════════════════════════════════════════════════════
    /**
     * Creates a new booking (PENDING ticket) per TRIP_SPEC section 10.
     *
     * @param tripId the trip to book
     * @param originPlaceId journey origin
     * @param destinationPlaceId journey destination
     * @param pickupPointId where passenger boards
     * @param dropoffPointId where passenger alights
     * @param passengerId passenger identifier
     * @param idempotencyKey exactly-once key
     * @param lang passenger UI language snapshot
     * @param companyId company from auth context
     * @param posId POS from auth context (nullable)
     * @return the created ticket
     */
    public TicketType createBooking(String tripId, String originPlaceId, String destinationPlaceId,
            String pickupPointId, String dropoffPointId,
            String passengerId, String idempotencyKey, String lang, String seatNo,
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

        // ── 1b. Derive companyId from trip (authoritative source) ────────
        String resolvedCompanyId = (trip.getTarget() != null && trip.getTarget().getCompany() != null)
                ? trip.getTarget().getCompany()
                : companyId;
        if (resolvedCompanyId == null || resolvedCompanyId.isBlank()) {
            throw new BadRequestException("COMPANY_MISSING: cannot determine company for this booking");
        }

        // ── 2. Resolve segment chain ────────────────────────────────────
        List<String> segmentIds = resolveSegmentChain(trip.getSegments(), originPlaceId, destinationPlaceId);
        if (segmentIds.isEmpty()) {
            throw new BadRequestException("NO_SEGMENT_CHAIN: no continuous segment path from " + originPlaceId + " to " + destinationPlaceId);
        }

        // ── 3. Resolve inventory owner + price ──────────────────────────
        PricingSelection pricingSelection = selectPricingSelection(trip, segmentIds);
        BigDecimal appliedPrice = pricingSelection.appliedPrice();
        String expressSegmentId = pricingSelection.expressSegmentId();

        // ── 4. Validate pickup/dropoff ──────────────────────────────────
        validatePickupPoint(trip, pickupPointId, originPlaceId);
        validateDropoffPoint(trip, dropoffPointId, destinationPlaceId);

        // ── 5. Atomic CAS reserve ───────────────────────────────────────
        boolean reserved = seatReservationService.reserveSeats(tripId, segmentIds, expressSegmentId);
        if (!reserved) {
            throw new ConflictException("SEGMENT_CAPACITY_EXCEEDED: no seats available on one or more segments");
        }

        // ── 6. Create PENDING ticket ────────────────────────────────────
        try {
            Instant now = Instant.now();
            Instant expiresAt = now.plusSeconds(SEAT_HOLD_SECONDS);
            String ticketCurrency = resolveTicketCurrency(trip);
            String ticketLanguage = TicketLanguage.fromCode(lang).getCode();

            TicketType ticket = TicketType.builder()
                    .tripId(tripId)
                    .target(new TargetInput(resolvedCompanyId, posId))
                    .segmentIds(new ArrayList<>(segmentIds))
                    .expressSegmentId(expressSegmentId)
                    .pickupPointId(pickupPointId)
                    .dropoffPointId(dropoffPointId)
                    .passengerId(passengerId)
                    .seatNo(seatNo)
                    .appliedPrice(appliedPrice)
                    .currency(ticketCurrency)
                    .lang(ticketLanguage)
                    .status(TicketStatusEnum.PENDING)
                    .idempotencyKey(idempotencyKey)
                    .expiresAt(expiresAt)
                    .build();

            return ticketRepository.save(ticket);
        } catch (Exception e) {
            // ── 7. Rollback CAS on DB error ─────────────────────────────
            LOG.error("Ticket creation failed, rolling back seat reservation for trip={}", tripId, e);
            seatReservationService.releaseSeats(tripId, segmentIds, expressSegmentId);
            throw e;
        }
    }

    // ════════════════════════════════════════════════════════════════════
    // UPDATE SEAT ASSIGNMENT
    // ════════════════════════════════════════════════════════════════════
    /**
     * Updates the seat number on a PENDING ticket. Only PENDING tickets can
     * have their seat changed (before confirmation).
     */
    public TicketType updateSeatNo(String ticketId, String seatNo) {
        TicketType ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new NotFoundException("Ticket not found: " + ticketId));

        if (ticket.getStatus() != TicketStatusEnum.PENDING) {
            throw new ConflictException("INVALID_TICKET_STATE: seat can only be updated on PENDING tickets, current=" + ticket.getStatus());
        }

        ticket.setSeatNo(seatNo);
        TicketType saved = ticketRepository.save(ticket);

        if (saved.getOrderId() != null && !saved.getOrderId().isBlank()) {
            orderRepository.findById(saved.getOrderId()).ifPresent(order -> {
                boolean updated = false;
                for (OrderType.OrderPassenger passenger : order.getPassengers()) {
                    if (saved.getId().equals(passenger.getTicketId())) {
                        passenger.setSeatNo(saved.getSeatNo());
                        updated = true;
                        break;
                    }
                }
                if (updated) {
                    orderRepository.save(order);
                }
            });
        }

        return saved;
    }

    public OrderType updateGroupSeats(String orderId, GroupSeatUpdateRequest req) {
        OrderType order = orderRepository.findById(orderId)
                .orElseThrow(() -> new NotFoundException("Order not found: " + orderId));

        if (order.getStatus() != OrderStatusEnum.PENDING) {
            throw new ConflictException("INVALID_ORDER_STATE: seats can only be updated on PENDING orders, current=" + order.getStatus());
        }

        if (req.getAssignments() == null || req.getAssignments().isEmpty()) {
            throw new BadRequestException("SEAT_ASSIGNMENTS_REQUIRED: at least one seat assignment is required");
        }

        List<TicketType> tickets = ticketRepository.findByOrderId(orderId);
        Map<String, TicketType> ticketsById = new HashMap<>();
        for (TicketType ticket : tickets) {
            ticketsById.put(ticket.getId(), ticket);
        }

        Set<String> seenTicketIds = new HashSet<>();
        Set<String> seenSeatNos = new HashSet<>();
        Map<String, String> seatByTicketId = new HashMap<>();
        List<TicketType> changedTickets = new ArrayList<>();

        for (GroupSeatUpdateRequest.SeatAssignment assignment : req.getAssignments()) {
            String ticketId = assignment.getTicketId();
            String seatNo = assignment.getSeatNo() != null ? assignment.getSeatNo().trim() : "";

            if (!seenTicketIds.add(ticketId)) {
                throw new BadRequestException("DUPLICATE_TICKET_ASSIGNMENT: duplicate seat assignment for ticket " + ticketId);
            }
            if (seatNo.isBlank()) {
                throw new BadRequestException("INVALID_SEAT_NO: seatNo must not be blank");
            }
            if (!seenSeatNos.add(seatNo)) {
                throw new BadRequestException("DUPLICATE_SEAT_ASSIGNMENT: seat " + seatNo + " is assigned more than once");
            }

            TicketType ticket = ticketsById.get(ticketId);
            if (ticket == null) {
                throw new BadRequestException("INVALID_ORDER_TICKET: ticket does not belong to order: " + ticketId);
            }
            if (ticket.getStatus() != TicketStatusEnum.PENDING) {
                throw new ConflictException("INVALID_TICKET_STATE: seat can only be updated on PENDING tickets, ticket=" + ticketId + ", current=" + ticket.getStatus());
            }

            seatByTicketId.put(ticketId, seatNo);
            if (!seatNo.equals(ticket.getSeatNo())) {
                ticket.setSeatNo(seatNo);
                changedTickets.add(ticket);
            }
        }

        if (!changedTickets.isEmpty()) {
            ticketRepository.saveAll(changedTickets);
        }

        boolean orderChanged = false;
        for (OrderType.OrderPassenger passenger : order.getPassengers()) {
            String seatNo = seatByTicketId.get(passenger.getTicketId());
            if (seatNo != null && !seatNo.equals(passenger.getSeatNo())) {
                passenger.setSeatNo(seatNo);
                orderChanged = true;
            }
        }

        return orderChanged ? orderRepository.save(order) : order;
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
        TicketType saved = ticketRepository.save(ticket);

        // Fire-and-forget confirmation email (only for standalone tickets, not order members)
        if (saved.getOrderId() == null || saved.getOrderId().isBlank()) {
            bookingEmailNotifier.sendTicketConfirmationEmail(saved.getId());
        }
        return saved;
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
     * Cancels a ticket.
     * <p>
     * PENDING tickets use the expiry path: they transition to EXPIRED and
     * release their held seats immediately. CONFIRMED tickets transition to
     * CANCELLED and create a Refund record with status REQUESTED. Seats are NOT
     * released here — that happens on Refund APPROVED (Sprint 9).
     *
     * @return the updated ticket
     */
    public TicketType cancelBooking(String ticketId, RefundRepository refundRepository) {
        TicketType ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new NotFoundException("Ticket not found: " + ticketId));

        if (ticket.getStatus() == TicketStatusEnum.PENDING) {
            ticket.setStatus(TicketStatusEnum.EXPIRED);
            ticket.setExpiresAt(Instant.now());
            TicketType saved = ticketRepository.save(ticket);
            seatReservationService.releaseSeats(ticket.getTripId(), ticket.getSegmentIds(), ticket.getExpressSegmentId());
            LOG.info("Pending ticket {} cancelled via expiry path - released {} segments on trip {}",
                    ticketId, ticket.getSegmentIds().size(), ticket.getTripId());
            return saved;
        }

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
     * Finds the continuous chain of segment IDs from {@code originPlaceId} to
     * {@code destinationPlaceId}. Segments must be in sequence order and
     * consecutive.
     */
    List<String> resolveSegmentChain(List<SegmentType> segments, String originPlaceId, String destinationPlaceId) {
        // Sort by sequence
        List<SegmentType> sorted = segments.stream()
                .sorted(Comparator.comparingInt(SegmentType::getSequence))
                .toList();

        // Find the starting segment
        int startIdx = -1;
        for (int i = 0; i < sorted.size(); i++) {
            if (originPlaceId.equals(TripPlaceRef.idOf(sorted.get(i).getFromPlace()))) {
                startIdx = i;
                break;
            }
        }
        if (startIdx == -1) {
            return List.of();
        }

        // Collect consecutive segments until destinationPlaceId
        List<String> chain = new ArrayList<>();
        for (int i = startIdx; i < sorted.size(); i++) {
            chain.add(sorted.get(i).getSegmentId());
            if (destinationPlaceId.equals(TripPlaceRef.idOf(sorted.get(i).getToPlace()))) {
                return chain;
            }
        }

        // destinationPlaceId not reached
        return List.of();
    }

    /**
     * Finds an active express segment that exactly covers the given segment
     * chain.
     */
    Optional<ExpressSegmentType> findMatchingExpressSegment(List<ExpressSegmentType> expressSegments, List<String> segmentIds) {
        if (expressSegments == null) {
            return Optional.empty();
        }
        Instant now = Instant.now();
        return expressSegments.stream()
                .filter(ExpressSegmentType::isActive)
                .filter(segment -> segment.getValidFrom() == null || !now.isBefore(segment.getValidFrom()))
                .filter(segment -> segment.getValidUntil() == null || !now.isAfter(segment.getValidUntil()))
                .filter(segment -> segment.getSegmentsCovered() != null)
                .filter(segment -> segment.getSegmentsCovered().equals(segmentIds))
                .findFirst();
    }

    private PricingSelection selectPricingSelection(TripType trip, List<String> segmentIds) {
        if (isMultiSegmentRoute(segmentIds)) {
            ExpressSegmentType expressSegment = findMatchingExpressSegment(trip.getExpressSegments(), segmentIds)
                    .orElseThrow(() -> new BadRequestException(
                    "EXPRESS_SEGMENT_REQUIRED_FOR_MULTI_SEGMENT_ROUTE: route requires an active express segment"));
            return new PricingSelection(expressSegment.getPrice(), expressSegment.getExpressSegmentId());
        }

        return new PricingSelection(calculateSegmentSum(trip.getSegments(), segmentIds), null);
    }

    private boolean isMultiSegmentRoute(List<String> segmentIds) {
        return segmentIds != null && segmentIds.size() > 1;
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

    private record PricingSelection(BigDecimal appliedPrice, String expressSegmentId) {

    }

    // ════════════════════════════════════════════════════════════════════
    // PICKUP / DROPOFF VALIDATION
    // ════════════════════════════════════════════════════════════════════
    private void validatePickupPoint(TripType trip, String pickupPointId, String originPlaceId) {
        PickupPointType pp = trip.getPickupPoints().stream()
                .filter(p -> p.getPointId().equals(pickupPointId))
                .findFirst()
                .orElseThrow(() -> new BadRequestException("INVALID_PICKUP_POINT: pickup point not found: " + pickupPointId));

        if (!pp.isActive()) {
            throw new BadRequestException("INACTIVE_PICKUP_POINT: pickup point is inactive: " + pickupPointId);
        }
        if (!pp.getPlaceId().equals(originPlaceId)) {
            throw new BadRequestException("PICKUP_PLACE_MISMATCH: pickup point placeId does not match originPlaceId");
        }
    }

    private void validateDropoffPoint(TripType trip, String dropoffPointId, String destinationPlaceId) {
        DropoffPointType dp = trip.getDropoffPoints().stream()
                .filter(d -> d.getPointId().equals(dropoffPointId))
                .findFirst()
                .orElseThrow(() -> new BadRequestException("INVALID_DROPOFF_POINT: dropoff point not found: " + dropoffPointId));

        if (!dp.isActive()) {
            throw new BadRequestException("INACTIVE_DROPOFF_POINT: dropoff point is inactive: " + dropoffPointId);
        }
        if (!dp.getPlaceId().equals(destinationPlaceId)) {
            throw new BadRequestException("DROPOFF_PLACE_MISMATCH: dropoff point placeId does not match destinationPlaceId");
        }
    }

    // ════════════════════════════════════════════════════════════════════
    // GROUP BOOKING (ORDER)
    // ════════════════════════════════════════════════════════════════════
    /**
     * Creates a group booking: one Order with N PENDING tickets (one per
     * passenger). Seat inventory is locked atomically for the entire group.
     */
    public OrderType createGroupBooking(GroupBookingRequest req, String companyId, String posId) {

        // ── 0. Idempotency ──────────────────────────────────────────────
        Optional<OrderType> existingOrder = orderRepository.findByIdempotencyKey(req.getIdempotencyKey());
        if (existingOrder.isPresent()) {
            LOG.info("ORDER_IDEMPOTENCY_REPLAY: key={} returning existing order={}", req.getIdempotencyKey(), existingOrder.get().getId());
            return existingOrder.get();
        }

        // ── 1. Load trip & validate ─────────────────────────────────────
        TripType trip = tripRepository.findById(req.getTripId())
                .orElseThrow(() -> new NotFoundException("Trip not found: " + req.getTripId()));
        if (trip.getStatus() != TripStatusEnum.ACTIVE) {
            throw new BadRequestException("TRIP_NOT_ACTIVE: booking is only allowed on ACTIVE trips");
        }

        String resolvedCompanyId = (trip.getTarget() != null && trip.getTarget().getCompany() != null)
                ? trip.getTarget().getCompany() : companyId;
        if (resolvedCompanyId == null || resolvedCompanyId.isBlank()) {
            throw new BadRequestException("COMPANY_MISSING: cannot determine company for this booking");
        }

        // ── 2. Resolve segment chain ────────────────────────────────────
        List<String> segmentIds = resolveSegmentChain(
                trip.getSegments(),
                req.getOriginPlaceId(),
                req.getDestinationPlaceId());
        if (segmentIds.isEmpty()) {
            throw new BadRequestException(
                    "NO_SEGMENT_CHAIN: no continuous segment path from "
                    + req.getOriginPlaceId() + " to " + req.getDestinationPlaceId());
        }

        // ── 3. Resolve inventory owner + price ──────────────────────────
        PricingSelection pricingSelection = selectPricingSelection(trip, segmentIds);
        BigDecimal unitPrice = pricingSelection.appliedPrice();
        String expressSegmentId = pricingSelection.expressSegmentId();

        // ── 4. Validate pickup/dropoff ──────────────────────────────────
        validatePickupPoint(trip, req.getPickupPointId(), req.getOriginPlaceId());
        validateDropoffPoint(trip, req.getDropoffPointId(), req.getDestinationPlaceId());

        int passengerCount = req.getPassengers().size();

        // ── 5. Atomic CAS reserve for the entire group ──────────────────
        boolean reserved = seatReservationService.reserveSeats(req.getTripId(), segmentIds, expressSegmentId, passengerCount);
        if (!reserved) {
            throw new ConflictException("SEGMENT_CAPACITY_EXCEEDED: not enough seats for " + passengerCount + " passengers");
        }

        // ── 6. Create individual tickets + order ────────────────────────
        try {
            Instant now = Instant.now();
            Instant expiresAt = now.plusSeconds(SEAT_HOLD_SECONDS);
            String ticketCurrency = resolveTicketCurrency(trip);
            String ticketLanguage = TicketLanguage.fromCode(req.getLang()).getCode();
            BigDecimal totalPrice = unitPrice.multiply(BigDecimal.valueOf(passengerCount));
            String finalExpressSegmentId = expressSegmentId;

            // Create tickets
            List<TicketType> tickets = new ArrayList<>();
            List<OrderType.OrderPassenger> orderPassengers = new ArrayList<>();
            int guestIndex = 0;
            for (GroupBookingRequest.PassengerEntry pe : req.getPassengers()) {
                boolean isGuest = (pe.getPassengerId() == null || pe.getPassengerId().isBlank());
                String idempKey = isGuest
                        ? req.getIdempotencyKey() + ":guest:" + guestIndex++
                        : req.getIdempotencyKey() + ":" + pe.getPassengerId();

                TicketType ticket = TicketType.builder()
                        .tripId(req.getTripId())
                        .target(new TargetInput(resolvedCompanyId, posId))
                        .segmentIds(new ArrayList<>(segmentIds))
                        .expressSegmentId(finalExpressSegmentId)
                        .pickupPointId(req.getPickupPointId())
                        .dropoffPointId(req.getDropoffPointId())
                        .passengerId(isGuest ? null : pe.getPassengerId())
                        .guestFirstName(isGuest ? pe.getFirstName() : null)
                        .guestLastName(isGuest ? pe.getLastName() : null)
                        .seatNo(pe.getSeatNo())
                        .appliedPrice(unitPrice)
                        .currency(ticketCurrency)
                        .lang(ticketLanguage)
                        .status(TicketStatusEnum.PENDING)
                        .idempotencyKey(idempKey)
                        .expiresAt(expiresAt)
                        .build();
                tickets.add(ticket);

                orderPassengers.add(OrderType.OrderPassenger.builder()
                        .passengerId(isGuest ? null : pe.getPassengerId())
                        .firstName(pe.getFirstName())
                        .lastName(pe.getLastName())
                        .seatNo(pe.getSeatNo())
                        .build());
            }
            List<TicketType> savedTickets = ticketRepository.saveAll(tickets);
            List<String> ticketIds = savedTickets.stream().map(TicketType::getId).toList();

            // Link ticket IDs into order passengers
            for (int i = 0; i < orderPassengers.size(); i++) {
                orderPassengers.get(i).setTicketId(ticketIds.get(i));
            }

            // Create order
            OrderType order = OrderType.builder()
                    .tripId(req.getTripId())
                    .target(new TargetInput(resolvedCompanyId, posId))
                    .contactCustomerId(req.getContactCustomerId())
                    .ticketIds(new ArrayList<>(ticketIds))
                    .passengers(new ArrayList<>(orderPassengers))
                    .totalPrice(totalPrice)
                    .currency(ticketCurrency)
                    .status(OrderStatusEnum.PENDING)
                    .idempotencyKey(req.getIdempotencyKey())
                    .expiresAt(expiresAt)
                    .build();
            OrderType savedOrder = orderRepository.save(order);

            // Back-link orderId on tickets
            for (TicketType t : savedTickets) {
                t.setOrderId(savedOrder.getId());
            }
            ticketRepository.saveAll(savedTickets);

            return savedOrder;
        } catch (Exception e) {
            LOG.error("Group booking failed, rolling back {} seats on trip={}", passengerCount, req.getTripId(), e);
            seatReservationService.releaseSeats(req.getTripId(), segmentIds, expressSegmentId, passengerCount);
            throw e;
        }
    }

    // ════════════════════════════════════════════════════════════════════
    // CONFIRM ORDER
    // ════════════════════════════════════════════════════════════════════
    /**
     * Confirms an entire order: cascades CONFIRMED to all PENDING tickets.
     */
    public OrderType confirmOrder(String orderId) {
        OrderType order = orderRepository.findById(orderId)
                .orElseThrow(() -> new NotFoundException("Order not found: " + orderId));

        if (order.getStatus() == OrderStatusEnum.EXPIRED) {
            throw new ConflictException("ORDER_EXPIRED: cannot confirm an expired order");
        }
        if (order.getStatus() != OrderStatusEnum.PENDING) {
            throw new ConflictException("INVALID_ORDER_TRANSITION: order is " + order.getStatus() + ", expected PENDING");
        }

        Instant now = Instant.now();
        // Confirm all child tickets
        List<TicketType> tickets = ticketRepository.findByOrderId(orderId);
        for (TicketType ticket : tickets) {
            if (ticket.getStatus() == TicketStatusEnum.PENDING) {
                ticket.setStatus(TicketStatusEnum.CONFIRMED);
                ticket.setConfirmedAt(now);
            }
        }
        ticketRepository.saveAll(tickets);

        order.setStatus(OrderStatusEnum.CONFIRMED);
        order.setConfirmedAt(now);
        OrderType savedOrder = orderRepository.save(order);

        // Fire-and-forget confirmation email for the order
        bookingEmailNotifier.sendOrderConfirmationEmail(savedOrder.getId());
        return savedOrder;
    }

    // ════════════════════════════════════════════════════════════════════
    // CANCEL ORDER
    // ════════════════════════════════════════════════════════════════════
    /**
     * Cancels an entire order. PENDING orders expire immediately with seat
     * release. CONFIRMED orders transition to CANCELLED with refund records.
     */
    public OrderType cancelOrder(String orderId, RefundRepository refundRepository) {
        OrderType order = orderRepository.findById(orderId)
                .orElseThrow(() -> new NotFoundException("Order not found: " + orderId));

        List<TicketType> tickets = ticketRepository.findByOrderId(orderId);

        if (order.getStatus() == OrderStatusEnum.PENDING) {
            // Expire path — release seats for all tickets
            Instant now = Instant.now();
            List<TicketType> expiredTickets = new ArrayList<>();
            for (TicketType ticket : tickets) {
                if (ticket.getStatus() == TicketStatusEnum.PENDING) {
                    ticket.setStatus(TicketStatusEnum.EXPIRED);
                    ticket.setExpiresAt(now);
                    expiredTickets.add(ticket);
                }
            }
            ticketRepository.saveAll(tickets);

            if (!expiredTickets.isEmpty()) {
                seatReservationService.releaseReservations(order.getTripId(), expiredTickets);
            }

            order.setStatus(OrderStatusEnum.EXPIRED);
            order.setExpiresAt(now);
            return orderRepository.save(order);
        }

        if (order.getStatus() != OrderStatusEnum.CONFIRMED) {
            throw new ConflictException("INVALID_ORDER_TRANSITION: only PENDING or CONFIRMED orders can be cancelled");
        }

        // Confirmed → Cancelled with refund
        Instant now = Instant.now();
        for (TicketType ticket : tickets) {
            if (ticket.getStatus() == TicketStatusEnum.CONFIRMED) {
                ticket.setStatus(TicketStatusEnum.CANCELLED);
                ticket.setCancelledAt(now);
                ticketRepository.save(ticket);

                RefundType refund = RefundType.builder()
                        .ticketId(ticket.getId())
                        .segmentsRefunded(new ArrayList<>(ticket.getSegmentIds()))
                        .amount(ticket.getAppliedPrice())
                        .currency(ticket.getCurrency())
                        .status(RefundStatusEnum.REQUESTED)
                        .build();
                refundRepository.save(refund);
            }
        }

        order.setStatus(OrderStatusEnum.CANCELLED);
        order.setCancelledAt(now);
        return orderRepository.save(order);
    }

    /**
     * Cancels a single ticket within an order while keeping the remaining
     * active members linked to the order.
     * <p>
     * PENDING order members expire immediately and release one seat. CONFIRMED
     * order members are cancelled, release one seat immediately, and still
     * create a refund request for financial follow-up.
     */
    public OrderType cancelOrderTicket(String orderId, String ticketId, RefundRepository refundRepository) {
        OrderType order = orderRepository.findById(orderId)
                .orElseThrow(() -> new NotFoundException("Order not found: " + orderId));

        if (order.getStatus() != OrderStatusEnum.PENDING && order.getStatus() != OrderStatusEnum.CONFIRMED) {
            throw new ConflictException(
                    "INVALID_ORDER_TRANSITION: only active orders can cancel a member ticket, current=" + order.getStatus());
        }

        List<TicketType> tickets = ticketRepository.findByOrderId(orderId);
        TicketType ticket = tickets.stream()
                .filter(candidate -> ticketId.equals(candidate.getId()))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Ticket not found in order: " + ticketId));

        Instant now = Instant.now();
        if (ticket.getStatus() == TicketStatusEnum.PENDING) {
            ticket.setStatus(TicketStatusEnum.EXPIRED);
            ticket.setExpiresAt(now);
            ticketRepository.save(ticket);
            seatReservationService.releaseSeats(ticket.getTripId(), ticket.getSegmentIds(), ticket.getExpressSegmentId());
        } else if (ticket.getStatus() == TicketStatusEnum.CONFIRMED) {
            ticket.setStatus(TicketStatusEnum.CANCELLED);
            ticket.setCancelledAt(now);
            ticketRepository.save(ticket);
            seatReservationService.releaseSeats(ticket.getTripId(), ticket.getSegmentIds(), ticket.getExpressSegmentId());

            RefundType refund = RefundType.builder()
                    .ticketId(ticketId)
                    .segmentsRefunded(new ArrayList<>(ticket.getSegmentIds()))
                    .amount(ticket.getAppliedPrice())
                    .currency(ticket.getCurrency())
                    .status(RefundStatusEnum.REQUESTED)
                    .seatReleased(true)
                    .seatReleasedAt(now)
                    .build();
            refundRepository.save(refund);
        } else {
            throw new ConflictException(
                    "INVALID_ORDER_TICKET_TRANSITION: only PENDING or CONFIRMED order tickets can be cancelled, current="
                    + ticket.getStatus());
        }

        return reconcileOrderAfterMemberCancellation(order, tickets, now);
    }

    private OrderType reconcileOrderAfterMemberCancellation(OrderType order, List<TicketType> tickets, Instant now) {
        List<TicketType> activeTickets = tickets.stream()
                .filter(this::isActiveOrderTicket)
                .toList();
        Set<String> activeTicketIds = new HashSet<>(activeTickets.stream().map(TicketType::getId).toList());

        order.setTicketIds(order.getTicketIds().stream()
                .filter(activeTicketIds::contains)
                .toList());
        order.setPassengers(order.getPassengers().stream()
                .filter(passenger -> activeTicketIds.contains(passenger.getTicketId()))
                .toList());
        order.setTotalPrice(activeTickets.stream()
                .map(TicketType::getAppliedPrice)
                .filter(amount -> amount != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add));

        if (activeTickets.isEmpty()) {
            if (order.getStatus() == OrderStatusEnum.CONFIRMED) {
                order.setStatus(OrderStatusEnum.CANCELLED);
                order.setCancelledAt(now);
            } else {
                order.setStatus(OrderStatusEnum.EXPIRED);
                order.setExpiresAt(now);
            }
            return orderRepository.save(order);
        }

        order.setStatus(resolveActiveOrderStatus(activeTickets));
        return orderRepository.save(order);
    }

    private boolean isActiveOrderTicket(TicketType ticket) {
        return ticket.getStatus() == TicketStatusEnum.PENDING || ticket.getStatus() == TicketStatusEnum.CONFIRMED;
    }

    private OrderStatusEnum resolveActiveOrderStatus(List<TicketType> activeTickets) {
        boolean hasPending = activeTickets.stream().anyMatch(ticket -> ticket.getStatus() == TicketStatusEnum.PENDING);
        return hasPending ? OrderStatusEnum.PENDING : OrderStatusEnum.CONFIRMED;
    }
}
