package com.eticketing.app.ticket;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Ticket state machine per TRIP_SPEC section 8.
 * <pre>
 * PENDING   → CONFIRMED  (payment success)
 * CONFIRMED → BOARDED    (successful POS scan)
 * PENDING   → EXPIRED    (timeout, payment failure, or operator cancellation)
 * CONFIRMED → CANCELLED  (triggers Refund)
 * BOARDED   → terminal
 * EXPIRED   → terminal
 * CANCELLED → terminal
 * </pre>
 */
public enum TicketStatusEnum {
    PENDING,
    CONFIRMED,
    BOARDED,
    EXPIRED,
    CANCELLED;

    @JsonValue
    public String toValue() {
        return name();
    }

    @JsonCreator
    public static TicketStatusEnum fromValue(String value) {
        return valueOf(value.toUpperCase());
    }
}
