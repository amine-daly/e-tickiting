package com.eticketing.app.ticket.dto;

import com.eticketing.app.ticket.TicketStatusEnum;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Data
@Builder
public class BookingResponse {

    private String id;
    private String reference;
    private String tripId;
    private String orderId;
    private String companyId;
    private String posId;
    private List<String> segmentIds;
    private String expressSegmentId;
    private String pickupPointId;
    private String dropoffPointId;
    private String passengerId;
    private String guestFirstName;
    private String guestLastName;
    private String seatNo;
    private BigDecimal appliedPrice;
    private String currency;
    private String lang;
    private TicketStatusEnum status;
    private String idempotencyKey;
    private Instant expiresAt;
    private Instant createdAt;
    private Instant confirmedAt;
    private Instant scannedAt;
    private String scannedBy;
    private Instant cancelledAt;
}
