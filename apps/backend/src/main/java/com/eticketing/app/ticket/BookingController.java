package com.eticketing.app.ticket;

import com.eticketing.app.account.AccountType;
import com.eticketing.app.account.AccountTypeRepository;
import com.eticketing.app.ticket.dto.BookingRequest;
import com.eticketing.app.ticket.dto.BookingResponse;
import com.eticketing.app.ticket.dto.GroupBookingRequest;
import com.eticketing.app.ticket.dto.GroupBookingResponse;
import com.eticketing.app.ticket.dto.GroupSeatUpdateRequest;
import com.eticketing.app.user.UserType;
import com.eticketing.app.user.UserTypeRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.User;
import org.springframework.web.bind.annotation.*;

/**
 * Booking REST API — TRIP_SPEC section 10. Endpoints: create booking, confirm,
 * cancel.
 */
@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
public class BookingController {

    private final BookingService bookingService;
    private final RefundRepository refundRepository;
    private final TicketRepository ticketRepository;
    private final OrderRepository orderRepository;
    private final UserTypeRepository userRepository;
    private final AccountTypeRepository accountRepository;

    @GetMapping("/occupied-seats/{tripId}")
    public ResponseEntity<java.util.List<String>> getOccupiedSeats(@PathVariable String tripId) {
        java.util.List<String> seats = ticketRepository.findOccupiedSeatsByTripId(tripId)
                .stream()
                .map(TicketType::getSeatNo)
                .filter(s -> s != null && !s.isBlank())
                .distinct()
                .toList();
        return ResponseEntity.ok(seats);
    }

    @PostMapping
    public ResponseEntity<BookingResponse> createBooking(
            @Valid @RequestBody BookingRequest req,
            @AuthenticationPrincipal User principal,
            HttpServletRequest httpRequest) {

        String[] ids = resolveCompanyAndPos(principal, httpRequest);
        String companyId = ids[0];
        String posId = ids[1];

        TicketType ticket = bookingService.createBooking(
                req.getTripId(),
                req.getFromPlaceId(),
                req.getToPlaceId(),
                req.getPickupPointId(),
                req.getDropoffPointId(),
                req.getPassengerId(),
                req.getIdempotencyKey(),
                req.getLang(),
                req.getSeatNo(),
                companyId,
                posId);

        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(ticket));
    }

    @PostMapping("/{ticketId}/confirm")
    public ResponseEntity<BookingResponse> confirmBooking(@PathVariable String ticketId) {
        TicketType ticket = bookingService.confirmBooking(ticketId);
        return ResponseEntity.ok(toResponse(ticket));
    }

    @PostMapping("/{ticketId}/cancel")
    public ResponseEntity<BookingResponse> cancelBooking(@PathVariable String ticketId) {
        TicketType ticket = bookingService.cancelBooking(ticketId, refundRepository);
        return ResponseEntity.ok(toResponse(ticket));
    }

    @PatchMapping("/{ticketId}/seat")
    public ResponseEntity<BookingResponse> updateSeat(
            @PathVariable String ticketId,
            @RequestBody java.util.Map<String, String> body) {
        String seatNo = body.get("seatNo");
        TicketType ticket = bookingService.updateSeatNo(ticketId, seatNo);
        return ResponseEntity.ok(toResponse(ticket));
    }

    // ── GROUP BOOKING (ORDER) ENDPOINTS ─────────────────────────────────
    @PostMapping("/group")
    public ResponseEntity<GroupBookingResponse> createGroupBooking(
            @Valid @RequestBody GroupBookingRequest req,
            @AuthenticationPrincipal User principal,
            HttpServletRequest httpRequest) {

        String[] ids = resolveCompanyAndPos(principal, httpRequest);
        OrderType order = bookingService.createGroupBooking(req, ids[0], ids[1]);
        java.util.List<TicketType> tickets = ticketRepository.findByOrderId(order.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(toGroupResponse(order, tickets));
    }

    @PostMapping("/group/{orderId}/confirm")
    public ResponseEntity<GroupBookingResponse> confirmOrder(@PathVariable String orderId) {
        OrderType order = bookingService.confirmOrder(orderId);
        java.util.List<TicketType> tickets = ticketRepository.findByOrderId(orderId);
        return ResponseEntity.ok(toGroupResponse(order, tickets));
    }

    @PostMapping("/group/{orderId}/cancel")
    public ResponseEntity<GroupBookingResponse> cancelOrder(@PathVariable String orderId) {
        OrderType order = bookingService.cancelOrder(orderId, refundRepository);
        java.util.List<TicketType> tickets = ticketRepository.findByOrderId(orderId);
        return ResponseEntity.ok(toGroupResponse(order, tickets));
    }

    @PostMapping("/group/{orderId}/tickets/{ticketId}/cancel")
    public ResponseEntity<GroupBookingResponse> cancelOrderTicket(
            @PathVariable String orderId,
            @PathVariable String ticketId) {
        OrderType order = bookingService.cancelOrderTicket(orderId, ticketId, refundRepository);
        java.util.List<TicketType> tickets = ticketRepository.findByOrderId(orderId);
        return ResponseEntity.ok(toGroupResponse(order, tickets));
    }

    @PatchMapping("/group/{orderId}/seats")
    public ResponseEntity<GroupBookingResponse> updateGroupSeats(
            @PathVariable String orderId,
            @Valid @RequestBody GroupSeatUpdateRequest req) {
        OrderType order = bookingService.updateGroupSeats(orderId, req);
        java.util.List<TicketType> tickets = ticketRepository.findByOrderId(orderId);
        return ResponseEntity.ok(toGroupResponse(order, tickets));
    }

    // ── Helpers ─────────────────────────────────────────────────────────
    /**
     * Resolves companyId and posId from multiple sources: 1. X-Company-Id
     * header (sent by frontend interceptor from localStorage) 2. User's account
     * lookup (finds the user's account for the company) 3. Fallback to
     * UserType.target
     *
     * Note: companyId here is a hint — BookingService will override with the
     * trip's actual company for security.
     */
    private String[] resolveCompanyAndPos(User principal, HttpServletRequest httpRequest) {
        String headerCompanyId = httpRequest.getHeader("X-Company-Id");
        String headerPosId = httpRequest.getHeader("X-Pos-Id");
        String userId = principal.getUsername();

        // Try 1: read from X-Company-Id header + X-Pos-Id or account lookup
        if (headerCompanyId != null && !headerCompanyId.isBlank()) {
            String posId = (headerPosId != null && !headerPosId.isBlank())
                    ? headerPosId
                    : resolveUserTargetPos(userId);
            return new String[]{headerCompanyId, posId};
        }

        // Try 2: find any account for this user and extract company + pos
        java.util.List<AccountType> accounts = accountRepository.findByUserId(userId);
        if (accounts != null && !accounts.isEmpty()) {
            AccountType account = accounts.get(0);
            String companyId = account.getTarget() != null && account.getTarget().getCompany() != null
                    ? account.getTarget().getCompany().getId()
                    : null;
            // For posId: check user document target
            String posId = resolveUserTargetPos(userId);
            return new String[]{companyId, posId};
        }

        // Try 3: legacy fallback to UserType.target
        UserType user = userRepository.findById(userId).orElse(null);
        String companyId = user != null && user.getTarget() != null ? user.getTarget().getCompany() : null;
        String posId = user != null && user.getTarget() != null ? user.getTarget().getPos() : null;
        return new String[]{companyId, posId};
    }

    private String resolveAccountPos(String userId, String companyId) {
        // Check if user's account for this company has pos info, or fallback to user.target.pos
        return resolveUserTargetPos(userId);
    }

    private String resolveUserTargetPos(String userId) {
        UserType user = userRepository.findById(userId).orElse(null);
        return user != null && user.getTarget() != null ? user.getTarget().getPos() : null;
    }

    static BookingResponse toResponse(TicketType ticket) {
        return BookingResponse.builder()
                .id(ticket.getId())
                .tripId(ticket.getTripId())
                .orderId(ticket.getOrderId())
                .companyId(ticket.getTarget() != null ? ticket.getTarget().getCompany() : null)
                .posId(ticket.getTarget() != null ? ticket.getTarget().getPos() : null)
                .segmentIds(ticket.getSegmentIds())
                .expressSegmentId(ticket.getExpressSegmentId())
                .pickupPointId(ticket.getPickupPointId())
                .dropoffPointId(ticket.getDropoffPointId())
                .passengerId(ticket.getPassengerId())
                .guestFirstName(ticket.getGuestFirstName())
                .guestLastName(ticket.getGuestLastName())
                .seatNo(ticket.getSeatNo())
                .appliedPrice(ticket.getAppliedPrice())
                .currency(ticket.getCurrency())
                .lang(ticket.getLang())
                .status(ticket.getStatus())
                .idempotencyKey(ticket.getIdempotencyKey())
                .expiresAt(ticket.getExpiresAt())
                .createdAt(ticket.getCreatedAt())
                .confirmedAt(ticket.getConfirmedAt())
                .cancelledAt(ticket.getCancelledAt())
                .build();
    }

    static GroupBookingResponse toGroupResponse(OrderType order, java.util.List<TicketType> tickets) {
        return GroupBookingResponse.builder()
                .orderId(order.getId())
                .tripId(order.getTripId())
                .companyId(order.getTarget() != null ? order.getTarget().getCompany() : null)
                .posId(order.getTarget() != null ? order.getTarget().getPos() : null)
                .contactCustomerId(order.getContactCustomerId())
                .totalPrice(order.getTotalPrice())
                .currency(order.getCurrency())
                .status(order.getStatus())
                .idempotencyKey(order.getIdempotencyKey())
                .expiresAt(order.getExpiresAt())
                .createdAt(order.getCreatedAt())
                .confirmedAt(order.getConfirmedAt())
                .cancelledAt(order.getCancelledAt())
                .passengers(order.getPassengers())
                .tickets(tickets.stream().map(BookingController::toResponse).toList())
                .build();
    }
}
