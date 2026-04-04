package com.eticketing.app.trip;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Dropoff point at a dropping-allowed stop. Every stop with
 * {@code droppingAllowed=true} must have at least one.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DropoffPointType {

    /**
     * Unique per trip, system-generated UUID.
     */
    private String pointId;

    /**
     * Must match a placeId in stopSchedule with droppingAllowed=true.
     */
    private String placeId;

    /**
     * Human-readable address.
     */
    private String address;

    /**
     * UTC — must align with stop schedule.
     */
    private Instant scheduledArrivalTime;

    /**
     * Can be deactivated without affecting existing tickets.
     */
    private boolean active;

    /**
     * Optional geo coordinates.
     */
    private GeoLocation location;
}
