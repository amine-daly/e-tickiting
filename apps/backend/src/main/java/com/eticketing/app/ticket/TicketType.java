package com.eticketing.app.ticket;

import com.eticketing.app.common.TargetInput;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Ticket document  TRIP_SPEC section 8.
 * Immutable financial record after creation: never mutate appliedPrice, currency, or segmentIds.
 */
@Document("tickets")
@CompoundIndexes({
    @CompoundIndex(name = "target_company_idx", def = "{ 'target.company': 1 }"),
    @CompoundIndex(name = "target_company_pos_idx", def = "{ 'target.company': 1, 'target.pos': 1 }"),
    @CompoundIndex(name = "trip_status_idx", def = "{ 'tripId': 1, 'status': 1 }")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketType {

    @Id
    private String id;

    @Version
    private Long version;

    private String tripId;

    private TargetInput target;

    @Builder.Default
    private List<String> segmentIds = new ArrayList<>();

    private String expressId;

    private String pickupPointId;

    private String dropoffPointId;

    private String passengerId;

    /**
     * Snapshot at booking time  NEVER changes.
     */
    private BigDecimal appliedPrice;

    /**
     * Snapshot of trip.currency at booking time  NEVER changes.
     */
    private String currency;

    /**
     * Snapshot of the passenger UI language at booking time.
     */
    @Builder.Default
    private String lang = TicketLanguage.FR_FR.getCode();

    @Builder.Default
    private TicketStatusEnum status = TicketStatusEnum.PENDING;

    /**
     * Exactly-once semantics  unique index.
     */
    @Indexed(unique = true)
    private String idempotencyKey;

    /**
     * now() + seatHoldMinutes  only meaningful while PENDING.
     */
    private Instant expiresAt;

    @CreatedDate
    private Instant createdAt;

    private Instant confirmedAt;

    private Instant cancelledAt;
}
