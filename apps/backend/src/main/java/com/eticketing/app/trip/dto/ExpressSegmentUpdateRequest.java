package com.eticketing.app.trip.dto;

import jakarta.validation.constraints.PositiveOrZero;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * DTO for updating mutable fields of an express segment. Cannot change:
 * segmentsCovered, fromPlace, toPlace.
 */
@Data
public class ExpressSegmentUpdateRequest {

    @PositiveOrZero
    private BigDecimal price;

    private Instant validFrom;
    private Instant validUntil;
    private Boolean active;
}
