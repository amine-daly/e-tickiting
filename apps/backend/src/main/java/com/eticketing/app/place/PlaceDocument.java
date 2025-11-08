package com.eticketing.app.place;

import com.eticketing.app.place.LonLatType;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("places")
public class PlaceDocument {
    @Id
    private String id;
    private String city;
    private LonLatType location;

    public PlaceDocument() {}
    public PlaceDocument(String city, LonLatType location) {
        this.city = city;
        this.location = location;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public LonLatType getLocation() { return location; }
    public void setLocation(LonLatType location) { this.location = location; }
}
