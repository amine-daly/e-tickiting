package com.eticketing.app.ticket;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.eticketing.app.common.TargetInput;
import com.eticketing.app.place.PlaceRepository;
import com.eticketing.app.trip.TripTypeRepository;
import com.eticketing.app.user.UserTypeRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.User;

@ExtendWith(MockitoExtension.class)
class TicketControllerTest {

    @Mock
    private TicketRepository ticketRepository;

    @Mock
    private TripTypeRepository tripRepository;

    @Mock
    private PlaceRepository placeRepository;

    @Mock
    private UserTypeRepository userRepository;

    @Mock
    private TicketDocumentService ticketDocumentService;

    @Mock
    private TicketEmailService ticketEmailService;

    @Mock
    private SeatReservationService seatReservationService;

    @Mock
    private OrderRepository orderRepository;

    @InjectMocks
    private TicketController ticketController;

    @Test
    void getTicketByReferenceReturnsTicketWhenReferenceMatches() {
        TicketType ticket = ticket("ticket-1", "REF-100", "LEGACY-1", "passenger-1");
        ticket.setScannedBy("agent-1");
        ticket.setScannedAt(java.time.Instant.parse("2026-05-30T10:15:30Z"));
        User principal = new User("passenger-1", "secret", List.of());

        when(ticketRepository.findByReference("REF-100")).thenReturn(Optional.of(ticket));
        when(tripRepository.findById("trip-1")).thenReturn(Optional.empty());
        when(userRepository.findById("passenger-1")).thenReturn(Optional.empty());

        ResponseEntity<?> response = ticketController.getTicketByReference("REF-100", principal);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<?, ?> payload = assertInstanceOf(Map.class, response.getBody());
        assertEquals("ticket-1", payload.get("id"));
        assertEquals("REF-100", payload.get("reference"));
        assertEquals("agent-1", payload.get("scannedBy"));
        verify(ticketRepository, never()).findByIdempotencyKey("REF-100");
    }

    @Test
    void getTicketByReferenceFallsBackToLegacyIdempotencyKey() {
        TicketType ticket = ticket("ticket-2", "REF-200", "LEGACY-200", "passenger-2");
        User principal = new User("passenger-2", "secret", List.of());

        when(ticketRepository.findByReference("LEGACY-200")).thenReturn(Optional.empty());
        when(ticketRepository.findByIdempotencyKey("LEGACY-200")).thenReturn(Optional.of(ticket));
        when(tripRepository.findById("trip-1")).thenReturn(Optional.empty());
        when(userRepository.findById("passenger-2")).thenReturn(Optional.empty());

        ResponseEntity<?> response = ticketController.getTicketByReference("LEGACY-200", principal);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<?, ?> payload = assertInstanceOf(Map.class, response.getBody());
        assertEquals("REF-200", payload.get("reference"));
        verify(ticketRepository).findByIdempotencyKey("LEGACY-200");
    }

    @Test
    void getTicketByReferenceRejectsUnauthorizedViewer() {
        TicketType ticket = ticket("ticket-3", "REF-300", "LEGACY-300", "passenger-3");
        User principal = new User("another-user", "secret", List.of());

        when(ticketRepository.findByReference("REF-300")).thenReturn(Optional.of(ticket));
        when(userRepository.findById("another-user")).thenReturn(Optional.empty());

        ResponseEntity<?> response = ticketController.getTicketByReference("REF-300", principal);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        Map<?, ?> payload = assertInstanceOf(Map.class, response.getBody());
        assertEquals("Access denied", payload.get("error"));
    }

    private TicketType ticket(String id, String reference, String idempotencyKey, String passengerId) {
        return TicketType.builder()
                .id(id)
                .reference(reference)
                .idempotencyKey(idempotencyKey)
                .tripId("trip-1")
                .passengerId(passengerId)
                .target(new TargetInput("company-1", "pos-1"))
                .appliedPrice(BigDecimal.TEN)
                .currency("EUR")
                .build();
    }
}
