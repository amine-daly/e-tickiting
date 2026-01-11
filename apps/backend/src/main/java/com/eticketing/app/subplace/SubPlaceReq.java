package com.eticketing.app.subplace;

import com.eticketing.app.place.LonLatType;

public record SubPlaceReq(
        String address,
        LonLatType location,
        String pickupInstructions,
        Boolean isDefault,
        String parentId
        ) {

}
