package com.eticketing.app.trip;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum TripStatusEnum {
    SCHEDULED,
    COMPLETED,
    CANCELLED;

    @JsonCreator
    public static TripStatusEnum fromValue(String value) {
        if (value == null) {
            return SCHEDULED;
        }
        return TripStatusEnum.valueOf(value.trim().toUpperCase());
    }

    @JsonValue
    public String toValue() {
        return name();
    }
}
