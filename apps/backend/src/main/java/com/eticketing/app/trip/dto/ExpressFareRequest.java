package com.eticketing.app.trip.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * DTO for adding an express fare to a trip. {@code segmentIds} references
 * existing segment IDs on the trip.
 */
@Data
public class ExpressFareRequest {

    @NotBlank
    private String fromPlaceId;

    @NotBlank
    private String toPlaceId;

    @NotEmpty
    private List<String> segmentIds;

    @NotNull
    @PositiveOrZero
    private BigDecimal price;

    private Instant validFrom;
    private Instant validUntil;
    private Boolean active;
}
