package com.eticketing.app.trip;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Segment — inventory unit between two consecutive commercial stops.
 * Auto-generated at trip creation, frozen afterwards.
 * <p>
 * No {@code active} field — segments always exist once created. No
 * {@code currency} field — inherited from {@code trip.currency}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SegmentType {

    /**
     * System-generated UUID.
     */
    private String segmentId;

    /**
     * Strictly ascending, 1-indexed.
     */
    private int sequence;

    /**
     * PlaceId of the departure commercial stop.
     */
    private String fromPlaceId;

    /**
     * PlaceId of the arrival commercial stop.
     */
    private String toPlaceId;

    /**
     * UTC — derived from stopSchedule at creation.
     */
    private Instant departureTime;

    /**
     * UTC — derived from stopSchedule at creation.
     */
    private Instant arrivalTime;

    /**
     * Admin-defined ceiling, must be <= bus.totalSeats.
     */
    private int maxSeats;

    /**
     * Starts at 0, incremented via atomic CAS.
     */
    private int bookedSeats;

    /**
     * In trip.currency.
     */
    private BigDecimal basePrice;

    /**
     * Physical distance data.
     */
    private double distanceKm;

    /**
     * Physical duration data.
     */
    private int durationMinutes;
}
