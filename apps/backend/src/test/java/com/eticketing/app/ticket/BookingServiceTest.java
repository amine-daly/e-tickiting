package com.eticketing.app.ticket;

import com.eticketing.app.currency.CurrencyRepository;
import com.eticketing.app.trip.TripTypeRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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
import static org.junit.jupiter.api.Assertions.assertFalse;
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
    private OrderRepository orderRepository;

    @Mock
    private SeatReservationService seatReservationService;

    @Mock
    private CurrencyRepository currencyRepository;

    @Mock
    private RefundRepository refundRepository;

    @Mock
    private BookingEmailNotifier bookingEmailNotifier;

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

        @Test
        void cancelOrderTicketExpiresPendingMemberAndKeepsOrderActive() {
        OrderType order = OrderType.builder()
            .id("order-1")
            .status(OrderStatusEnum.PENDING)
            .ticketIds(List.of("ticket-1", "ticket-2"))
            .passengers(List.of(
                OrderType.OrderPassenger.builder().ticketId("ticket-1").firstName("Alice").build(),
                OrderType.OrderPassenger.builder().ticketId("ticket-2").firstName("Bob").build()))
            .totalPrice(BigDecimal.valueOf(40))
            .build();
        TicketType expiredMember = TicketType.builder()
            .id("ticket-1")
            .tripId("trip-1")
            .segmentIds(List.of("seg-1", "seg-2"))
            .appliedPrice(BigDecimal.valueOf(20))
            .status(TicketStatusEnum.PENDING)
            .build();
        TicketType activeMember = TicketType.builder()
            .id("ticket-2")
            .tripId("trip-1")
            .segmentIds(List.of("seg-1", "seg-2"))
            .appliedPrice(BigDecimal.valueOf(20))
            .status(TicketStatusEnum.PENDING)
            .build();

        when(orderRepository.findById("order-1")).thenReturn(Optional.of(order));
        when(ticketRepository.findByOrderId("order-1")).thenReturn(List.of(expiredMember, activeMember));
        when(ticketRepository.save(any(TicketType.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(orderRepository.save(any(OrderType.class))).thenAnswer(invocation -> invocation.getArgument(0));

        OrderType result = bookingService.cancelOrderTicket("order-1", "ticket-1", refundRepository);

        assertEquals(OrderStatusEnum.PENDING, result.getStatus());
        assertEquals(BigDecimal.valueOf(20), result.getTotalPrice());
        assertEquals(List.of("ticket-2"), result.getTicketIds());
        assertEquals(1, result.getPassengers().size());
        assertEquals(TicketStatusEnum.EXPIRED, expiredMember.getStatus());
        assertNotNull(expiredMember.getExpiresAt());
        verify(seatReservationService).releaseSeats("trip-1", List.of("seg-1", "seg-2"));
        verify(refundRepository, never()).save(any(RefundType.class));
        }

        @Test
        void cancelOrderTicketCancelsConfirmedMemberReleasesSeatAndFlagsRefund() {
        OrderType order = OrderType.builder()
            .id("order-2")
            .status(OrderStatusEnum.CONFIRMED)
            .ticketIds(List.of("ticket-3", "ticket-4"))
            .passengers(List.of(
                OrderType.OrderPassenger.builder().ticketId("ticket-3").firstName("Alice").build(),
                OrderType.OrderPassenger.builder().ticketId("ticket-4").firstName("Bob").build()))
            .totalPrice(BigDecimal.valueOf(44))
            .build();
        TicketType cancelledMember = TicketType.builder()
            .id("ticket-3")
            .tripId("trip-9")
            .segmentIds(List.of("seg-9"))
            .appliedPrice(BigDecimal.valueOf(22))
            .currency("TND")
            .status(TicketStatusEnum.CONFIRMED)
            .build();
        TicketType activeMember = TicketType.builder()
            .id("ticket-4")
            .tripId("trip-9")
            .segmentIds(List.of("seg-9"))
            .appliedPrice(BigDecimal.valueOf(22))
            .currency("TND")
            .status(TicketStatusEnum.CONFIRMED)
            .build();

        when(orderRepository.findById("order-2")).thenReturn(Optional.of(order));
        when(ticketRepository.findByOrderId("order-2")).thenReturn(List.of(cancelledMember, activeMember));
        when(ticketRepository.save(any(TicketType.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(orderRepository.save(any(OrderType.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(refundRepository.save(any(RefundType.class))).thenAnswer(invocation -> invocation.getArgument(0));

        OrderType result = bookingService.cancelOrderTicket("order-2", "ticket-3", refundRepository);

        ArgumentCaptor<RefundType> refundCaptor = ArgumentCaptor.forClass(RefundType.class);

        assertEquals(OrderStatusEnum.CONFIRMED, result.getStatus());
        assertEquals(BigDecimal.valueOf(22), result.getTotalPrice());
        assertEquals(List.of("ticket-4"), result.getTicketIds());
        assertEquals(1, result.getPassengers().size());
        assertEquals(TicketStatusEnum.CANCELLED, cancelledMember.getStatus());
        assertNotNull(cancelledMember.getCancelledAt());
        verify(seatReservationService).releaseSeats("trip-9", List.of("seg-9"));
        verify(refundRepository).save(refundCaptor.capture());
        assertTrue(refundCaptor.getValue().isSeatReleased());
        assertNotNull(refundCaptor.getValue().getSeatReleasedAt());
        assertFalse(refundCaptor.getValue().getSegmentsRefunded().isEmpty());
        }
}
