package com.eticketing.app.ticket;

import com.eticketing.app.user.UserTypeRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FrontofficeBookingServiceTest {

    @Mock
    private BookingService bookingService;

    @Mock
    private TicketRepository ticketRepository;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private RefundRepository refundRepository;

    @Mock
    private UserTypeRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private FrontofficeBookingService frontofficeBookingService;

    @Test
    void getOccupiedSeatsUsesTripWideSeatQueryLikeTerminal() {
        when(ticketRepository.findOccupiedSeatsByTripId("trip-1")).thenReturn(List.of(
                TicketType.builder().seatNo(" 5 ").build(),
                TicketType.builder().seatNo("5").build(),
                TicketType.builder().seatNo("A1").build(),
                TicketType.builder().seatNo(" ").build(),
                TicketType.builder().seatNo(null).build()));

        List<String> occupiedSeats = frontofficeBookingService.getOccupiedSeats("trip-1", "origin", "destination");

        assertEquals(List.of("5", "A1"), occupiedSeats);
        verify(ticketRepository).findOccupiedSeatsByTripId("trip-1");
    }
}
