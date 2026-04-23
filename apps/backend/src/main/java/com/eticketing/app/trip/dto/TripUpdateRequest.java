package com.eticketing.app.trip.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Data;

import java.time.Instant;
import java.util.List;

/**
 * DTO for trip update — only mutable fields per TRIP_SPEC section 12. Null
 * fields are treated as "no change".
 * <p>
 * Segments array is NEVER accepted here (frozen at creation).
 */
@Data
public class TripUpdateRequest {

    // ── Identity fields (SCHEDULED: free, ACTIVE: blocked) ──────────────
    private Instant departureDate;
    private String timezone;
    private String currencyId;

    // ── Bus reassignment (ACTIVE: capacity check required) ──────────────
    @Valid
    private BusInput bus;

    // ── Stop Schedule (SCHEDULED: free, ACTIVE: restricted) ─────────────
    @Valid
    private List<StopInput> stopSchedule;

    // ── Pickup/Dropoff (always allowed) ─────────────────────────────────
    @Valid
    private List<PickupPointInput> pickupPoints;
    @Valid
    private List<DropoffPointInput> dropoffPoints;

    // ── Status transition ───────────────────────────────────────────────
    private String status;

    // ── Nested types (reuse from create) ────────────────────────────────
    @Data
    public static class BusInput {

        @NotBlank
        private String busId;
    }

    @Data
    public static class StopInput {

        @NotBlank
        private String placeId;
        @NotNull
        private Integer sequence;
        private Instant arrivalTime;
        private Instant departureTime;
        @NotNull
        private Boolean boardingAllowed;
        @NotNull
        private Boolean droppingAllowed;
    }

    @Data
    public static class PickupPointInput {

        @NotBlank
        private String placeId;
        @NotBlank
        private String address;
        @NotNull
        private Instant scheduledDepartureTime;
        private Boolean active;
        private TripCreateRequest.LocationInput location;
    }

    @Data
    public static class DropoffPointInput {

        @NotBlank
        private String placeId;
        @NotBlank
        private String address;
        @NotNull
        private Instant scheduledArrivalTime;
        private Boolean active;
        private TripCreateRequest.LocationInput location;
    }
}
