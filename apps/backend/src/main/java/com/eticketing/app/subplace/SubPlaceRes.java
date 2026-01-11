package com.eticketing.app.subplace;

import com.eticketing.app.place.LonLatType;
import com.eticketing.app.place.PlaceType;

public record SubPlaceRes(
        String id,
        String address,
        String kind,
        LonLatType location,
        String pickupInstructions,
        Boolean isDefault,
        String parentId,
        String parentCity
        ) {

    public static SubPlaceRes from(PlaceType p, String parentCity) {
        return new SubPlaceRes(
                p.getId(),
                p.getAddress(),
                p.getKind() != null ? p.getKind().name() : "POINT",
                p.getLocation(),
                p.getPickupInstructions(),
                p.getIsDefault(),
                p.getParentId(),
                parentCity
        );
    }
}
