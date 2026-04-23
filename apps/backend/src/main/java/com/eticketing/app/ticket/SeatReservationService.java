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
        return reserveSeats(tripId, segmentIds, 1);
    }

    /**
     * Atomically reserves {@code count} seats on every segment in
     * {@code segmentIds}. Used for group bookings where N passengers need seats
     * on the same segments.
     *
     * @return true if all segments were reserved; false if capacity exceeded.
     */
    public boolean reserveSeats(String tripId, List<String> segmentIds, int count) {
        int reserved = 0;
        for (String segId : segmentIds) {
            boolean ok = incrementSeat(tripId, segId, count);
            if (!ok) {
                LOG.warn("SEGMENT_CAPACITY_EXCEEDED on segment {} for trip {} (count={}). Rolling back {} segments.",
                        segId, tripId, count, reserved);
                rollback(tripId, segmentIds.subList(0, reserved), count);
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
        releaseSeats(tripId, segmentIds, 1);
    }

    /**
     * Releases {@code count} seats on every segment. Used for group booking
     * expiry/cancellation.
     */
    public void releaseSeats(String tripId, List<String> segmentIds, int count) {
        for (String segId : segmentIds) {
            decrementSeat(tripId, segId, count);
        }
    }

    // ── Internals ───────────────────────────────────────────────────────
    /**
     * CAS increment: updates only if bookedSeats + count <= maxSeats on the
     * matching segment embedded inside the trip document.
     */
    private boolean incrementSeat(String tripId, String segmentId, int count) {
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
        if (seg == null || seg.getBookedSeats() + count > seg.getMaxSeats()) {
            return false;
        }

        // Step 2: Atomic CAS — increment only if bookedSeats hasn't changed
        Query casQuery = new Query(Criteria.where("_id").is(tripId)
                .and("segments").elemMatch(
                Criteria.where("segmentId").is(segmentId)
                        .and("bookedSeats").is(seg.getBookedSeats())));
        Update update = new Update().inc("segments.$.bookedSeats", count);
        UpdateResult result = mongoTemplate.updateFirst(casQuery, update, "trips");
        return result.getModifiedCount() == 1;
    }

    private void decrementSeat(String tripId, String segmentId, int count) {
        Query query = new Query(Criteria.where("_id").is(tripId)
                .and("segments").elemMatch(
                Criteria.where("segmentId").is(segmentId)
                        .and("bookedSeats").gte(count)));
        Update update = new Update().inc("segments.$.bookedSeats", -count);
        UpdateResult result = mongoTemplate.updateFirst(query, update, "trips");
        if (result.getModifiedCount() != 1) {
            LOG.error("Seat decrement failed for trip={} segment={} count={} — bookedSeats may be insufficient and inventory reconciliation may be required", tripId, segmentId, count);
        }
    }

    private void rollback(String tripId, List<String> segmentIds, int count) {
        for (String segId : segmentIds) {
            decrementSeat(tripId, segId, count);
        }
    }
}
