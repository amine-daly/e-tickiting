package com.eticketing.app.ticket;

import com.eticketing.app.account.AccountType;
import com.eticketing.app.account.AccountTypeRepository;
import com.eticketing.app.ticket.dto.BookingRequest;
import com.eticketing.app.ticket.dto.BookingResponse;
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
    private final UserTypeRepository userRepository;
    private final AccountTypeRepository accountRepository;

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
    /**
     * Resolves companyId and posId from multiple sources:
     * 1. X-Company-Id header (sent by frontend interceptor from localStorage)
     * 2. User's account lookup (finds the user's account for the company)
     * 3. Fallback to UserType.target
     *
     * Note: companyId here is a hint — BookingService will override with
     * the trip's actual company for security.
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
                .companyId(ticket.getTarget() != null ? ticket.getTarget().getCompany() : null)
                .posId(ticket.getTarget() != null ? ticket.getTarget().getPos() : null)
                .segmentIds(ticket.getSegmentIds())
                .expressId(ticket.getExpressId())
                .pickupPointId(ticket.getPickupPointId())
                .dropoffPointId(ticket.getDropoffPointId())
                .passengerId(ticket.getPassengerId())
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
}
