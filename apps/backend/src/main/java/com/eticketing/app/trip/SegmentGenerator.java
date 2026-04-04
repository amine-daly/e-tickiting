package com.eticketing.app.trip;

import com.eticketing.app.web.error.ApiExceptions.BadRequestException;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Auto-generates segments between consecutive commercial stops. Called once at
 * trip creation — segments are frozen afterwards.
 */
public final class SegmentGenerator {

    private SegmentGenerator() {
    }

    /**
     * Input for a single segment provided by the admin at creation time.
     */
    public record SegmentInput(
            BigDecimal basePrice,
            int maxSeats,
            double distanceKm,
            Integer durationMinutesOverride
            ) {

    }

    /**
     * Generates frozen segments from the stop schedule.
     *
     * @param stops validated stop schedule (already passed StopValidator)
     * @param segmentInputs admin inputs, ordered by segment index (0 = first
     * pair of commercial stops)
     * @param busTotalSeats fallback maxSeats if admin input is missing
     * @return list of segments
     */
    public static List<SegmentType> generate(
            List<StopType> stops,
            List<SegmentInput> segmentInputs,
            int busTotalSeats) {

        // Filter commercial stops (boarding OR dropping allowed)
        List<StopType> commercial = stops.stream()
                .filter(s -> s.isBoardingAllowed() || s.isDroppingAllowed())
                .toList();

        if (commercial.size() < 2) {
            throw new BadRequestException(
                    "INVALID_STOP_SEQUENCE: need at least 2 commercial stops to generate segments");
        }

        int expectedSegments = commercial.size() - 1;
        if (segmentInputs != null && segmentInputs.size() != expectedSegments) {
            throw new BadRequestException(
                    "segmentInputs size (" + segmentInputs.size()
                    + ") must match expected segment count (" + expectedSegments + ")");
        }

        List<SegmentType> segments = new ArrayList<>();

        for (int i = 0; i < expectedSegments; i++) {
            StopType from = commercial.get(i);
            StopType to = commercial.get(i + 1);

            SegmentInput input = (segmentInputs != null) ? segmentInputs.get(i) : null;

            int maxSeats = (input != null && input.maxSeats() > 0) ? input.maxSeats() : busTotalSeats;
            BigDecimal basePrice = (input != null && input.basePrice() != null) ? input.basePrice() : BigDecimal.ZERO;
            double distanceKm = (input != null) ? input.distanceKm() : 0;

            int durationMinutes;
            if (input != null && input.durationMinutesOverride() != null) {
                durationMinutes = input.durationMinutesOverride();
            } else if (from.getDepartureTime() != null && to.getArrivalTime() != null) {
                durationMinutes = (int) Duration.between(from.getDepartureTime(), to.getArrivalTime()).toMinutes();
            } else {
                durationMinutes = 0;
            }

            segments.add(SegmentType.builder()
                    .segmentId(UUID.randomUUID().toString())
                    .sequence(i + 1)
                    .fromPlaceId(from.getPlaceId())
                    .toPlaceId(to.getPlaceId())
                    .departureTime(from.getDepartureTime())
                    .arrivalTime(to.getArrivalTime())
                    .maxSeats(maxSeats)
                    .bookedSeats(0)
                    .basePrice(basePrice)
                    .distanceKm(distanceKm)
                    .durationMinutes(durationMinutes)
                    .build());
        }

        return segments;
    }
}
