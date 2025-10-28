package com.eticketing.app.ticket;

import com.eticketing.app.trip.TripType;
import com.eticketing.app.trip.TripTypeRepository;
import com.eticketing.app.trip.SeatUnit;
import com.eticketing.app.trip.SeatStateEnum;
import com.eticketing.app.user.UserTypeRepository;
import com.eticketing.app.user.UserType;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.User;
import org.springframework.dao.OptimisticLockingFailureException;
import java.util.List;
import java.util.Optional;
import java.util.Map;
import java.util.LinkedHashMap;

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
        public String tripId;
        public int row;
        public int col;
    }

    @PostMapping
    public ResponseEntity<?> bookTicket(@RequestBody BookTicketRequest req, @AuthenticationPrincipal User principal) {
        if (principal == null) return ResponseEntity.status(401).body(Map.of("error", "Authentication required"));
        Optional<UserType> userOpt = userRepository.findById(principal.getUsername());
        if (userOpt.isEmpty()) return ResponseEntity.status(401).body(Map.of("error", "User not found"));
        UserType user = userOpt.get();
        TripType trip = tripRepository.findById(req.tripId).orElse(null);
        if (trip == null) return ResponseEntity.status(404).body(Map.of("error", "Trip not found"));
        if (trip.getSeats() == null || trip.getSeats().isEmpty()) return ResponseEntity.status(400).body(Map.of("error", "Seat map not available"));
        // Find seat
        SeatUnit seat = trip.getSeats().stream().filter(s -> s.getRow() == req.row && s.getCol() == req.col).findFirst().orElse(null);
        if (seat == null) return ResponseEntity.status(404).body(Map.of("error", "Seat not found"));
        if (seat.getState() != SeatStateEnum.AVAILABLE) return ResponseEntity.status(409).body(Map.of("error", "Seat not available"));
        // Mark seat as RESERVED
        seat.setState(SeatStateEnum.RESERVED);
        trip.setAvailableSeats(Math.max(0, trip.getAvailableSeats() - 1));
        try {
            tripRepository.save(trip);
        } catch (OptimisticLockingFailureException e) {
            return ResponseEntity.status(409).body(Map.of("error", "Seat map changed, please try again"));
        }
        // Create ticket
        TicketType ticket = new TicketType();
        ticket.setTripId(trip.getId());
        ticket.setUserId(user.getId());
        ticket.setSeatNumber(req.row * 100 + req.col); // Unique seat number encoding
        ticket.setStatus(TicketType.TicketStatusEnum.BOOKED);
        ticket.setCreatedAt(java.time.Instant.now());
        TicketType saved = ticketRepository.save(ticket);
        // Return ticket with trip and seat info
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("ticketId", saved.getId());
        resp.put("tripId", trip.getId());
        resp.put("userId", user.getId());
        resp.put("seat", Map.of("row", req.row, "col", req.col));
        resp.put("status", saved.getStatus());
        resp.put("createdAt", saved.getCreatedAt());
        resp.put("trip", Map.of(
            "id", trip.getId(),
            "departureDate", trip.getDepartureDate(),
            "price", trip.getPrice(),
            "availableSeats", trip.getAvailableSeats()
        ));
        return ResponseEntity.ok(resp);
    }

    @GetMapping
    public List<TicketType> getAllTickets() {
        return ticketRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<TicketType> getTicket(@PathVariable String id) {
        Optional<TicketType> ticket = ticketRepository.findById(id);
        return ticket.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    public ResponseEntity<TicketType> updateTicket(@PathVariable String id, @RequestBody TicketType update) {
        Optional<TicketType> ticketOpt = ticketRepository.findById(id);
        if (ticketOpt.isEmpty()) return ResponseEntity.notFound().build();
        TicketType ticket = ticketOpt.get();
        // Update fields as needed
        ticket.setStatus(update.getStatus());
        TicketType saved = ticketRepository.save(ticket);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> cancelTicket(@PathVariable String id) {
        if (!ticketRepository.existsById(id)) return ResponseEntity.notFound().build();
        ticketRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }
}
