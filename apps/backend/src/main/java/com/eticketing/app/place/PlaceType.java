package com.eticketing.app.place;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Place document — can represent a city (kind=CITY) or a pickup/dropoff point
 * (kind=POINT). POINT places have a parentId pointing to their parent CITY.
 */
@Document("places")
public class PlaceType {

    public enum PlaceKind {
        CITY,
        POINT
    }

    @Id
    @JsonProperty("id")
    private String id;

    @JsonProperty("city")
    private String city;

    @JsonProperty("location")
    private LonLatType location;

    /**
     * Optional ordering rank when a place is used as a stop inside a trip
     */
    @JsonProperty("rank")
    private Integer rank;

    /**
     * Kind of place: CITY or POINT (pickup/dropoff address)
     */
    @JsonProperty("kind")
    private PlaceKind kind = PlaceKind.CITY;

    /**
     * Parent place ID (for POINT places, this is the parent CITY id)
     */
    @Indexed
    @JsonProperty("parentId")
    private String parentId;

    /**
     * State (governorate) ID
     */
    @Indexed
    @JsonProperty("stateId")
    private String stateId;

    /**
     * Country ID
     */
    @Indexed
    @JsonProperty("countryId")
    private String countryId;

    /**
     * Full address (for POINT places)
     */
    @JsonProperty("address")
    private String address;

    /**
     * Pickup instructions for passengers
     */
    @JsonProperty("pickupInstructions")
    private String pickupInstructions;

    /**
     * Whether this is the default pickup/dropoff point for the parent city
     */
    @JsonProperty("isDefault")
    private Boolean isDefault;

    public PlaceType() {
    }

    public PlaceType(String city, LonLatType location) {
        this.city = city;
        this.location = location;
        this.kind = PlaceKind.CITY;
    }

    // ========== Getters and Setters ==========
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public LonLatType getLocation() {
        return location;
    }

    public void setLocation(LonLatType location) {
        this.location = location;
    }

    public Integer getRank() {
        return rank;
    }

    public void setRank(Integer rank) {
        this.rank = rank;
    }

    public PlaceKind getKind() {
        return kind == null ? PlaceKind.CITY : kind;
    }

    public void setKind(PlaceKind kind) {
        this.kind = kind;
    }

    public String getParentId() {
        return parentId;
    }

    public void setParentId(String parentId) {
        this.parentId = parentId;
    }

    public String getStateId() {
        return stateId;
    }

    public void setStateId(String stateId) {
        this.stateId = stateId;
    }

    public String getCountryId() {
        return countryId;
    }

    public void setCountryId(String countryId) {
        this.countryId = countryId;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getPickupInstructions() {
        return pickupInstructions;
    }

    public void setPickupInstructions(String pickupInstructions) {
        this.pickupInstructions = pickupInstructions;
    }

    public Boolean getIsDefault() {
        return isDefault;
    }

    public void setIsDefault(Boolean isDefault) {
        this.isDefault = isDefault;
    }
}
