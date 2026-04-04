package com.eticketing.app.ticket;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Refund state machine per TRIP_SPEC section 9.
 * <pre>
 * REQUESTED → APPROVED  (seats released on this transition)
 * REQUESTED → REJECTED  (no seat release)
 * APPROVED  → COMPLETED (no further seat action)
 * </pre>
 */
public enum RefundStatusEnum {
    REQUESTED,
    APPROVED,
    COMPLETED,
    REJECTED;

    @JsonValue
    public String toValue() {
        return name();
    }

    @JsonCreator
    public static RefundStatusEnum fromValue(String value) {
        return valueOf(value.toUpperCase());
    }
}
