package com.eticketing.app.trip;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Embedded stop within a Trip's stopSchedule.
 * <p>
 * Stop type is derived from flags — NO {@code isCommercialStop} field:
 * <ul>
 * <li>boarding=true + dropping=false → Origin</li>
 * <li>boarding=false + dropping=true → Destination</li>
 * <li>boarding=true + dropping=true → Intermediate commercial</li>
 * <li>boarding=false + dropping=false → Technical stop (skipped in segment
 * generation)</li>
 * </ul>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StopType {

    /**
     * Reference to a Place entity.
     */
    private String placeId;

    /**
     * Strictly ascending, unique per trip.
     */
    private int sequence;

    /**
     * UTC — null for first stop only.
     */
    private Instant arrivalTime;

    /**
     * UTC — null for last stop only.
     */
    private Instant departureTime;

    /**
     * Whether passengers may board at this stop.
     */
    private boolean boardingAllowed;

    /**
     * Whether passengers may alight at this stop.
     */
    private boolean droppingAllowed;
}
