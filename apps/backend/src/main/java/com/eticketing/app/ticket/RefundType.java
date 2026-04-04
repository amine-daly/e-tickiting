package com.eticketing.app.ticket;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Refund document — TRIP_SPEC section 9. Seats are released ONLY on APPROVED
 * transition.
 */
@Document("refunds")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefundType {

    @Id
    private String id;

    @Indexed
    private String ticketId;

    @Builder.Default
    private List<String> segmentsRefunded = new ArrayList<>();

    private BigDecimal amount;

    private String currency;

    @Indexed
    @Builder.Default
    private RefundStatusEnum status = RefundStatusEnum.REQUESTED;

    @CreatedDate
    private Instant createdAt;

    private Instant processedAt;
}
