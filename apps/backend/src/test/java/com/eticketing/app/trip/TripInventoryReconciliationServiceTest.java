package com.eticketing.app.trip;

import com.eticketing.app.ticket.TicketRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TripInventoryReconciliationServiceTest {

    @Mock
    private TripTypeRepository tripRepository;

    @Mock
    private TicketRepository ticketRepository;

    @InjectMocks
    private TripInventoryReconciliationService reconciliationService;

    @Test
    void reconcileDeactivatesExpiredExpressSegmentsAndPersistsTrip() {
        TripType trip = TripType.builder()
                .id("trip-1")
                .segments(List.of(segment("seg-1", 2)))
                .expressSegments(List.of(
                        expressSegment("express-1", true, Instant.parse("2000-01-01T00:00:00Z"), 3)))
                .build();

        when(ticketRepository.findByTripIdInAndStatusIn(anyList(), anyList())).thenReturn(List.of());

        reconciliationService.reconcile(List.of(trip));

        assertEquals(0, trip.getSegments().get(0).getBookedCount());
        assertEquals(0, trip.getExpressSegments().get(0).getBookedCount());
        assertFalse(trip.getExpressSegments().get(0).isActive());
        verify(tripRepository).saveAll(List.of(trip));
    }

    @Test
    void deactivateExpiredExpressSegmentsOnlyPersistsTripsWithExpiredActiveSegments() {
        TripType expiredTrip = TripType.builder()
                .id("trip-expired")
                .expressSegments(List.of(
                        expressSegment("express-expired", true, Instant.parse("2000-01-01T00:00:00Z"), 1),
                        expressSegment("express-future", true, Instant.parse("2999-01-01T00:00:00Z"), 0)))
                .build();
        TripType alreadyInactiveTrip = TripType.builder()
                .id("trip-inactive")
                .expressSegments(List.of(
                        expressSegment("express-inactive", false, Instant.parse("2000-01-01T00:00:00Z"), 2)))
                .build();

        when(tripRepository.findByActiveExpressSegmentsExpiredBefore(any(Instant.class)))
                .thenReturn(List.of(expiredTrip, alreadyInactiveTrip));

        int deactivatedSegments = reconciliationService.deactivateExpiredExpressSegments();

        assertEquals(1, deactivatedSegments);
        assertFalse(expiredTrip.getExpressSegments().get(0).isActive());
        assertTrue(expiredTrip.getExpressSegments().get(1).isActive());
        assertFalse(alreadyInactiveTrip.getExpressSegments().get(0).isActive());
        verify(tripRepository).saveAll(List.of(expiredTrip));
    }

    private SegmentType segment(String segmentId, int bookedCount) {
        return SegmentType.builder()
                .segmentId(segmentId)
                .sequence(1)
                .fromPlaceId("A")
                .toPlaceId("B")
                .basePrice(BigDecimal.TEN)
                .maxBooking(20)
                .bookedCount(bookedCount)
                .build();
    }

    private ExpressSegmentType expressSegment(String expressSegmentId, boolean active, Instant validUntil, int bookedCount) {
        return ExpressSegmentType.builder()
                .expressSegmentId(expressSegmentId)
                .fromPlaceId("A")
                .toPlaceId("C")
                .segmentsCovered(List.of("seg-1", "seg-2"))
                .price(BigDecimal.valueOf(25))
                .bookedCount(bookedCount)
                .validUntil(validUntil)
                .active(active)
                .build();
    }
}
