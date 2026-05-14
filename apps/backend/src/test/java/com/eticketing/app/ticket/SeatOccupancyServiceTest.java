package com.eticketing.app.ticket;

import com.eticketing.app.web.error.ApiExceptions.ConflictException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SeatOccupancyServiceTest {

    @Mock
    private SeatOccupancyRepository seatOccupancyRepository;

    @Mock
    private TicketRepository ticketRepository;

    @InjectMocks
    private SeatOccupancyService seatOccupancyService;

    @Test
    void reserveTicketSeatRejectsOverlapWithLegacyActiveTicket() {
        TicketType existingTicket = TicketType.builder()
                .id("legacy-1")
                .tripId("trip-1")
                .seatNo("A1")
                .segmentIds(List.of("seg-1"))
                .status(TicketStatusEnum.CONFIRMED)
                .build();
        TicketType requestedTicket = TicketType.builder()
                .id("new-1")
                .tripId("trip-1")
                .seatNo("A1")
                .segmentIds(List.of("seg-1"))
                .build();

        when(ticketRepository.findByTripIdAndSeatNoAndStatusIn(
                "trip-1",
                "A1",
                List.of(TicketStatusEnum.PENDING, TicketStatusEnum.CONFIRMED)))
                .thenReturn(List.of(existingTicket));

        ConflictException error = assertThrows(
                ConflictException.class,
                () -> seatOccupancyService.reserveTicketSeat(requestedTicket));

        assertEquals("SEAT_ALREADY_TAKEN", error.getCode());
        verify(seatOccupancyRepository, never()).save(any());
    }

    @Test
    void findOccupiedSeatsForSegmentsIncludesLegacyTicketsWithoutOccupancyRows() {
        when(seatOccupancyRepository.findByTripIdAndSegmentIdIn("trip-1", List.of("seg-1")))
                .thenReturn(List.of(
                        SeatOccupancyType.builder().seatNo("B2").build(),
                        SeatOccupancyType.builder().seatNo("B2").build()));
        when(ticketRepository.findByTripIdAndStatusIn(
                "trip-1",
                List.of(TicketStatusEnum.PENDING, TicketStatusEnum.CONFIRMED)))
                .thenReturn(List.of(
                        TicketType.builder().seatNo("A1").segmentIds(List.of("seg-1")).build(),
                        TicketType.builder().seatNo("C3").segmentIds(List.of()).build(),
                        TicketType.builder().seatNo("D4").segmentIds(List.of("seg-9")).build()));

        List<String> occupiedSeats = seatOccupancyService.findOccupiedSeatsForSegments("trip-1", List.of("seg-1"));

        assertEquals(List.of("A1", "B2", "C3"), occupiedSeats);
    }
}
