package com.eticketing.app.trip;

import com.eticketing.app.web.error.ApiExceptions.BadRequestException;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Validates that every commercial stop has the required pickup/dropoff points
 * per TRIP_SPEC section 5.
 */
public final class PickupDropoffValidator {

    private PickupDropoffValidator() {
    }

    /**
     * Validates mandatory pickup/dropoff point coverage.
     *
     * @param stops the stop schedule
     * @param pickupPoints pickup points on the trip
     * @param dropoffPoints dropoff points on the trip
     */
    public static void validate(
            List<StopType> stops,
            List<PickupPointType> pickupPoints,
            List<DropoffPointType> dropoffPoints) {

        // Collect placeIds that have at least one active pickup point
        Set<String> pickupPlaceIds = (pickupPoints != null)
                ? pickupPoints.stream()
                        .map(PickupPointType::getPlaceId)
                        .collect(Collectors.toSet())
                : Set.of();

        // Collect placeIds that have at least one active dropoff point
        Set<String> dropoffPlaceIds = (dropoffPoints != null)
                ? dropoffPoints.stream()
                        .map(DropoffPointType::getPlaceId)
                        .collect(Collectors.toSet())
                : Set.of();

        // Collect valid stop placeIds by boarding/dropping flags for cross-validation
        Set<String> boardingPlaceIds = stops.stream()
                .filter(StopType::isBoardingAllowed)
                .map(StopType::getPlaceId)
                .collect(Collectors.toSet());

        Set<String> droppingPlaceIds = stops.stream()
                .filter(StopType::isDroppingAllowed)
                .map(StopType::getPlaceId)
                .collect(Collectors.toSet());

        // Every boarding stop must have at least one pickup point
        for (StopType stop : stops) {
            if (stop.isBoardingAllowed() && !pickupPlaceIds.contains(stop.getPlaceId())) {
                throw new BadRequestException(
                        "MISSING_PICKUP_POINT: stop placeId '" + stop.getPlaceId()
                        + "' (seq " + stop.getSequence() + ") has boardingAllowed=true but no pickup point");
            }
            if (stop.isDroppingAllowed() && !dropoffPlaceIds.contains(stop.getPlaceId())) {
                throw new BadRequestException(
                        "MISSING_DROPOFF_POINT: stop placeId '" + stop.getPlaceId()
                        + "' (seq " + stop.getSequence() + ") has droppingAllowed=true but no dropoff point");
            }
        }

        // Pickup points must reference a valid boarding stop
        if (pickupPoints != null) {
            for (PickupPointType pp : pickupPoints) {
                if (!boardingPlaceIds.contains(pp.getPlaceId())) {
                    throw new BadRequestException(
                            "MISSING_PICKUP_POINT: pickup point placeId '" + pp.getPlaceId()
                            + "' does not match any stop with boardingAllowed=true");
                }
            }
        }

        // Dropoff points must reference a valid dropping stop
        if (dropoffPoints != null) {
            for (DropoffPointType dp : dropoffPoints) {
                if (!droppingPlaceIds.contains(dp.getPlaceId())) {
                    throw new BadRequestException(
                            "MISSING_DROPOFF_POINT: dropoff point placeId '" + dp.getPlaceId()
                            + "' does not match any stop with droppingAllowed=true");
                }
            }
        }
    }
}
