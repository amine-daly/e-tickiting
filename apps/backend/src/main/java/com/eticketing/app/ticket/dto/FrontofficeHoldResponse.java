package com.eticketing.app.ticket.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Data
@Builder
public class FrontofficeHoldResponse {

    private String holdToken;
    private boolean groupBooking;
    private String tripId;
    private String companyId;
    private String pickupPointId;
    private String dropoffPointId;
    private List<String> segmentIds;
    private String status;
    private BigDecimal totalPrice;
    private String currency;
    private Instant expiresAt;
    private Instant createdAt;
    private Instant confirmedAt;
    private Instant cancelledAt;
    private ContactSummary contact;
    private List<PassengerSummary> passengers;

    @Data
    @Builder
    public static class ContactSummary {

        private String passengerId;
        private String firstName;
        private String lastName;
        private String email;
    }

    @Data
    @Builder
    public static class PassengerSummary {

        private String ticketId;
        private String passengerId;
        private String firstName;
        private String lastName;
        private String email;
        private String seatNo;
        private BigDecimal appliedPrice;
        private String currency;
        private String status;
    }
}