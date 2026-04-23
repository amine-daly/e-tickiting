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
 * Order (group booking) document. Groups multiple tickets into a single
 * transaction with a shared payment context.
 * <p>
 * One Order = one trip + one contact customer + N passengers (each with a
 * ticket).
 */
@Document("orders")
@CompoundIndexes({
    @CompoundIndex(name = "order_target_company_idx", def = "{ 'target.company': 1 }"),
    @CompoundIndex(name = "order_trip_status_idx", def = "{ 'tripId': 1, 'status': 1 }")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderType {

    @Id
    private String id;

    @Version
    private Long version;

    /**
     * The trip all tickets in this order belong to.
     */
    private String tripId;

    /**
     * Company + POS attribution — same rules as TicketType.
     */
    private TargetInput target;

    /**
     * The contact customer who initiated the order (the POS agent's selected
     * customer).
     */
    private String contactCustomerId;

    /**
     * References to currently active tickets still attached to the order.
     */
    @Builder.Default
    private List<String> ticketIds = new ArrayList<>();

    /**
     * Active passenger manifest used by the order itinerary document.
     */
    @Builder.Default
    private List<OrderPassenger> passengers = new ArrayList<>();

    /**
     * Current total for the active tickets that remain attached to the order.
     */
    private BigDecimal totalPrice;

    /**
     * Currency snapshot — same as trip currency.
     */
    private String currency;

    /**
     * Order-level status for the active members that remain in the order.
     */
    @Builder.Default
    private OrderStatusEnum status = OrderStatusEnum.PENDING;

    /**
     * Exactly-once key for the entire order.
     */
    @Indexed(unique = true)
    private String idempotencyKey;

    /**
     * Expiry for the seat hold — same as the tickets' expiresAt.
     */
    private Instant expiresAt;

    @CreatedDate
    private Instant createdAt;

    private Instant confirmedAt;

    private Instant cancelledAt;

    /**
     * Embedded passenger info used in the master ticket / itinerary.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class OrderPassenger {

        private String passengerId;
        private String firstName;
        private String lastName;
        private String seatNo;
        private String ticketId;
    }
}
