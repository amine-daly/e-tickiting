package com.eticketing.app.trip.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.Instant;

/**
 * DTO for adding a dropoff point to a trip.
 */
@Data
public class DropoffPointRequest {

    @NotBlank
    private String placeId;

    @NotBlank
    private String address;

    @NotNull
    private Instant scheduledArrivalTime;

    private Boolean active;

    private TripCreateRequest.LocationInput location;
}
