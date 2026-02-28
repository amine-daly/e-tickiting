package com.eticketing.app.trip;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.OffsetDateTime;

/**
 * Embedded sub-place selection within a Trip.
 * Each entry represents a pickup/dropoff point selected for this trip,
 * with its own scheduled departure/arrival time.
 */
public class TripSubPlaceType {

    @JsonProperty("subPlaceId")
    private String subPlaceId;

    @JsonProperty("scheduledTime")
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ssXXX")
    private OffsetDateTime scheduledTime;

    public TripSubPlaceType() {
    }

    public TripSubPlaceType(String subPlaceId, OffsetDateTime scheduledTime) {
        this.subPlaceId = subPlaceId;
        this.scheduledTime = scheduledTime;
    }

    public String getSubPlaceId() {
        return subPlaceId;
    }

    public void setSubPlaceId(String subPlaceId) {
        this.subPlaceId = subPlaceId;
    }

    public OffsetDateTime getScheduledTime() {
        return scheduledTime;
    }

    public void setScheduledTime(OffsetDateTime scheduledTime) {
        this.scheduledTime = scheduledTime;
    }
}
