package com.eticketing.app.ticket;

import lombok.Builder;

@Builder
public record BookingCreateOptions(
        String sourceChannel,
        TicketStatusEnum initialTicketStatus,
        OrderStatusEnum initialOrderStatus,
        String bookedByUserId,
        String bookedByPosId,
        String paymentSessionId,
        String paymentReference,
        String paymentStatus,
        Long holdSeconds) {

    private static final long DEFAULT_HOLD_SECONDS = 600;
    private static final long FRONTOFFICE_HOLD_SECONDS = 900;

    public static BookingCreateOptions legacyPending() {
        return BookingCreateOptions.builder()
                .sourceChannel("LEGACY")
                .initialTicketStatus(TicketStatusEnum.PENDING)
                .initialOrderStatus(OrderStatusEnum.PENDING)
                .paymentStatus("PENDING")
                .holdSeconds(DEFAULT_HOLD_SECONDS)
                .build();
    }

    public static BookingCreateOptions pos(String bookedByUserId, String bookedByPosId) {
        return BookingCreateOptions.builder()
                .sourceChannel("POS")
                .initialTicketStatus(TicketStatusEnum.CONFIRMED)
                .initialOrderStatus(OrderStatusEnum.CONFIRMED)
                .bookedByUserId(bookedByUserId)
                .bookedByPosId(bookedByPosId)
                .paymentStatus("PAID")
                .build();
    }

    public static BookingCreateOptions frontoffice() {
        return BookingCreateOptions.builder()
                .sourceChannel("FRONTOFFICE")
                .initialTicketStatus(TicketStatusEnum.PENDING)
                .initialOrderStatus(OrderStatusEnum.PENDING)
                .paymentStatus("PENDING")
                .holdSeconds(FRONTOFFICE_HOLD_SECONDS)
                .build();
    }

    public TicketStatusEnum resolvedTicketStatus() {
        return initialTicketStatus != null ? initialTicketStatus : TicketStatusEnum.PENDING;
    }

    public OrderStatusEnum resolvedOrderStatus() {
        return initialOrderStatus != null ? initialOrderStatus : OrderStatusEnum.PENDING;
    }

    public boolean usesExpiringHold() {
        return holdSeconds != null && holdSeconds > 0;
    }
}
