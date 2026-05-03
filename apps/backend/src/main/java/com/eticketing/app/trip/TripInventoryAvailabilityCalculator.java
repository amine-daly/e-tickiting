package com.eticketing.app.trip;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class TripInventoryAvailabilityCalculator {

    private TripInventoryAvailabilityCalculator() {
    }

    public static Map<String, Integer> buildExpressBookedBySegmentId(TripType trip, List<String> segmentIds) {
        Map<String, Integer> expressBookedBySegmentId = new HashMap<>();
        if (segmentIds == null || segmentIds.isEmpty()) {
            return expressBookedBySegmentId;
        }

        segmentIds.forEach(segmentId -> expressBookedBySegmentId.put(segmentId, 0));

        if (trip == null || trip.getExpressSegments() == null) {
            return expressBookedBySegmentId;
        }

        for (ExpressSegmentType expressSegment : trip.getExpressSegments()) {
            if (expressSegment.getSegmentsCovered() == null || expressSegment.getSegmentsCovered().isEmpty()) {
                continue;
            }

            int bookedCount = Math.max(expressSegment.getBookedCount(), 0);
            if (bookedCount == 0) {
                continue;
            }

            for (String segmentId : expressSegment.getSegmentsCovered()) {
                if (expressBookedBySegmentId.containsKey(segmentId)) {
                    expressBookedBySegmentId.merge(segmentId, bookedCount, Integer::sum);
                }
            }
        }

        return expressBookedBySegmentId;
    }

    public static int computeLocalAvailability(
            List<SegmentType> requestedSegments,
            Map<String, Integer> expressBookedBySegmentId,
            int busTotalSeats) {
        return requestedSegments.stream()
                .mapToInt(segment -> {
                    int bookedCount = Math.max(segment.getBookedCount(), 0);
                    int localRemaining = Math.max(segment.getMaxBooking(), 0) - bookedCount;
                    int physicalRemaining = busTotalSeats
                            - bookedCount
                            - expressBookedBySegmentId.getOrDefault(segment.getSegmentId(), 0);
                    return Math.max(0, Math.min(localRemaining, physicalRemaining));
                })
                .min()
                .orElse(0);
    }

    public static int computeExpressAvailability(
            List<SegmentType> requestedSegments,
            Map<String, Integer> expressBookedBySegmentId,
            int busTotalSeats) {
        return requestedSegments.stream()
                .mapToInt(segment -> {
                    int bookedCount = Math.max(segment.getBookedCount(), 0);
                    return Math.max(
                            0,
                            busTotalSeats
                            - bookedCount
                            - expressBookedBySegmentId.getOrDefault(segment.getSegmentId(), 0));
                })
                .min()
                .orElse(0);
    }
}
