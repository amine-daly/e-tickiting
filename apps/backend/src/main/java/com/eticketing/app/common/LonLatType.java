package com.eticketing.app.common;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Represents a geographic location with longitude and latitude.
 */
public class LonLatType {

    @JsonProperty("lng")
    private Double lng;

    @JsonProperty("lat")
    private Double lat;

    public LonLatType() {
    }

    public LonLatType(Double lng, Double lat) {
        this.lng = lng;
        this.lat = lat;
    }

    public Double getLng() {
        return lng;
    }

    public void setLng(Double lng) {
        this.lng = lng;
    }

    public Double getLat() {
        return lat;
    }

    public void setLat(Double lat) {
        this.lat = lat;
    }
}
