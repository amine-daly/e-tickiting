package com.eticketing.app.trip.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * DTO for trip creation — captures all 9 layers of input per TRIP_SPEC.
 * <p>
 * {@code segmentInputs} are ordered: index 0 maps to the segment between
 * commercial stop 0 and 1, etc.
 * <p>
 * {@code expressFares[].segmentIndices} reference 0-based indices into the
 * generated segments array (resolved to IDs after generation).
 */
@Data
public class TripCreateRequest {

    // ── Layer 2 — Bus ───────────────────────────────────────────────────
    @NotNull
    @Valid
    private BusInput bus;

    // ── Layer 1 — Identity ──────────────────────────────────────────────
    @NotNull
    private Instant departureDate;

    @NotBlank
    private String timezone;

    // ── Layer 3 — Currency ──────────────────────────────────────────────
    @NotBlank
    private String currencyId;

    // ── Layer 4 — Seat Hold ─────────────────────────────────────────────
    private Integer seatHoldMinutes;

    // ── Layer 5 — Stop Schedule ─────────────────────────────────────────
    @NotEmpty
    @Valid
    private List<StopInput> stopSchedule;

    // ── Layer 6 — Pickup Points ─────────────────────────────────────────
    @NotEmpty
    @Valid
    private List<PickupPointInput> pickupPoints;

    // ── Layer 7 — Dropoff Points ────────────────────────────────────────
    @NotEmpty
    @Valid
    private List<DropoffPointInput> dropoffPoints;

    // ── Layer 8 — Segment admin inputs ──────────────────────────────────
    @NotEmpty
    @Valid
    private List<SegmentInput> segmentInputs;

    // ── Layer 9 — Express Fares (optional) ──────────────────────────────
    @Valid
    private List<ExpressFareInput> expressFares;

    // ── Nested input types ──────────────────────────────────────────────
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
        private LocationInput location;
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
        private LocationInput location;
    }

    @Data
    public static class LocationInput {

        private double latitude;
        private double longitude;
    }

    @Data
    public static class SegmentInput {

        @NotNull
        @PositiveOrZero
        private BigDecimal basePrice;
        @NotNull
        @Positive
        private Integer maxSeats;
        @NotNull
        @Positive
        private Double distanceKm;
        private Integer durationMinutesOverride;
    }

    @Data
    public static class ExpressFareInput {

        @NotEmpty
        private List<Integer> segmentIndices;
        @NotNull
        @PositiveOrZero
        private BigDecimal price;
        private Instant validFrom;
        private Instant validUntil;
        private Boolean active;
    }
}
