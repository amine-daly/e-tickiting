package com.eticketing.app.trip;

import com.eticketing.app.web.error.ApiExceptions.BadRequestException;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Validates the stop schedule per TRIP_SPEC section 4.
 */
public final class StopValidator {

    private StopValidator() {
    }

    /**
     * Run ALL stop-schedule validation rules. Throws on first violation.
     */
    public static void validate(List<StopType> stops) {
        if (stops == null || stops.size() < 2) {
            throw new BadRequestException("INVALID_STOP_SEQUENCE: at least 2 stops are required");
        }

        validateSequence(stops);
        validateTimeline(stops);
        validateFirstAndLastStop(stops);
        validateMinCommercialStops(stops);
    }

    // ── Sequence ────────────────────────────────────────────────────────
    private static void validateSequence(List<StopType> stops) {
        Set<Integer> seen = new HashSet<>();
        int prev = Integer.MIN_VALUE;
        for (StopType s : stops) {
            int seq = s.getSequence();
            if (!seen.add(seq)) {
                throw new BadRequestException(
                        "INVALID_STOP_SEQUENCE: duplicate sequence " + seq);
            }
            if (seq <= prev) {
                throw new BadRequestException(
                        "INVALID_STOP_SEQUENCE: sequence must be strictly ascending (found " + seq + " after " + prev + ")");
            }
            prev = seq;
        }
    }

    // ── Timeline ────────────────────────────────────────────────────────
    private static void validateTimeline(List<StopType> stops) {
        Instant lastTime = null;

        for (int i = 0; i < stops.size(); i++) {
            StopType s = stops.get(i);

            // Check arrivalTime (null only for first stop — handled in validateFirstAndLastStop)
            if (s.getArrivalTime() != null) {
                if (lastTime != null && !s.getArrivalTime().isAfter(lastTime)) {
                    throw new BadRequestException(
                            "INVALID_TIMELINE: arrivalTime at sequence " + s.getSequence()
                            + " must be after previous timestamp");
                }
                lastTime = s.getArrivalTime();
            }

            // For intermediate stops: departureTime >= arrivalTime
            if (s.getArrivalTime() != null && s.getDepartureTime() != null) {
                if (s.getDepartureTime().isBefore(s.getArrivalTime())) {
                    throw new BadRequestException(
                            "INVALID_TIMELINE: departureTime < arrivalTime at sequence " + s.getSequence());
                }
            }

            // Check departureTime (null only for last stop)
            if (s.getDepartureTime() != null) {
                if (lastTime != null && !s.getDepartureTime().isAfter(lastTime)
                        && s.getArrivalTime() != null) {
                    // departureTime must be >= arrivalTime (already checked above)
                    // but also strictly after previous stop's last timestamp
                }
                lastTime = s.getDepartureTime();
            }
        }
    }

    // ── First / Last stop rules ─────────────────────────────────────────
    private static void validateFirstAndLastStop(List<StopType> stops) {
        StopType first = stops.get(0);
        StopType last = stops.get(stops.size() - 1);

        if (first.getArrivalTime() != null) {
            throw new BadRequestException(
                    "INVALID_TIMELINE: first stop (sequence " + first.getSequence() + ") must have arrivalTime = null");
        }
        if (last.getDepartureTime() != null) {
            throw new BadRequestException(
                    "INVALID_TIMELINE: last stop (sequence " + last.getSequence() + ") must have departureTime = null");
        }
    }

    // ── Minimum commercial stops ────────────────────────────────────────
    private static void validateMinCommercialStops(List<StopType> stops) {
        long count = stops.stream()
                .filter(s -> s.isBoardingAllowed() || s.isDroppingAllowed())
                .count();
        if (count < 2) {
            throw new BadRequestException(
                    "INVALID_STOP_SEQUENCE: at least 2 commercial stops required (found " + count + ")");
        }
    }
}
