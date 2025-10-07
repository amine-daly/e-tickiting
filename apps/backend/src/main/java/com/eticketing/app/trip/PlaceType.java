package com.eticketing.app.trip;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class PlaceType {
    @NotBlank
    private String city;
    @NotNull
    private LonLatType location;

    public PlaceType() {}

    public PlaceType(String city, LonLatType location) {
        this.city = city;
        this.location = location;
    }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public LonLatType getLocation() { return location; }
    public void setLocation(LonLatType location) { this.location = location; }
}
