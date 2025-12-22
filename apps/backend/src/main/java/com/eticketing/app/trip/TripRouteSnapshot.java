package com.eticketing.app.trip;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;

/**
 * Snapshot of a route embedded in a Trip for auditability. Preserves fare at
 * time of trip creation/update.
 */
public class TripRouteSnapshot {

    @JsonProperty("id")
    private String id;

    @JsonProperty("originId")
    private String originId;

    @JsonProperty("destinationId")
    private String destinationId;

    @JsonProperty("rank")
    private Integer rank;

    @JsonProperty("fare")
    private BigDecimal fare;

    public TripRouteSnapshot() {
    }

    public TripRouteSnapshot(String id, String originId, String destinationId, Integer rank, BigDecimal fare) {
        this.id = id;
        this.originId = originId;
        this.destinationId = destinationId;
        this.rank = rank;
        this.fare = fare;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getOriginId() {
        return originId;
    }

    public void setOriginId(String originId) {
        this.originId = originId;
    }

    public String getDestinationId() {
        return destinationId;
    }

    public void setDestinationId(String destinationId) {
        this.destinationId = destinationId;
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
