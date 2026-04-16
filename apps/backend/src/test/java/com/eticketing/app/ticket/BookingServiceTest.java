package com.eticketing.app.ticket;

import com.eticketing.app.currency.CurrencyRepository;
import com.eticketing.app.trip.TripTypeRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingServiceTest {

    @Mock
    private TripTypeRepository tripRepository;

    @Mock
    private TicketRepository ticketRepository;

    @Mock
    private SeatReservationService seatReservationService;

    @Mock
    private CurrencyRepository currencyRepository;

    @Mock
    private RefundRepository refundRepository;

    @InjectMocks
    private BookingService bookingService;

    @Test
    void cancelBookingExpiresPendingTicketAndReleasesSeats() {
        Instant futureExpiry = Instant.parse("2099-04-15T18:00:00Z");
        TicketType pendingTicket = TicketType.builder()
                .id("ticket-1")
                .tripId("trip-1")
                .segmentIds(List.of("seg-1", "seg-2"))
                .status(TicketStatusEnum.PENDING)
                .expiresAt(futureExpiry)
                .build();

        when(ticketRepository.findById("ticket-1")).thenReturn(Optional.of(pendingTicket));
        when(ticketRepository.save(any(TicketType.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TicketType result = bookingService.cancelBooking("ticket-1", refundRepository);

        assertEquals(TicketStatusEnum.EXPIRED, result.getStatus());
        assertNotNull(result.getExpiresAt());
        assertTrue(result.getExpiresAt().isBefore(futureExpiry));
        verify(seatReservationService).releaseSeats("trip-1", List.of("seg-1", "seg-2"));
        verify(refundRepository, never()).save(any(RefundType.class));
    }

    @Test
    void cancelBookingCancelsConfirmedTicketAndCreatesRefund() {
        TicketType confirmedTicket = TicketType.builder()
                .id("ticket-2")
                .tripId("trip-9")
                .segmentIds(List.of("seg-9"))
                .appliedPrice(BigDecimal.valueOf(22))
                .currency("TND")
                .status(TicketStatusEnum.CONFIRMED)
                .build();

        when(ticketRepository.findById("ticket-2")).thenReturn(Optional.of(confirmedTicket));
        when(ticketRepository.save(any(TicketType.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(refundRepository.save(any(RefundType.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TicketType result = bookingService.cancelBooking("ticket-2", refundRepository);

        assertEquals(TicketStatusEnum.CANCELLED, result.getStatus());
        assertNotNull(result.getCancelledAt());
        verify(refundRepository).save(any(RefundType.class));
        verify(seatReservationService, never()).releaseSeats(any(), any());
    }
}
