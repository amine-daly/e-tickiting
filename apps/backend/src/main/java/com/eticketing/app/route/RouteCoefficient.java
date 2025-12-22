package com.eticketing.app.route;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Represents a time-windowed pricing coefficient for a route. Allows
 * seasonal/promotional pricing adjustments.
 *
 * Example: Summer coefficient of 1.5 from June 1 to August 31.
 */
@Document("route_coefficients")
@CompoundIndexes({
    @CompoundIndex(name = "coeff_route_date_idx", def = "{ 'routeId': 1, 'startDate': 1, 'endDate': 1 }")
})
public class RouteCoefficient {

    @Id
    @JsonProperty("id")
    private String id;

    /**
     * Route ID this coefficient applies to. If null, applies globally to all
     * routes.
     */
    @JsonProperty("routeId")
    private String routeId;

    /**
     * Start date (inclusive) when this coefficient is active
     */
    @JsonProperty("startDate")
    private LocalDate startDate;

    /**
     * End date (inclusive) when this coefficient is active
     */
    @JsonProperty("endDate")
    private LocalDate endDate;

    /**
     * The pricing coefficient (e.g., 1.5 for 50% increase, 0.8 for 20%
     * discount)
     */
    @JsonProperty("coefficient")
    private BigDecimal coefficient;

    /**
     * Optional name/label for this coefficient period (e.g., "Summer 2025",
     * "Eid Promo")
     */
    @JsonProperty("name")
    private String name;

    /**
     * Priority: higher priority coefficients take precedence when date ranges
     * overlap
     */
    @JsonProperty("priority")
    private int priority;

    /**
     * Whether this coefficient is active
     */
    @JsonProperty("active")
    private boolean active = true;

    public RouteCoefficient() {
        this.coefficient = BigDecimal.ONE;
        this.priority = 0;
        this.active = true;
    }

    public RouteCoefficient(String routeId, LocalDate startDate, LocalDate endDate, BigDecimal coefficient, String name) {
        this.routeId = routeId;
        this.startDate = startDate;
        this.endDate = endDate;
        this.coefficient = coefficient;
        this.name = name;
        this.priority = 0;
        this.active = true;
    }

    // Getters and setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getRouteId() {
        return routeId;
    }

    public void setRouteId(String routeId) {
        this.routeId = routeId;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }

    public BigDecimal getCoefficient() {
        return coefficient;
    }

    public void setCoefficient(BigDecimal coefficient) {
        this.coefficient = coefficient;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getPriority() {
        return priority;
    }

    public void setPriority(int priority) {
        this.priority = priority;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    /**
     * Check if this coefficient applies to a given date.
     */
    public boolean appliesTo(LocalDate date) {
        if (!active) {
            return false;
        }
        if (date == null) {
            return false;
        }
        boolean afterStart = startDate == null || !date.isBefore(startDate);
        boolean beforeEnd = endDate == null || !date.isAfter(endDate);
        return afterStart && beforeEnd;
    }
}
