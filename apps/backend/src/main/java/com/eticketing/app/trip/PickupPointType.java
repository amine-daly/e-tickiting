package com.eticketing.app.trip;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Pickup point at a boarding-allowed stop. Every stop with
 * {@code boardingAllowed=true} must have at least one.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PickupPointType {

    /**
     * Unique per trip, system-generated UUID.
     */
    private String pointId;

    /**
     * Must match a placeId in stopSchedule with boardingAllowed=true.
     */
    private String placeId;

    /**
     * Human-readable address.
     */
    private String address;

    /**
     * UTC — must align with stop schedule.
     */
    private Instant scheduledDepartureTime;

    /**
     * Can be deactivated without affecting existing tickets.
     */
    private boolean active;

    /**
     * Optional geo coordinates.
     */
    private GeoLocation location;
}
