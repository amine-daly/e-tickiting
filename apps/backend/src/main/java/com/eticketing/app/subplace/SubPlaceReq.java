package com.eticketing.app.subplace;

import com.eticketing.app.place.LonLatType;

public record SubPlaceReq(
        String address,
        LonLatType location,
        String pickupInstructions,
        String parentId,
        TargetReq target
        ) {

    public record TargetReq(String company, String pos) {

    }

}
