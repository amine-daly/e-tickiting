package com.eticketing.app.route;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;

/**
 * Represents a route segment between two places with admin-defined fare.
 */
@Document("routes")
@CompoundIndexes({
    @CompoundIndex(name = "route_pair_idx", def = "{ 'originId': 1, 'destinationId': 1 }", unique = true)
})
public class RouteType {

    @Id
    @JsonProperty("id")
    private String id;

    /**
     * Origin place ID
     */
    @JsonProperty("originId")
    private String originId;

    /**
     * Destination place ID
     */
    @JsonProperty("destinationId")
    private String destinationId;

    /**
     * Admin-defined fare for this route (BigDecimal, e.g. 13.000 TND)
     */
    @JsonProperty("fare")
    private BigDecimal fare;

    /**
     * Optional rank for ordering routes in listings
     */
    @JsonProperty("rank")
    private Integer rank;

    /**
     * Whether this route is active
     */
    @JsonProperty("active")
    private boolean active = true;

    public RouteType() {
        this.fare = BigDecimal.ZERO;
    }

    public RouteType(String originId, String destinationId, BigDecimal fare) {
        this.originId = originId;
        this.destinationId = destinationId;
        this.fare = fare != null ? fare : BigDecimal.ZERO;
        this.active = true;
    }

    // Getters and setters
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

    public BigDecimal getFare() {
        return fare;
    }

    public void setFare(BigDecimal fare) {
        this.fare = fare;
    }

    public Integer getRank() {
        return rank;
    }

    public void setRank(Integer rank) {
        this.rank = rank;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }
}
