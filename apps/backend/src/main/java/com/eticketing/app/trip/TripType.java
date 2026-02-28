package com.eticketing.app.trip;

import com.eticketing.app.common.TargetInput;
import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;

@Document("trips")
@CompoundIndexes({
    @CompoundIndex(name = "search_idx", def = "{ 'originId': 1, 'destinationId': 1, 'departureDate': 1 }", unique = false)
})
public class TripType {

    @Id
    @JsonProperty("id")
    private String id;

    @Version
    @JsonProperty("version")
    private Long version;

    /**
     * Target containing POS ID for multi-tenant scoping. Terminal trips are
     * scoped by target.pos; frontoffice search is unscoped.
     */
    @JsonProperty("target")
    private TargetInput target;

    /**
     * Origin place ID (admin-entered)
     */
    @NotNull
    @JsonProperty("originId")
    private String originId;

    /**
     * Destination place ID (admin-entered)
     */
    @NotNull
    @JsonProperty("destinationId")
    private String destinationId;

    /**
     * Ordered list of intermediate stops. Each stop has placeId, rank, and
     * fare.
     */
    @JsonProperty("stops")
    private List<StopType> stops;

    /**
     * Selected sub-places (pickup/dropoff points) for this trip with per-trip scheduled times.
     * Each entry references a SubPlace and carries the departure/arrival time at that point.
     */
    @JsonProperty("pickupPoints")
    private List<TripSubPlaceType> pickupPoints;

    /**
     * Departure datetime (ISO 8601)
     */
    @NotNull
    @JsonProperty("departureDate")
    @com.fasterxml.jackson.annotation.JsonFormat(shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ssXXX")
    private OffsetDateTime departureDate;

    @Min(0)
    @JsonProperty("availableSeats")
    private int availableSeats;

    /**
     * Total capacity for the trip (admin-entered). This value is the source of
     * truth for capacity and should not be auto-derived from the seat map.
     */
    @Min(0)
    @JsonProperty("totalPlaces")
    private int totalPlaces;

    @JsonProperty("seats")
    private List<SeatUnit> seats;

    /**
     * Total price for the trip (admin-entered, BigDecimal).
     */
    @NotNull
    @JsonProperty("totalPrice")
    private BigDecimal totalPrice;

    @NotNull
    @JsonProperty("status")
    private TripStatusEnum status = TripStatusEnum.SCHEDULED;

    @CreatedDate
    @JsonProperty("createdAt")
    private Instant createdAt;

    @LastModifiedDate
    @JsonProperty("updatedAt")
    private Instant updatedAt;

    public TripType() {
    }

    // ========== Getters and Setters ==========
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public Long getVersion() {
        return version;
    }

    @JsonProperty("version")
    public void setVersion(Long version) {
        this.version = version;
    }

    public TargetInput getTarget() {
        return target;
    }

    public void setTarget(TargetInput target) {
        this.target = target;
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

    public List<StopType> getStops() {
        return stops;
    }

    public void setStops(List<StopType> stops) {
        this.stops = stops;
    }

    public List<TripSubPlaceType> getPickupPoints() {
        return pickupPoints;
    }

    public void setPickupPoints(List<TripSubPlaceType> pickupPoints) {
        this.pickupPoints = pickupPoints;
    }

    public OffsetDateTime getDepartureDate() {
        return departureDate;
    }

    @JsonProperty("departureDate")
    public void setDepartureDate(OffsetDateTime departureDate) {
        this.departureDate = departureDate;
    }

    public int getAvailableSeats() {
        return availableSeats;
    }

    @JsonProperty("availableSeats")
    public void setAvailableSeats(int availableSeats) {
        this.availableSeats = availableSeats;
    }

    public int getTotalPlaces() {
        return totalPlaces;
    }

    @JsonProperty("totalPlaces")
    public void setTotalPlaces(int totalPlaces) {
        this.totalPlaces = totalPlaces;
    }

    public List<SeatUnit> getSeats() {
        return seats;
    }

    @JsonProperty("seats")
    public void setSeats(List<SeatUnit> seats) {
        this.seats = seats;
    }

    public BigDecimal getTotalPrice() {
        return totalPrice;
    }

    @JsonProperty("totalPrice")
    public void setTotalPrice(BigDecimal totalPrice) {
        this.totalPrice = totalPrice;
    }

    public TripStatusEnum getStatus() {
        return status == null ? TripStatusEnum.SCHEDULED : status;
    }

    @JsonProperty("status")
    public void setStatus(TripStatusEnum status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
