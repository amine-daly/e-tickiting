package com.eticketing.app.ticket;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Ticket state machine per TRIP_SPEC section 8.
 * <pre>
 * PENDING   → CONFIRMED  (payment success)
 * PENDING   → EXPIRED    (timeout or payment failure)
 * CONFIRMED → CANCELLED  (triggers Refund)
 * EXPIRED   → terminal
 * CANCELLED → terminal
 * </pre>
 */
public enum TicketStatusEnum {
    PENDING,
    CONFIRMED,
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
