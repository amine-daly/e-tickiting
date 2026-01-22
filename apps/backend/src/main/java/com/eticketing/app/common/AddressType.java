package com.eticketing.app.common;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Embedded address type for PointOfSale and other entities.
 */
public class AddressType {

    @JsonProperty("addressLine")
    private String addressLine;

    @JsonProperty("city")
    private String city;

    /**
     * Reference to state ID
     */
    @JsonProperty("stateId")
    private String stateId;

    /**
     * Reference to country ID
     */
    @JsonProperty("countryId")
    private String countryId;

    @JsonProperty("zipCode")
    private String zipCode;

    /**
     * Geographic location (longitude/latitude)
     */
    @JsonProperty("location")
    private LonLatType location;

    public AddressType() {
    }

    public AddressType(String addressLine, String city, String stateId, String countryId, String zipCode) {
        this.addressLine = addressLine;
        this.city = city;
        this.stateId = stateId;
        this.countryId = countryId;
        this.zipCode = zipCode;
    }

    public AddressType(String addressLine, String city, String stateId, String countryId, String zipCode, LonLatType location) {
        this.addressLine = addressLine;
        this.city = city;
        this.stateId = stateId;
        this.countryId = countryId;
        this.zipCode = zipCode;
        this.location = location;
    }

    public String getAddressLine() {
        return addressLine;
    }

    public void setAddressLine(String addressLine) {
        this.addressLine = addressLine;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
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

    public String getZipCode() {
        return zipCode;
    }

    public void setZipCode(String zipCode) {
        this.zipCode = zipCode;
    }

    public LonLatType getLocation() {
        return location;
    }

    public void setLocation(LonLatType location) {
        this.location = location;
    }
}
