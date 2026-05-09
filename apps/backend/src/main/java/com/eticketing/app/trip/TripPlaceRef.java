package com.eticketing.app.trip;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TripPlaceRef {

    private String id;

    public static TripPlaceRef of(String id) {
        if (id == null || id.isBlank()) {
            return null;
        }
        return TripPlaceRef.builder().id(id).build();
    }

    public static String idOf(TripPlaceRef placeRef) {
        return placeRef != null ? placeRef.getId() : null;
    }
}
