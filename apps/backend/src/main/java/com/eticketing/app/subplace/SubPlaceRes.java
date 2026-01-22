package com.eticketing.app.subplace;

import com.eticketing.app.place.LonLatType;

import java.time.Instant;

public record SubPlaceRes(
        String id,
        String address,
        String kind,
        LonLatType location,
        String pickupInstructions,
        Boolean isDefault,
        String parentId,
        String parentCity,
        Instant createdAt,
        Instant updatedAt
        ) {

    public static SubPlaceRes from(SubPlaceType p, String parentCity) {
        return new SubPlaceRes(
                p.getId(),
                p.getAddress(),
                "POINT",
                p.getLocation(),
                p.getPickupInstructions(),
                p.getIsDefault(),
                p.getParentId(),
                parentCity,
                p.getCreatedAt(),
                p.getUpdatedAt()
        );
    }
}
