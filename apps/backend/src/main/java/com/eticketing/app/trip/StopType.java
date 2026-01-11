package com.eticketing.app.trip;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;

/**
 * Embedded stop within a Trip. Each stop has a place reference, rank (order),
 * and fare.
 */
public class StopType {

    @JsonProperty("placeId")
    private String placeId;

    @JsonProperty("rank")
    private Integer rank;

    @JsonProperty("fare")
    private BigDecimal fare;

    public StopType() {
    }

    public StopType(String placeId, Integer rank, BigDecimal fare) {
        this.placeId = placeId;
        this.rank = rank;
        this.fare = fare;
    }

    public String getPlaceId() {
        return placeId;
    }

    public void setPlaceId(String placeId) {
        this.placeId = placeId;
    }

    public Integer getRank() {
        return rank;
    }

    public void setRank(Integer rank) {
        this.rank = rank;
    }

    public BigDecimal getFare() {
        return fare;
    }

    public void setFare(BigDecimal fare) {
        this.fare = fare;
    }
}
