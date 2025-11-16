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

import com.eticketing.app.trip.SeatStateEnum;
import com.eticketing.app.trip.SeatUnit;
import com.eticketing.app.trip.TripType;
import com.eticketing.app.trip.TripTypeRepository;
import com.eticketing.app.user.RoleType;
import com.eticketing.app.user.UserType;
import com.eticketing.app.user.UserTypeRepository;

@RestController
@RequestMapping("/api/tickets")
public class TicketController {

    @Autowired
    private TicketRepository ticketRepository;
    @Autowired
    private TripTypeRepository tripRepository;
    @Autowired
    private UserTypeRepository userRepository;

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
        BigDecimal unitPrice = trip.getPrice();
        BigDecimal totalAmount = unitPrice != null ? unitPrice.multiply(BigDecimal.valueOf(seatCount)) : null;

        if (req.payment != null && req.payment.amount != null && totalAmount != null && req.payment.amount.compareTo(totalAmount) != 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment amount mismatch. Expected " + totalAmount);
        }

        TicketType ticket = new TicketType();
        ticket.setTripId(trip.getId());
        ticket.setUserId(user.getId());
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
        ticket.setBookingReference(generateBookingReference());

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

        Map<String, Object> response = buildTicketResponse(saved, trip, user);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public List<TicketType> getAllTickets() {
        return ticketRepository.findAll();
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
        return ResponseEntity.ok(ticket);
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
        return ResponseEntity.ok(saved);
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
        return ResponseEntity.ok(saved);
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

    private String generateBookingReference() {
        String raw = java.util.UUID.randomUUID().toString().replace("-", "").toUpperCase(Locale.ROOT);
        return raw.substring(0, Math.min(10, raw.length()));
    }

    private Map<String, Object> buildTicketResponse(TicketType ticket, TripType trip, UserType user) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("ticketId", ticket.getId());
        payload.put("bookingReference", ticket.getBookingReference());
        payload.put("tripId", ticket.getTripId());
        payload.put("userId", ticket.getUserId());
        payload.put("status", ticket.getStatus());
        payload.put("seats", ticket.getSeats());
        payload.put("unitPrice", ticket.getUnitPrice());
        payload.put("totalAmount", ticket.getTotalAmount());
        payload.put("currency", ticket.getCurrency());
        payload.put("createdAt", ticket.getCreatedAt());
        payload.put("expiresAt", ticket.getExpiresAt());
        payload.put("payment", ticket.getPayment());
        payload.put("user", Map.of(
                "id", user.getId(),
                "firstName", user.getFirstName(),
                "lastName", user.getLastName(),
                "email", user.getEmail()
        ));
        payload.put("trip", Map.of(
                "id", trip.getId(),
                "departureDate", trip.getDepartureDate(),
                "departureDateTime", trip.getDepartureDateTime(),
                "price", trip.getPrice(),
                "availableSeats", trip.getAvailableSeats()
        ));
        return payload;
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
        return principal.getAuthorities().stream().map(GrantedAuthority::getAuthority).anyMatch(auth -> auth.equals(roleName(RoleType.ADMIN)) || auth.equals(roleName(RoleType.MANAGER)));
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
        return principal.getAuthorities().stream().map(GrantedAuthority::getAuthority).anyMatch(auth -> auth.equals(roleName(RoleType.ADMIN)) || auth.equals(roleName(RoleType.MANAGER)));
    }

    private String roleName(RoleType role) {
        return "ROLE_" + role.name();
    }
}
