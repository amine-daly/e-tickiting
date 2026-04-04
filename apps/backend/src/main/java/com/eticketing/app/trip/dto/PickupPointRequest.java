package com.eticketing.app.trip.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.Instant;

/**
 * DTO for adding a pickup point to a trip.
 */
@Data
public class PickupPointRequest {

    @NotBlank
    private String placeId;

    @NotBlank
    private String address;

    @NotNull
    private Instant scheduledDepartureTime;

    private Boolean active;

    private TripCreateRequest.LocationInput location;
}
