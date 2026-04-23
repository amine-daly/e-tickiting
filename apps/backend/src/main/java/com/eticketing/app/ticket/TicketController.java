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

import com.eticketing.app.place.PlaceRepository;
import com.eticketing.app.place.PlaceType;
import com.eticketing.app.trip.PickupPointType;
import com.eticketing.app.trip.DropoffPointType;
import com.eticketing.app.trip.SegmentType;
import com.eticketing.app.trip.TripType;
import com.eticketing.app.trip.TripTypeRepository;
import com.eticketing.app.user.RoleEnum;
import com.eticketing.app.user.UserType;
import com.eticketing.app.user.UserTypeRepository;

import org.springframework.data.domain.Page;

/**
 * Legacy ticket query & management controller. Booking creation is handled by
 * {@link BookingController}.
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
    private PlaceRepository placeRepository;
    @Autowired
    private UserTypeRepository userRepository;
    @Autowired
    private TicketDocumentService ticketDocumentService;
    @Autowired
    private TicketEmailService ticketEmailService;
    @Autowired
    private SeatReservationService seatReservationService;
    @Autowired
    private OrderRepository orderRepository;

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

    // ── Order-level document & email ────────────────────────────────────
    @GetMapping("/orders/{orderId}/document")
    public ResponseEntity<?> getOrderDocument(@PathVariable String orderId, @AuthenticationPrincipal User principal) {
        OrderType order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        List<TicketType> tickets = ticketRepository.findByOrderId(orderId);
        if (tickets.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        if (!canViewTicket(tickets.get(0), principal)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access denied"));
        }
        TicketDocumentView document = ticketDocumentService.buildOrderDocument(order, tickets);
        return ResponseEntity.ok(document);
    }

    @PostMapping("/orders/{orderId}/send-email")
    public ResponseEntity<?> sendOrderEmail(@PathVariable String orderId,
            @AuthenticationPrincipal User principal,
            @RequestBody(required = false) SendTicketEmailRequest payload) {
        OrderType order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        List<TicketType> tickets = ticketRepository.findByOrderId(orderId);
        if (tickets.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        if (!canViewTicket(tickets.get(0), principal)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access denied"));
        }
        TicketDocumentView document = ticketDocumentService.buildOrderDocument(order, tickets);
        String requestedEmail = payload != null ? payload.email : null;
        String fallback = document.getPassengerEmail();
        String recipient = resolveRecipientEmail(requestedEmail, fallback);
        if (recipient == null || recipient.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No email available for order contact"));
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
        if (page < 0) {
            page = 0;
        }
        if (limit < 1 || limit > 100) {
            limit = 20;
        }

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

    @GetMapping("/by-company/{companyId}")
    public ResponseEntity<?> getTicketsByCompany(
            @PathVariable String companyId,
            @RequestParam(required = false) TicketStatusEnum status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int limit,
            @AuthenticationPrincipal User principal) {
        if (!isAdminOrManager(principal)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access denied"));
        }
        if (companyId == null || companyId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "companyId is required"));
        }
        if (page < 0) {
            page = 0;
        }
        if (limit < 1 || limit > 100) {
            limit = 20;
        }

        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(page, limit,
                org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"));

        org.springframework.data.domain.Page<TicketType> result;
        if (status != null) {
            result = ticketRepository.findByTargetCompanyAndStatus(companyId, status, pageable);
        } else {
            result = ticketRepository.findByTargetCompany(companyId, pageable);
        }

        List<Map<String, Object>> tickets = result.getContent().stream()
                .map(this::buildTicketResponse)
                .toList();

        return ResponseEntity.ok(Map.of(
                "objects", tickets,
                "count", result.getTotalElements(),
                "isLast", result.isLast()
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
        payload.put("companyId", ticket.getTarget() != null ? ticket.getTarget().getCompany() : null);
        payload.put("posId", ticket.getTarget() != null ? ticket.getTarget().getPos() : null);
        payload.put("segmentIds", ticket.getSegmentIds());
        payload.put("expressId", ticket.getExpressId());
        payload.put("pickupPointId", ticket.getPickupPointId());
        payload.put("dropoffPointId", ticket.getDropoffPointId());
        payload.put("passengerId", ticket.getPassengerId());
        payload.put("seatNo", ticket.getSeatNo());
        payload.put("orderId", ticket.getOrderId());
        payload.put("guestFirstName", ticket.getGuestFirstName());
        payload.put("guestLastName", ticket.getGuestLastName());
        payload.put("appliedPrice", ticket.getAppliedPrice());
        payload.put("currency", ticket.getCurrency());
        payload.put("lang", TicketLanguage.fromCode(ticket.getLang()).getCode());
        payload.put("status", ticket.getStatus());
        payload.put("idempotencyKey", ticket.getIdempotencyKey());
        payload.put("expiresAt", formatInstant(ticket.getExpiresAt()));
        payload.put("createdAt", formatInstant(ticket.getCreatedAt()));
        payload.put("confirmedAt", formatInstant(ticket.getConfirmedAt()));
        payload.put("cancelledAt", formatInstant(ticket.getCancelledAt()));
        Map<String, Object> userPayload = new LinkedHashMap<>();
        userPayload.put("id", ticket.getPassengerId());
        userPayload.put("name", null);
        userPayload.put("email", null);
        userPayload.put("picture", null);
        userPayload.put("phone", null);

        if (ticket.getPassengerId() != null) {
            userRepository.findById(ticket.getPassengerId()).ifPresent(user -> {
                String name = ((user.getFirstName() != null ? user.getFirstName() : "") + " "
                        + (user.getLastName() != null ? user.getLastName() : "")).trim();
                userPayload.put("name", name.isEmpty() ? null : name);
                userPayload.put("email", user.getEmail());
                userPayload.put("picture", user.getPicture());
                userPayload.put("phone", user.getPhone());
            });
        } else if (ticket.getGuestFirstName() != null || ticket.getGuestLastName() != null) {
            // Guest passenger — show name from ticket fields
            String guestName = ((ticket.getGuestFirstName() != null ? ticket.getGuestFirstName() : "") + " "
                    + (ticket.getGuestLastName() != null ? ticket.getGuestLastName() : "")).trim();
            userPayload.put("name", guestName.isEmpty() ? null : guestName);
        }

        payload.put("user", userPayload);
        if (trip != null) {
            payload.put("tripDepartureDate", formatInstant(trip.getDepartureDate()));
            payload.put("tripStatus", trip.getStatus());

            // Enrich with pickup/dropoff place names
            if (ticket.getPickupPointId() != null && trip.getPickupPoints() != null) {
                trip.getPickupPoints().stream()
                        .filter(p -> ticket.getPickupPointId().equals(p.getPointId()))
                        .findFirst()
                        .ifPresent(pp -> {
                            payload.put("pickupAddress", pp.getAddress());
                            payload.put("pickupPlaceId", pp.getPlaceId());
                            PlaceType pickupPlace = pp.getPlaceId() != null ? placeRepository.findById(pp.getPlaceId()).orElse(null) : null;
                            payload.put("pickupCity", pickupPlace != null ? pickupPlace.getCity() : null);
                        });
            }
            if (ticket.getDropoffPointId() != null && trip.getDropoffPoints() != null) {
                trip.getDropoffPoints().stream()
                        .filter(d -> ticket.getDropoffPointId().equals(d.getPointId()))
                        .findFirst()
                        .ifPresent(dp -> {
                            payload.put("dropoffAddress", dp.getAddress());
                            payload.put("dropoffPlaceId", dp.getPlaceId());
                            PlaceType dropoffPlace = dp.getPlaceId() != null ? placeRepository.findById(dp.getPlaceId()).orElse(null) : null;
                            payload.put("dropoffCity", dropoffPlace != null ? dropoffPlace.getCity() : null);
                        });
            }

            // Enrich with route origin/destination from segments
            if (ticket.getSegmentIds() != null && !ticket.getSegmentIds().isEmpty() && trip.getSegments() != null) {
                List<SegmentType> ticketSegments = trip.getSegments().stream()
                        .filter(s -> ticket.getSegmentIds().contains(s.getSegmentId()))
                        .sorted((a, b) -> a.getSequence() - b.getSequence())
                        .toList();
                if (!ticketSegments.isEmpty()) {
                    String originPlaceId = ticketSegments.get(0).getFromPlaceId();
                    String destPlaceId = ticketSegments.get(ticketSegments.size() - 1).getToPlaceId();
                    PlaceType originPlace = originPlaceId != null ? placeRepository.findById(originPlaceId).orElse(null) : null;
                    PlaceType destPlace = destPlaceId != null ? placeRepository.findById(destPlaceId).orElse(null) : null;
                    payload.put("originPlaceId", originPlaceId);
                    payload.put("originCity", originPlace != null ? originPlace.getCity() : null);
                    payload.put("destinationPlaceId", destPlaceId);
                    payload.put("destinationCity", destPlace != null ? destPlace.getCity() : null);
                }
            }
        }
        return payload;
    }

    private String formatInstant(Instant instant) {
        if (instant == null) {
            return null;
        }
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
        if (preferred != null && !preferred.isBlank()) {
            return preferred;
        }
        if (fallback != null && !fallback.isBlank()) {
            return fallback;
        }
        return null;
    }

    private boolean canViewTicket(TicketType ticket, User principal) {
        if (principal == null) {
            return false;
        }
        if (Objects.equals(principal.getUsername(), ticket.getPassengerId())) {
            return true;
        }
        return isAdminOrManager(principal);
    }

    private boolean isAdminOrManager(User principal) {
        if (principal == null) {
            return false;
        }
        return principal.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(auth -> auth.equals("ROLE_" + RoleEnum.ADMIN.name()) || auth.equals("ROLE_" + RoleEnum.MANAGER.name()));
    }
}
