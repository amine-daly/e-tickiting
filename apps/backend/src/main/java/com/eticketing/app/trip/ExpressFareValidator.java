package com.eticketing.app.trip;

import com.eticketing.app.web.error.ApiExceptions.BadRequestException;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Validates express fare chain continuity per TRIP_SPEC section 7.
 */
public final class ExpressFareValidator {

    private ExpressFareValidator() {
    }

    /**
     * Validates that an express fare's {@code segmentsCovered} forms a
     * continuous chain within the given segments, and that
     * fromPlaceId/toPlaceId match the chain boundaries.
     */
    public static void validate(ExpressFareType fare, List<SegmentType> tripSegments) {
        if (fare.getSegmentsCovered() == null || fare.getSegmentsCovered().isEmpty()) {
            throw new BadRequestException("INVALID_EXPRESS_FARE_CHAIN: segmentsCovered must not be empty");
        }

        // Build a lookup by segmentId
        Map<String, SegmentType> segMap = tripSegments.stream()
                .collect(Collectors.toMap(SegmentType::getSegmentId, s -> s));

        // Resolve ordered segments
        List<SegmentType> chain = fare.getSegmentsCovered().stream()
                .map(id -> {
                    SegmentType s = segMap.get(id);
                    if (s == null) {
                        throw new BadRequestException(
                                "INVALID_EXPRESS_FARE_CHAIN: segmentId '" + id + "' not found on trip");
                    }
                    return s;
                })
                .toList();

        // Verify chain continuity
        for (int i = 0; i < chain.size() - 1; i++) {
            SegmentType current = chain.get(i);
            SegmentType next = chain.get(i + 1);
            if (!current.getToPlaceId().equals(next.getFromPlaceId())) {
                throw new BadRequestException(
                        "INVALID_EXPRESS_FARE_CHAIN: break between segment "
                        + current.getSegmentId() + " (to=" + current.getToPlaceId()
                        + ") and " + next.getSegmentId() + " (from=" + next.getFromPlaceId() + ")");
            }
        }

        // Verify boundary places
        SegmentType first = chain.get(0);
        SegmentType last = chain.get(chain.size() - 1);

        if (!first.getFromPlaceId().equals(fare.getFromPlaceId())) {
            throw new BadRequestException(
                    "INVALID_EXPRESS_FARE_CHAIN: fromPlaceId '" + fare.getFromPlaceId()
                    + "' does not match first segment fromPlaceId '" + first.getFromPlaceId() + "'");
        }
        if (!last.getToPlaceId().equals(fare.getToPlaceId())) {
            throw new BadRequestException(
                    "INVALID_EXPRESS_FARE_CHAIN: toPlaceId '" + fare.getToPlaceId()
                    + "' does not match last segment toPlaceId '" + last.getToPlaceId() + "'");
        }
    }

    /**
     * Validates all express fares on a trip.
     */
    public static void validateAll(List<ExpressFareType> fares, List<SegmentType> segments) {
        if (fares == null) {
            return;
        }
        for (ExpressFareType fare : fares) {
            validate(fare, segments);
        }
    }

    /**
     * Computes totalDistanceKm from covered segments (read-time enrichment).
     */
    public static double computeTotalDistanceKm(ExpressFareType fare, List<SegmentType> segments) {
        Map<String, SegmentType> segMap = segments.stream()
                .collect(Collectors.toMap(SegmentType::getSegmentId, s -> s));
        return fare.getSegmentsCovered().stream()
                .mapToDouble(id -> {
                    SegmentType s = segMap.get(id);
                    return s != null ? s.getDistanceKm() : 0;
                })
                .sum();
    }

    /**
     * Computes totalDurationMinutes from covered segments (read-time
     * enrichment).
     */
    public static int computeTotalDurationMinutes(ExpressFareType fare, List<SegmentType> segments) {
        Map<String, SegmentType> segMap = segments.stream()
                .collect(Collectors.toMap(SegmentType::getSegmentId, s -> s));
        return fare.getSegmentsCovered().stream()
                .mapToInt(id -> {
                    SegmentType s = segMap.get(id);
                    return s != null ? s.getDurationMinutes() : 0;
                })
                .sum();
    }
}
