package com.eticketing.app.ticket;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.User;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import com.eticketing.app.trip.TripType;
import com.eticketing.app.trip.TripTypeRepository;
import com.eticketing.app.user.RoleEnum;
import com.eticketing.app.user.UserType;
import com.eticketing.app.user.UserTypeRepository;

/**
 * Legacy ticket query & management controller.
 * Booking creation is handled by {@link BookingController}.
 */
@RestController
@RequestMapping("/api/tickets")
public class TicketController {

    private static final Logger LOGGER = LoggerFactory.getLogger(TicketController.class);

    @Autowired
    private TicketRepository ticketRepository;
    @Autowired
    private TripTypeRepository tripRepository;
    @Autowired
    private UserTypeRepository userRepository;
    @Autowired
    private TicketDocumentService ticketDocumentService;
    @Autowired
    private TicketEmailService ticketEmailService;
    @Autowired
    private SeatReservationService seatReservationService;

    public static class SendTicketEmailRequest {
        public String email;
    }

    @GetMapping("/{id}/document")
    public ResponseEntity<?> getTicketDocument(@PathVariable String id, @AuthenticationPrincipal User principal) {
        TicketType ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));
        if (!canViewTicket(ticket, principal)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access denied"));
        }
        TicketDocumentView document = ticketDocumentService.buildDocument(ticket);
        return ResponseEntity.ok(document);
    }

    @PostMapping("/{id}/send-email")
    public ResponseEntity<?> sendTicketEmail(@PathVariable String id,
            @AuthenticationPrincipal User principal,
            @RequestBody(required = false) SendTicketEmailRequest payload) {
        TicketType ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));
        if (!canViewTicket(ticket, principal)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access denied"));
        }
        TicketDocumentView document = ticketDocumentService.buildDocument(ticket);
        String requestedEmail = payload != null ? payload.email : null;
        String fallback = document.getPassengerEmail();
        String recipient = resolveRecipientEmail(requestedEmail, fallback);
        if (recipient == null || recipient.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No email available for ticket"));
        }
        boolean sent = ticketEmailService.sendTicket(document, recipient);
        if (!sent) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("status", "email_not_sent"));
        }
        return ResponseEntity.ok(Map.of("status", "sent", "email", recipient));
    }

    @GetMapping
    public List<Map<String, Object>> getAllTickets() {
        return ticketRepository.findAll().stream()
                .map(this::buildTicketResponse)
                .toList();
    }

    @GetMapping("/by-pos/{posId}")
    public ResponseEntity<?> getTicketsByPos(
            @PathVariable String posId,
            @RequestParam(required = false) TicketStatusEnum status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int limit,
            @AuthenticationPrincipal User principal) {
        if (!isAdminOrManager(principal)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access denied"));
        }
        if (posId == null || posId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "posId is required"));
        }
        if (page < 0) page = 0;
        if (limit < 1 || limit > 100) limit = 20;

        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(page, limit,
                org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"));

        org.springframework.data.domain.Page<TicketType> result;
        if (status != null) {
            result = ticketRepository.findByTargetPosAndStatus(posId, status, pageable);
        } else {
            result = ticketRepository.findByTargetPos(posId, pageable);
        }

        List<Map<String, Object>> tickets = result.getContent().stream()
                .map(this::buildTicketResponse)
                .toList();

        return ResponseEntity.ok(Map.of(
                "content", tickets,
                "totalElements", result.getTotalElements(),
                "totalPages", result.getTotalPages(),
                "last", result.isLast(),
                "number", result.getNumber()
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getTicket(@PathVariable String id, @AuthenticationPrincipal User principal) {
        Optional<TicketType> ticketOpt = ticketRepository.findById(id);
        if (ticketOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        TicketType ticket = ticketOpt.get();
        if (!canViewTicket(ticket, principal)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access denied"));
        }
        return ResponseEntity.ok(buildTicketResponse(ticket));
    }

    //  Response builder 

    private Map<String, Object> buildTicketResponse(TicketType ticket) {
        TripType trip = tripRepository.findById(ticket.getTripId()).orElse(null);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", ticket.getId());
        payload.put("version", ticket.getVersion());
        payload.put("tripId", ticket.getTripId());
        payload.put("target", ticket.getTarget());
        payload.put("segmentIds", ticket.getSegmentIds());
        payload.put("expressId", ticket.getExpressId());
        payload.put("pickupPointId", ticket.getPickupPointId());
        payload.put("dropoffPointId", ticket.getDropoffPointId());
        payload.put("passengerId", ticket.getPassengerId());
        payload.put("appliedPrice", ticket.getAppliedPrice());
        payload.put("currency", ticket.getCurrency());
        payload.put("status", ticket.getStatus());
        payload.put("idempotencyKey", ticket.getIdempotencyKey());
        payload.put("expiresAt", formatInstant(ticket.getExpiresAt()));
        payload.put("createdAt", formatInstant(ticket.getCreatedAt()));
        payload.put("confirmedAt", formatInstant(ticket.getConfirmedAt()));
        payload.put("cancelledAt", formatInstant(ticket.getCancelledAt()));
        if (trip != null) {
            payload.put("tripDepartureDate", formatInstant(trip.getDepartureDate()));
            payload.put("tripStatus", trip.getStatus());
        }
        return payload;
    }

    private String formatInstant(Instant instant) {
        if (instant == null) return null;
        return DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(instant.atOffset(ZoneOffset.UTC));
    }

    //  Helpers 

    private void responseEmailDelivery(TicketDocumentView documentView, String fallbackEmail) {
        String recipient = resolveRecipientEmail(documentView != null ? documentView.getPassengerEmail() : null, fallbackEmail);
        if (documentView == null || recipient == null || recipient.isBlank()) {
            return;
        }
        if (!ticketEmailService.sendTicket(documentView, recipient)) {
            LOGGER.warn("Ticket email could not be delivered for ticket {}", documentView.getReference());
        }
    }

    private String resolveRecipientEmail(String preferred, String fallback) {
        if (preferred != null && !preferred.isBlank()) return preferred;
        if (fallback != null && !fallback.isBlank()) return fallback;
        return null;
    }

    private boolean canViewTicket(TicketType ticket, User principal) {
        if (principal == null) return false;
        if (Objects.equals(principal.getUsername(), ticket.getPassengerId())) return true;
        return isAdminOrManager(principal);
    }

    private boolean isAdminOrManager(User principal) {
        if (principal == null) return false;
        return principal.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(auth -> auth.equals("ROLE_" + RoleEnum.ADMIN.name()) || auth.equals("ROLE_" + RoleEnum.MANAGER.name()));
    }
}
