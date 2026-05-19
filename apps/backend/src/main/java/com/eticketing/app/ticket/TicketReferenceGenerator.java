package com.eticketing.app.ticket;

import java.util.Locale;
import java.util.UUID;

public final class TicketReferenceGenerator {

    private static final int REFERENCE_LENGTH = 12;

    private TicketReferenceGenerator() {
    }

    public static String generate() {
        return UUID.randomUUID()
                .toString()
                .replace("-", "")
                .substring(0, REFERENCE_LENGTH)
                .toUpperCase(Locale.ROOT);
    }
}
