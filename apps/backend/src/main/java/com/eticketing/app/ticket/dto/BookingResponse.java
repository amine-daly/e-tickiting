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
    private String tripId;
    private String companyId;
    private String posId;
    private List<String> segmentIds;
    private String expressId;
    private String pickupPointId;
    private String dropoffPointId;
    private String passengerId;
    private BigDecimal appliedPrice;
    private String currency;
    private TicketStatusEnum status;
    private String idempotencyKey;
    private Instant expiresAt;
    private Instant createdAt;
    private Instant confirmedAt;
    private Instant cancelledAt;
}
