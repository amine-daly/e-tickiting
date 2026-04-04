package com.eticketing.app.trip.dto;

import jakarta.validation.constraints.PositiveOrZero;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * DTO for updating mutable fields of an express fare. Cannot change:
 * segmentsCovered, fromPlaceId, toPlaceId.
 */
@Data
public class ExpressFareUpdateRequest {

    @PositiveOrZero
    private BigDecimal price;

    private Instant validFrom;
    private Instant validUntil;
    private Boolean active;
}
