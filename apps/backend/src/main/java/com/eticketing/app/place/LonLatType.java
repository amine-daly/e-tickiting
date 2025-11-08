package com.eticketing.app.place;

import jakarta.validation.constraints.NotNull;
import java.util.List;

public class LonLatType {
    @NotNull
    private ZoneTypesEnum type;
    @NotNull
    private List<Double> coordinates; // [lon, lat] for POINT; for POLYGON, follow GeoJSON ring

    public LonLatType() {}

    public LonLatType(ZoneTypesEnum type, List<Double> coordinates) {
        this.type = type;
        this.coordinates = coordinates;
    }

    public ZoneTypesEnum getType() { return type; }
    public void setType(ZoneTypesEnum type) { this.type = type; }
    public List<Double> getCoordinates() { return coordinates; }
    public void setCoordinates(List<Double> coordinates) { this.coordinates = coordinates; }
}
