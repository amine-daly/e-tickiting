package com.eticketing.app.ticket;

/**
 * Order-level status enum. Mirrors the ticket lifecycle at the group level.
 */
public enum OrderStatusEnum {
    PENDING,
    CONFIRMED,
    EXPIRED,
    CANCELLED
}
