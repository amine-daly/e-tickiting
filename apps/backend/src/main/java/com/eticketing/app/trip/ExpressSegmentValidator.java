package com.eticketing.app.trip;

import com.eticketing.app.web.error.ApiExceptions.BadRequestException;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Validates express segment chain continuity per TRIP_SPEC section 7.
 */
public final class ExpressSegmentValidator {

    private ExpressSegmentValidator() {
    }

    /**
     * Validates that an express segment's {@code segmentsCovered} forms a
     * continuous chain within the given segments, and that
     * fromPlaceId/toPlaceId match the chain boundaries.
     */
    public static void validate(ExpressSegmentType expressSegment, List<SegmentType> tripSegments) {
        if (expressSegment.getSegmentsCovered() == null || expressSegment.getSegmentsCovered().isEmpty()) {
            throw new BadRequestException("INVALID_EXPRESS_SEGMENT_CHAIN: segmentsCovered must not be empty");
        }
        if (expressSegment.getSegmentsCovered().size() < 2) {
            throw new BadRequestException(
                    "INVALID_EXPRESS_SEGMENT_CHAIN: express segments must cover at least two segments");
        }

        // Build a lookup by segmentId
        Map<String, SegmentType> segMap = tripSegments.stream()
                .collect(Collectors.toMap(SegmentType::getSegmentId, s -> s));

        // Resolve ordered segments
        List<SegmentType> chain = expressSegment.getSegmentsCovered().stream()
                .map(id -> {
                    SegmentType s = segMap.get(id);
                    if (s == null) {
                        throw new BadRequestException(
                                "INVALID_EXPRESS_SEGMENT_CHAIN: segmentId '" + id + "' not found on trip");
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
                        "INVALID_EXPRESS_SEGMENT_CHAIN: break between segment "
                        + current.getSegmentId() + " (to=" + current.getToPlaceId()
                        + ") and " + next.getSegmentId() + " (from=" + next.getFromPlaceId() + ")");
            }
        }

        // Verify boundary places
        SegmentType first = chain.get(0);
        SegmentType last = chain.get(chain.size() - 1);

        if (!first.getFromPlaceId().equals(expressSegment.getFromPlaceId())) {
            throw new BadRequestException(
                    "INVALID_EXPRESS_SEGMENT_CHAIN: fromPlaceId '" + expressSegment.getFromPlaceId()
                    + "' does not match first segment fromPlaceId '" + first.getFromPlaceId() + "'");
        }
        if (!last.getToPlaceId().equals(expressSegment.getToPlaceId())) {
            throw new BadRequestException(
                    "INVALID_EXPRESS_SEGMENT_CHAIN: toPlaceId '" + expressSegment.getToPlaceId()
                    + "' does not match last segment toPlaceId '" + last.getToPlaceId() + "'");
        }
    }

    /**
     * Validates all express segments on a trip.
     */
    public static void validateAll(List<ExpressSegmentType> expressSegments, List<SegmentType> segments) {
        if (expressSegments == null) {
            return;
        }
        for (ExpressSegmentType expressSegment : expressSegments) {
            validate(expressSegment, segments);
        }
    }

    /**
     * Computes totalDistanceKm from covered segments (read-time enrichment).
     */
    public static double computeTotalDistanceKm(ExpressSegmentType expressSegment, List<SegmentType> segments) {
        Map<String, SegmentType> segMap = segments.stream()
                .collect(Collectors.toMap(SegmentType::getSegmentId, s -> s));
        return expressSegment.getSegmentsCovered().stream()
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
    public static int computeTotalDurationMinutes(ExpressSegmentType expressSegment, List<SegmentType> segments) {
        Map<String, SegmentType> segMap = segments.stream()
                .collect(Collectors.toMap(SegmentType::getSegmentId, s -> s));
        return expressSegment.getSegmentsCovered().stream()
                .mapToInt(id -> {
                    SegmentType s = segMap.get(id);
                    return s != null ? s.getDurationMinutes() : 0;
                })
                .sum();
    }
}
