package com.eticketing.app.trip;

import com.eticketing.app.web.error.ApiExceptions.BadRequestException;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Guards against stop removal that would break an express segment chain. Per
 * TRIP_SPEC: removing a stop that breaks a chain is hard-blocked with
 * {@code STOP_REMOVAL_BLOCKED_EXPRESS_SEGMENT_DEPENDENCY}.
 */
public final class ExpressSegmentStopGuard {

    private ExpressSegmentStopGuard() {
    }

    /**
     * Checks whether removing a stop would break any express segment chain.
     *
     * @param placeIdToRemove the placeId of the stop being removed
     * @param segments current trip segments
     * @param expressSegments current express segments
     * @throws BadRequestException if removal breaks any chain
     */
    public static void assertRemovalAllowed(
            String placeIdToRemove,
            List<SegmentType> segments,
            List<ExpressSegmentType> expressSegments) {

        if (expressSegments == null || expressSegments.isEmpty()) {
            return; // no express segments -> no dependency
        }

        // Build segmentId → SegmentType lookup
        Map<String, SegmentType> segMap = segments.stream()
                .collect(Collectors.toMap(SegmentType::getSegmentId, s -> s));

        for (ExpressSegmentType expressSegment : expressSegments) {
            // Collect all placeIds referenced by this express segment's chain
            Set<String> chainPlaceIds = expressSegment.getSegmentsCovered().stream()
                    .map(segMap::get)
                    .filter(s -> s != null)
                    .flatMap(s -> java.util.stream.Stream.of(
                    TripPlaceRef.idOf(s.getFromPlace()),
                    TripPlaceRef.idOf(s.getToPlace())))
                    .collect(Collectors.toSet());

            if (chainPlaceIds.contains(placeIdToRemove)) {
                throw new BadRequestException(
                        "STOP_REMOVAL_BLOCKED_EXPRESS_SEGMENT_DEPENDENCY: stop placeId '"
                        + placeIdToRemove + "' is referenced by express segment '"
                        + expressSegment.getExpressSegmentId() + "'");
            }
        }
    }
}
