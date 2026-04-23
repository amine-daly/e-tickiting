package com.eticketing.app.ticket.dto;

import com.eticketing.app.ticket.OrderStatusEnum;
import com.eticketing.app.ticket.OrderType;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Response for a group booking — the Order plus its individual ticket details.
 */
@Data
@Builder
public class GroupBookingResponse {

    private String orderId;
    private String tripId;
    private String companyId;
    private String posId;
    private String contactCustomerId;
    private BigDecimal totalPrice;
    private String currency;
    private OrderStatusEnum status;
    private String idempotencyKey;
    private Instant expiresAt;
    private Instant createdAt;
    private Instant confirmedAt;
    private Instant cancelledAt;
    private List<OrderType.OrderPassenger> passengers;
    private List<BookingResponse> tickets;
}
