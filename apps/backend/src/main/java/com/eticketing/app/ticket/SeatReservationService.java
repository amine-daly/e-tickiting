package com.eticketing.app.ticket;

import com.mongodb.client.result.UpdateResult;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Atomic CAS (Compare-And-Swap) seat reservation on trip segments. Uses MongoDB
 * updateOne with $inc and a capacity guard to guarantee no over-booking — per
 * TRIP_SPEC section 10 step 3.
 */
@Service
@RequiredArgsConstructor
public class SeatReservationService {

    private static final Logger LOG = LoggerFactory.getLogger(SeatReservationService.class);

    private final MongoTemplate mongoTemplate;

    /**
     * Atomically increments bookedSeats on every segment in {@code segmentIds}
     * for the given trip. If ANY segment lacks capacity the entire operation is
     * rolled back (decrements already-incremented segments).
     *
     * @return true if all segments were reserved; false if capacity exceeded.
     */
    public boolean reserveSeats(String tripId, List<String> segmentIds) {
        // Try to increment each segment's bookedSeats atomically
        int reserved = 0;
        for (String segId : segmentIds) {
            boolean ok = incrementSeat(tripId, segId);
            if (!ok) {
                // Roll back already-reserved segments
                LOG.warn("SEGMENT_CAPACITY_EXCEEDED on segment {} for trip {}. Rolling back {} segments.",
                        segId, tripId, reserved);
                rollback(tripId, segmentIds.subList(0, reserved));
                return false;
            }
            reserved++;
        }
        return true;
    }

    /**
     * Atomically decrements bookedSeats on every segment in {@code segmentIds}
     * for the given trip. Used when releasing seats (expiry, refund approval).
     */
    public void releaseSeats(String tripId, List<String> segmentIds) {
        for (String segId : segmentIds) {
            decrementSeat(tripId, segId);
        }
    }

    // ── Internals ───────────────────────────────────────────────────────
    /**
     * CAS increment: updates only if bookedSeats < maxSeats on the matching
     * segment embedded inside the trip document.
     */
    private boolean incrementSeat(String tripId, String segmentId) {
        Query query = new Query(Criteria.where("_id").is(tripId)
                .and("segments.segmentId").is(segmentId));
        // Use $expr to compare bookedSeats < maxSeats on the matched segment
        // Simpler approach: use elemMatch with a $where-less pattern
        // MongoDB supports $inc with a condition by matching on the current value
        // We use the "positional $ operator" trick:
        //   match: segments.segmentId = X AND segments.bookedSeats < segments.maxSeats
        // Unfortunately, MongoDB doesn't allow cross-field comparisons in simple queries.
        // So we use an Aggregation Pipeline Update.

        // Step 1: Find the trip and check capacity
        Query findQuery = new Query(Criteria.where("_id").is(tripId));
        com.eticketing.app.trip.TripType trip = mongoTemplate.findOne(findQuery, com.eticketing.app.trip.TripType.class, "trips");
        if (trip == null) {
            return false;
        }

        com.eticketing.app.trip.SegmentType seg = trip.getSegments().stream()
                .filter(s -> s.getSegmentId().equals(segmentId))
                .findFirst()
                .orElse(null);
        if (seg == null || seg.getBookedSeats() >= seg.getMaxSeats()) {
            return false;
        }

        // Step 2: Atomic CAS — increment only if bookedSeats hasn't changed
        Query casQuery = new Query(Criteria.where("_id").is(tripId)
                .and("segments").elemMatch(
                Criteria.where("segmentId").is(segmentId)
                        .and("bookedSeats").is(seg.getBookedSeats())));
        Update update = new Update().inc("segments.$.bookedSeats", 1);
        UpdateResult result = mongoTemplate.updateFirst(casQuery, update, "trips");
        return result.getModifiedCount() == 1;
    }

    private void decrementSeat(String tripId, String segmentId) {
        // Decrement only if bookedSeats > 0
        Query query = new Query(Criteria.where("_id").is(tripId)
                .and("segments").elemMatch(
                Criteria.where("segmentId").is(segmentId)
                        .and("bookedSeats").gt(0)));
        Update update = new Update().inc("segments.$.bookedSeats", -1);
        UpdateResult result = mongoTemplate.updateFirst(query, update, "trips");
        if (result.getModifiedCount() != 1) {
            LOG.warn("Seat decrement failed for trip={} segment={} — bookedSeats may already be 0", tripId, segmentId);
        }
    }

    private void rollback(String tripId, List<String> segmentIds) {
        for (String segId : segmentIds) {
            decrementSeat(tripId, segId);
        }
    }
}
