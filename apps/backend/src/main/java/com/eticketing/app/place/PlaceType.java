package com.eticketing.app.place;

import com.eticketing.app.place.LonLatType;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("places")
public class PlaceType {

    @Id
    private String id;
    private String city;
    private LonLatType location;
    // Optional ordering rank when a place is used as a stop inside a trip
    private Integer rank;

    public PlaceType() {
    }

    public PlaceType(String city, LonLatType location) {
        this.city = city;
        this.location = location;
    }

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
}
