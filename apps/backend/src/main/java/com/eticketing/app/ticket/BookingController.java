package com.eticketing.app.ticket;

import com.eticketing.app.ticket.dto.BookingRequest;
import com.eticketing.app.ticket.dto.BookingResponse;
import com.eticketing.app.user.UserType;
import com.eticketing.app.user.UserTypeRepository;
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
    private final UserTypeRepository userRepository;

    @PostMapping
    public ResponseEntity<BookingResponse> createBooking(
            @Valid @RequestBody BookingRequest req,
            @AuthenticationPrincipal User principal) {

        String[] ids = resolveCompanyAndPos(principal);
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

    // ── Helpers ─────────────────────────────────────────────────────────
    private String[] resolveCompanyAndPos(User principal) {
        UserType user = userRepository.findById(principal.getUsername()).orElse(null);
        String companyId = user != null && user.getTarget() != null ? user.getTarget().getCompany() : null;
        String posId = user != null && user.getTarget() != null ? user.getTarget().getPos() : null;
        return new String[]{companyId, posId};
    }

    static BookingResponse toResponse(TicketType ticket) {
        return BookingResponse.builder()
                .id(ticket.getId())
                .tripId(ticket.getTripId())
                .companyId(ticket.getTarget() != null ? ticket.getTarget().getCompany() : null)
                .posId(ticket.getTarget() != null ? ticket.getTarget().getPos() : null)
                .segmentIds(ticket.getSegmentIds())
                .expressId(ticket.getExpressId())
                .pickupPointId(ticket.getPickupPointId())
                .dropoffPointId(ticket.getDropoffPointId())
                .passengerId(ticket.getPassengerId())
                .appliedPrice(ticket.getAppliedPrice())
                .currency(ticket.getCurrency())
                .status(ticket.getStatus())
                .idempotencyKey(ticket.getIdempotencyKey())
                .expiresAt(ticket.getExpiresAt())
                .createdAt(ticket.getCreatedAt())
                .confirmedAt(ticket.getConfirmedAt())
                .cancelledAt(ticket.getCancelledAt())
                .build();
    }
}
