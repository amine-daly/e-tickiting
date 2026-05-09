package com.eticketing.app.trip;

import com.eticketing.app.web.error.ApiExceptions.BadRequestException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ExpressSegmentValidatorTest {

    @Test
    void validateRejectsSingleSegmentChain() {
        ExpressSegmentType expressSegment = ExpressSegmentType.builder()
                .expressSegmentId("express-1")
                .fromPlace(TripPlaceRef.of("A"))
                .toPlace(TripPlaceRef.of("B"))
                .segmentsCovered(List.of("seg-1"))
                .price(BigDecimal.TEN)
                .active(true)
                .build();

        BadRequestException error = assertThrows(BadRequestException.class,
                () -> ExpressSegmentValidator.validate(expressSegment, List.of(segment("seg-1", 1, "A", "B"))));

        assertTrue(error.getMessage().contains("at least two segments"));
    }

    @Test
    void validateAcceptsContinuousMultiSegmentChain() {
        ExpressSegmentType expressSegment = ExpressSegmentType.builder()
                .expressSegmentId("express-2")
                .fromPlace(TripPlaceRef.of("A"))
                .toPlace(TripPlaceRef.of("C"))
                .segmentsCovered(List.of("seg-1", "seg-2"))
                .price(BigDecimal.valueOf(22))
                .active(true)
                .build();

        assertDoesNotThrow(() -> ExpressSegmentValidator.validate(expressSegment, List.of(
                segment("seg-1", 1, "A", "B"),
                segment("seg-2", 2, "B", "C"))));
    }

    private SegmentType segment(String segmentId, int sequence, String originPlaceId, String destinationPlaceId) {
        return SegmentType.builder()
                .segmentId(segmentId)
                .sequence(sequence)
                .fromPlace(TripPlaceRef.of(originPlaceId))
                .toPlace(TripPlaceRef.of(destinationPlaceId))
                .basePrice(BigDecimal.TEN)
                .build();
    }
}
