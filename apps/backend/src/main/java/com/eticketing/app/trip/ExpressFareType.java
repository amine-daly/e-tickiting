package com.eticketing.app.trip;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Express fare — a pricing overlay over a continuous chain of segments. Zero
 * inventory (no maxSeats / bookedSeats). No currency field — inherited from
 * trip.currency.
 * <p>
 * {@code totalDistanceKm} and {@code totalDurationMinutes} are computed at read
 * time from covered segments — NOT stored in the DB.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExpressFareType {

    /**
     * System-generated UUID.
     */
    private String expressId;

    /**
     * Must match fromPlaceId of the first covered segment.
     */
    private String fromPlaceId;

    /**
     * Must match toPlaceId of the last covered segment.
     */
    private String toPlaceId;

    /**
     * Ordered segment IDs forming a continuous chain.
     */
    private List<String> segmentsCovered;

    /**
     * Price in trip.currency.
     */
    private BigDecimal price;

    /**
     * Null = active immediately.
     */
    private Instant validFrom;

    /**
     * Null = no expiry.
     */
    private Instant validUntil;

    /**
     * Can be deactivated without deletion.
     */
    private boolean active;
}
