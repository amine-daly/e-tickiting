package com.eticketing.app.ticket.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

/**
 * Group booking request — creates one Order with N tickets (one per passenger).
 * All passengers share the same trip, pickup, and dropoff.
 */
@Data
public class GroupBookingRequest {

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

    /**
     * The contact customer who initiated the order at the POS.
     */
    @NotBlank
    private String contactCustomerId;

    @NotBlank
    private String idempotencyKey;

    private String lang;

    /**
     * One entry per passenger in the group.
     */
    @NotEmpty
    @Valid
    private List<PassengerEntry> passengers;

    @Data
    public static class PassengerEntry {

        /**
         * Registered user id — required for the contact passenger (index 0),
         * optional for additional guests.
         */
        private String passengerId;

        /**
         * Plain-text first name — used for guest passengers who are not
         * registered in the system.
         */
        private String firstName;

        /**
         * Plain-text last name — used for guest passengers.
         */
        private String lastName;

        /**
         * Optional — null for free-seating buses.
         */
        private String seatNo;
    }
}
