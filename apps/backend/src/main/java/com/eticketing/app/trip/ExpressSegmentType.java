package com.eticketing.app.trip;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Express segment — a route-level contract over a continuous chain of segments.
 * Inventory is tracked only via {@code bookedCount}; there is no
 * express-segment-specific {@code maxBooking}. No currency field — inherited
 * from trip.currency.
 * <p>
 * {@code totalDistanceKm} and {@code totalDurationMinutes} are computed at read
 * time from covered segments — NOT stored in the DB.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExpressSegmentType {

    /**
     * System-generated UUID.
     */
    private String expressSegmentId;

    /**
     * Must match the first covered segment's departure place.
     */
    private TripPlaceRef fromPlace;

    /**
     * Must match the last covered segment's arrival place.
     */
    private TripPlaceRef toPlace;

    /**
     * Ordered segment IDs forming a continuous chain.
     */
    private List<String> segmentsCovered;

    /**
     * Price in trip.currency.
     */
    private BigDecimal price;

    /**
     * Starts at 0, incremented atomically for bookings using this express
     * segment.
     */
    private int bookedCount;

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
