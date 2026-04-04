package com.eticketing.app.trip;

import com.eticketing.app.web.error.ApiExceptions.BadRequestException;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Guards against stop removal that would break an express fare chain. Per
 * TRIP_SPEC: removing a stop that breaks a chain is hard-blocked with
 * {@code STOP_REMOVAL_BLOCKED_EXPRESS_DEPENDENCY}.
 */
public final class ExpressFareStopGuard {

    private ExpressFareStopGuard() {
    }

    /**
     * Checks whether removing a stop would break any express fare chain.
     *
     * @param placeIdToRemove the placeId of the stop being removed
     * @param segments current trip segments
     * @param expressFares current express fares
     * @throws BadRequestException if removal breaks any chain
     */
    public static void assertRemovalAllowed(
            String placeIdToRemove,
            List<SegmentType> segments,
            List<ExpressFareType> expressFares) {

        if (expressFares == null || expressFares.isEmpty()) {
            return; // no fares → no dependency
        }

        // Build segmentId → SegmentType lookup
        Map<String, SegmentType> segMap = segments.stream()
                .collect(Collectors.toMap(SegmentType::getSegmentId, s -> s));

        for (ExpressFareType fare : expressFares) {
            // Collect all placeIds referenced by this fare's segment chain
            Set<String> chainPlaceIds = fare.getSegmentsCovered().stream()
                    .map(segMap::get)
                    .filter(s -> s != null)
                    .flatMap(s -> java.util.stream.Stream.of(s.getFromPlaceId(), s.getToPlaceId()))
                    .collect(Collectors.toSet());

            if (chainPlaceIds.contains(placeIdToRemove)) {
                throw new BadRequestException(
                        "STOP_REMOVAL_BLOCKED_EXPRESS_DEPENDENCY: stop placeId '"
                        + placeIdToRemove + "' is referenced by express fare '"
                        + fare.getExpressId() + "'");
            }
        }
    }
}
