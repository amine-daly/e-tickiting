package com.eticketing.app.ticket;

import com.eticketing.app.web.error.ApiExceptions.NotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RefundServiceTest {

    @Mock
    private RefundRepository refundRepository;

    @Mock
    private TicketRepository ticketRepository;

    @Mock
    private SeatReservationService seatReservationService;

    @InjectMocks
    private RefundService refundService;

    @Test
    void approveReleasesSeatWhenRefundWasNotReleasedYet() {
        RefundType refund = RefundType.builder()
                .id("refund-1")
                .ticketId("ticket-1")
                .segmentsRefunded(List.of("seg-1"))
                .status(RefundStatusEnum.REQUESTED)
                .build();
        TicketType ticket = TicketType.builder()
                .id("ticket-1")
                .tripId("trip-1")
                .build();

        when(refundRepository.findById("refund-1")).thenReturn(Optional.of(refund));
        when(ticketRepository.findById("ticket-1")).thenReturn(Optional.of(ticket));
        when(refundRepository.save(refund)).thenReturn(refund);

        RefundType result = refundService.approve("refund-1");

        assertEquals(RefundStatusEnum.APPROVED, result.getStatus());
        assertNotNull(result.getProcessedAt());
        assertNotNull(result.getSeatReleasedAt());
        verify(seatReservationService).releaseSeats("trip-1", List.of("seg-1"));
    }

    @Test
    void approveSkipsSeatReleaseWhenRefundWasAlreadyReleased() {
        RefundType refund = RefundType.builder()
                .id("refund-2")
                .ticketId("ticket-2")
                .segmentsRefunded(List.of("seg-2"))
                .status(RefundStatusEnum.REQUESTED)
                .seatReleased(true)
                .seatReleasedAt(Instant.parse("2026-04-23T12:00:00Z"))
                .build();

        when(refundRepository.findById("refund-2")).thenReturn(Optional.of(refund));
        when(refundRepository.save(refund)).thenReturn(refund);

        RefundType result = refundService.approve("refund-2");

        assertEquals(RefundStatusEnum.APPROVED, result.getStatus());
        assertNotNull(result.getProcessedAt());
        assertEquals(Instant.parse("2026-04-23T12:00:00Z"), result.getSeatReleasedAt());
        verify(seatReservationService, never()).releaseSeats("trip-2", List.of("seg-2"));
        verify(ticketRepository, never()).findById("ticket-2");
    }
}