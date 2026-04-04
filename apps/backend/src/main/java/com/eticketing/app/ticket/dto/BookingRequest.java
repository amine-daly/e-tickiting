package com.eticketing.app.ticket.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class BookingRequest {

    @NotBlank
    private String tripId;

    @NotBlank
    private String fromPlaceId;

    @NotBlank
    private String toPlaceId;

    @NotBlank
    private String pickupPointId;

    @NotBlank
    private String dropoffPointId;

    @NotBlank
    private String passengerId;

    @NotBlank
    private String idempotencyKey;
}
