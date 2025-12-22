package com.eticketing.app.ticket;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.User;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.eticketing.app.agency.AgencyRepository;
import com.eticketing.app.agency.AgencyType;
import com.eticketing.app.trip.SeatStateEnum;
import com.eticketing.app.trip.SeatUnit;
import com.eticketing.app.trip.TripType;
import com.eticketing.app.trip.TripTypeRepository;
import com.eticketing.app.user.RoleEnum;
import com.eticketing.app.user.UserType;
import com.eticketing.app.user.UserTypeRepository;

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
    private AgencyRepository agencyRepository;
    @Autowired
    private TicketDocumentService ticketDocumentService;
    @Autowired
    private TicketEmailService ticketEmailService;

    public static class BookTicketRequest {

        @NotBlank
        public String tripId;
        @NotNull
        @NotEmpty
        public List<@Valid RequestedSeat> seats = new ArrayList<>();
        @Valid
        public PaymentRequest payment;
        public Instant holdUntil;
    }

    public static class RequestedSeat {

        public String label;
        public Integer row;
        public Integer col;
    }

    public static class PaymentRequest {

        public BigDecimal amount;
        public String currency;
        public String method;
        public String provider;
        public String reference;
    }

    public static class UpdateTicketStatusRequest {

        @NotNull
        public TicketType.TicketStatusEnum status;
    }

    public static class SendTicketEmailRequest {

        public String email;
    }

    @PostMapping
    public ResponseEntity<?> bookTicket(@Valid @RequestBody BookTicketRequest req, @AuthenticationPrincipal User principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Authentication required"));
        }

        Optional<UserType> userOpt = userRepository.findById(principal.getUsername());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "User not found"));
        }
        UserType user = userOpt.get();

        TripType trip = tripRepository.findById(req.tripId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip not found"));
        if (trip.getSeats() == null || trip.getSeats().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Seat map not available yet");
        }

        List<SeatUnit> currentSeats = trip.getSeats();
        Map<String, SeatUnit> byLabel = new HashMap<>();
        Map<String, SeatUnit> byPos = new HashMap<>();
        for (SeatUnit seat : currentSeats) {
            if (seat.getLabel() != null && !seat.getLabel().isBlank()) {
                byLabel.put(seat.getLabel().toUpperCase(Locale.ROOT), seat);
            }
            byPos.put(seat.getRow() + "-" + seat.getCol(), seat);
        }

        List<SeatUnit> seatsToReserve = new ArrayList<>();
        Set<String> requestedKeys = new HashSet<>();

        for (RequestedSeat requested : req.seats) {
            SeatUnit match = resolveSeat(requested, byLabel, byPos);
            if (match == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Seat not found: " + describeSeat(requested));
            }
            String key = match.getRow() + "-" + match.getCol();
            if (!requestedKeys.add(key)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Duplicate seat in request: " + match.getLabel());
            }
            if (match.getState() != SeatStateEnum.AVAILABLE) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Seat not available: " + match.getLabel());
            }
            seatsToReserve.add(match);
        }

        if (seatsToReserve.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one seat must be selected");
        }

        for (SeatUnit seat : seatsToReserve) {
            seat.setState(SeatStateEnum.RESERVED);
        }
        trip.setAvailableSeats((int) currentSeats.stream().filter(s -> s.getState() == SeatStateEnum.AVAILABLE).count());

        try {
            tripRepository.save(trip);
        } catch (OptimisticLockingFailureException e) {
            for (SeatUnit seat : seatsToReserve) {
                seat.setState(SeatStateEnum.AVAILABLE);
            }
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Seat map changed, please try again"));
        }

        int seatCount = seatsToReserve.size();
        BigDecimal unitPrice = trip.getTotalPrice();
        BigDecimal totalAmount = unitPrice != null ? unitPrice.multiply(BigDecimal.valueOf(seatCount)) : null;

        if (req.payment != null && req.payment.amount != null && totalAmount != null && req.payment.amount.compareTo(totalAmount) != 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment amount mismatch. Expected " + totalAmount);
        }

        TicketType ticket = new TicketType();
        ticket.setTripId(trip.getId());
        ticket.setUserId(user.getId());
        ticket.setUser(new TicketType.TicketUserSnapshot(
                user.getId(),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail()));
        ticket.setSeats(seatsToReserve.stream()
                .map(seat -> new TicketType.SeatAssignment(seat.getRow(), seat.getCol(), seat.getLabel()))
                .collect(Collectors.toList()));
        ticket.setStatus(TicketType.TicketStatusEnum.BOOKED);
        ticket.setUnitPrice(unitPrice);
        ticket.setTotalAmount(totalAmount);
        ticket.setCurrency(resolveCurrency(req.payment));
        ticket.setCreatedAt(Instant.now());
        ticket.setUpdatedAt(ticket.getCreatedAt());
        ticket.setExpiresAt(resolveExpiry(req, ticket.getCreatedAt()));
        String reference = generateTicketReference();
        ticket.setReference(reference);
        ticket.setBookingReference(reference);

        if (req.payment != null) {
            TicketType.PaymentSnapshot snapshot = new TicketType.PaymentSnapshot();
            snapshot.setAmount(req.payment.amount);
            snapshot.setCurrency(ticket.getCurrency());
            snapshot.setMethod(req.payment.method);
            snapshot.setProvider(req.payment.provider);
            snapshot.setReference(req.payment.reference);
            ticket.setPayment(snapshot);
        }

        TicketType saved = ticketRepository.save(ticket);
        TicketDocumentView documentView = ticketDocumentService.buildDocument(saved);
        responseEmailDelivery(documentView, user.getEmail());

        Map<String, Object> response = buildTicketResponse(saved, trip, user);
        response.put("document", documentView);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
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
                .map(ticket -> buildTicketResponse(ticket, null, null))
                .toList();
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
        return ResponseEntity.ok(buildTicketResponse(ticket, null, null));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateTicket(@PathVariable String id, @Valid @RequestBody UpdateTicketStatusRequest payload, @AuthenticationPrincipal User principal) {
        TicketType ticket = ticketRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));
        if (!isAdminOrManager(principal)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only admins or managers can update tickets");
        }

        TicketType.TicketStatusEnum previousStatus = ticket.getStatus();
        ticket.setStatus(payload.status);
        ticket.setUpdatedAt(Instant.now());

        if (payload.status == TicketType.TicketStatusEnum.CANCELLED && previousStatus != TicketType.TicketStatusEnum.CANCELLED) {
            releaseSeatsForTicket(ticket);
            ticket.setCancelledAt(Instant.now());
        }
        if (payload.status == TicketType.TicketStatusEnum.PAID && ticket.getPaidAt() == null) {
            ticket.setPaidAt(Instant.now());
            if (ticket.getPayment() != null) {
                ticket.getPayment().setStatus(TicketType.PaymentState.CAPTURED);
                ticket.getPayment().setProcessedAt(Instant.now());
            }
        }

        TicketType saved = ticketRepository.save(ticket);
        if (payload.status == TicketType.TicketStatusEnum.PAID) {
            UserType ticketOwner = userRepository.findById(saved.getUserId()).orElse(null);
            TicketDocumentView documentView = ticketDocumentService.buildDocument(saved);
            responseEmailDelivery(documentView, ticketOwner != null ? ticketOwner.getEmail() : null);
        }
        return ResponseEntity.ok(buildTicketResponse(saved, null, null));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> cancelTicket(@PathVariable String id, @AuthenticationPrincipal User principal) {
        TicketType ticket = ticketRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));

        if (!canManageTicket(ticket, principal)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Not allowed to cancel this ticket"));
        }

        if (ticket.getStatus() == TicketType.TicketStatusEnum.CANCELLED) {
            return ResponseEntity.ok(Map.of("status", "already_cancelled"));
        }

        releaseSeatsForTicket(ticket);
        ticket.setStatus(TicketType.TicketStatusEnum.CANCELLED);
        ticket.setCancelledAt(Instant.now());
        ticket.setUpdatedAt(ticket.getCancelledAt());
        if (ticket.getPayment() != null) {
            ticket.getPayment().setStatus(TicketType.PaymentState.REFUNDED);
            ticket.getPayment().setProcessedAt(Instant.now());
        }

        TicketType saved = ticketRepository.save(ticket);
        return ResponseEntity.ok(buildTicketResponse(saved, null, null));
    }

    private SeatUnit resolveSeat(RequestedSeat requested, Map<String, SeatUnit> byLabel, Map<String, SeatUnit> byPos) {
        if (requested == null) {
            return null;
        }
        if (requested.label != null && !requested.label.isBlank()) {
            SeatUnit byLbl = byLabel.get(requested.label.trim().toUpperCase(Locale.ROOT));
            if (byLbl != null) {
                return byLbl;
            }
        }
        if (requested.row != null && requested.col != null) {
            return byPos.get(requested.row + "-" + requested.col);
        }
        return null;
    }

    private String describeSeat(RequestedSeat seat) {
        if (seat == null) {
            return "unknown";
        }
        if (seat.label != null && !seat.label.isBlank()) {
            return seat.label;
        }
        if (seat.row != null && seat.col != null) {
            return seat.row + "-" + seat.col;
        }
        return "unknown";
    }

    private String resolveCurrency(PaymentRequest payment) {
        if (payment != null && payment.currency != null && !payment.currency.isBlank()) {
            return payment.currency;
        }
        return "TND";
    }

    private Instant resolveExpiry(BookTicketRequest req, Instant createdAt) {
        if (req.holdUntil != null) {
            return req.holdUntil;
        }
        Instant base = createdAt != null ? createdAt : Instant.now();
        return base.plus(Duration.ofMinutes(15));
    }

    private String generateTicketReference() {
        String raw = java.util.UUID.randomUUID().toString().replace("-", "").toUpperCase(Locale.ROOT);
        return raw.substring(0, Math.min(10, raw.length()));
    }

    private Map<String, Object> buildTicketResponse(TicketType ticket, TripType trip, UserType user) {
        TripType resolvedTrip = trip != null ? trip : tripRepository.findById(ticket.getTripId()).orElse(null);
        UserType resolvedUser = user != null ? user : userRepository.findById(ticket.getUserId()).orElse(null);
        AgencyType agency = null;
        if (resolvedTrip != null && resolvedTrip.getAgencyId() != null) {
            agency = agencyRepository.findById(resolvedTrip.getAgencyId()).orElse(null);
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", ticket.getId());
        payload.put("version", ticket.getVersion());
        payload.put("reference", ticket.getReference());
        payload.put("trip", resolvedTrip);
        payload.put("agency", agency);
        payload.put("user", resolvedUser != null ? resolvedUser : ticket.getUser());
        payload.put("status", ticket.getStatus());
        payload.put("seats", ticket.getSeats());
        payload.put("unitPrice", ticket.getUnitPrice());
        payload.put("totalAmount", ticket.getTotalAmount());
        payload.put("currency", ticket.getCurrency());
        payload.put("createdAt", ticket.getCreatedAt() != null ? java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(ticket.getCreatedAt().atOffset(java.time.ZoneOffset.UTC)) : null);
        payload.put("updatedAt", ticket.getUpdatedAt() != null ? java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(ticket.getUpdatedAt().atOffset(java.time.ZoneOffset.UTC)) : null);
        payload.put("expiresAt", ticket.getExpiresAt() != null ? java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(ticket.getExpiresAt().atOffset(java.time.ZoneOffset.UTC)) : null);
        payload.put("cancelledAt", ticket.getCancelledAt() != null ? java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(ticket.getCancelledAt().atOffset(java.time.ZoneOffset.UTC)) : null);
        payload.put("paidAt", ticket.getPaidAt() != null ? java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(ticket.getPaidAt().atOffset(java.time.ZoneOffset.UTC)) : null);
        payload.put("payment", ticket.getPayment());
        return payload;
    }

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

    private void releaseSeatsForTicket(TicketType ticket) {
        TripType trip = tripRepository.findById(ticket.getTripId()).orElse(null);
        if (trip == null || trip.getSeats() == null) {
            return;
        }

        Map<String, SeatUnit> byPos = trip.getSeats().stream()
                .collect(Collectors.toMap(seat -> seat.getRow() + "-" + seat.getCol(), seat -> seat, (a, b) -> a));

        for (TicketType.SeatAssignment assignment : ticket.getSeats()) {
            SeatUnit match = byPos.get(assignment.getRow() + "-" + assignment.getCol());
            if (match != null && match.getState() == SeatStateEnum.RESERVED) {
                match.setState(SeatStateEnum.AVAILABLE);
            }
        }

        trip.setAvailableSeats((int) trip.getSeats().stream().filter(s -> s.getState() == SeatStateEnum.AVAILABLE).count());
        try {
            tripRepository.save(trip);
        } catch (OptimisticLockingFailureException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Unable to release seats, please retry");
        }
    }

    private boolean canViewTicket(TicketType ticket, User principal) {
        if (principal == null) {
            return false;
        }
        if (Objects.equals(principal.getUsername(), ticket.getUserId())) {
            return true;
        }
        return principal.getAuthorities().stream().map(GrantedAuthority::getAuthority).anyMatch(auth -> auth.equals(roleName(RoleEnum.ADMIN)) || auth.equals(roleName(RoleEnum.MANAGER)));
    }

    private boolean canManageTicket(TicketType ticket, User principal) {
        if (principal == null) {
            return false;
        }
        if (Objects.equals(principal.getUsername(), ticket.getUserId())) {
            return true;
        }
        return isAdminOrManager(principal);
    }

    private boolean isAdminOrManager(User principal) {
        if (principal == null) {
            return false;
        }
        return principal.getAuthorities().stream().map(GrantedAuthority::getAuthority).anyMatch(auth -> auth.equals(roleName(RoleEnum.ADMIN)) || auth.equals(roleName(RoleEnum.MANAGER)));
    }

    private String roleName(RoleEnum role) {
        return "ROLE_" + role.name();
    }
}
