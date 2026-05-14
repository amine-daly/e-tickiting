package com.eticketing.app.ticket.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class FrontofficeCreateHoldRequest {

    @NotBlank
    private String holdToken;

    @NotBlank
    private String tripId;

    @NotBlank
    private String originPlaceId;

    @NotBlank
    private String destinationPlaceId;

    @NotBlank
    private String pickupPointId;

    @NotBlank
    private String dropoffPointId;

    private String lang;

    @Valid
    @NotNull
    private ContactPassenger contact;

    @Valid
    private List<GuestPassenger> passengers = new ArrayList<>();

    @Data
    public static class ContactPassenger {

        @NotBlank
        private String firstName;

        @NotBlank
        private String lastName;

        @Email
        @NotBlank
        private String email;

        private String seatNo;
    }

    @Data
    public static class GuestPassenger {

        @NotBlank
        private String firstName;

        @NotBlank
        private String lastName;

        private String seatNo;
    }
}