package com.eticketing.app.trip;

import com.eticketing.app.trip.dto.TripUpdateRequest;
import com.eticketing.app.web.error.ApiExceptions.BadRequestException;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Enforces field-level edit permissions per TRIP_SPEC section 12.
 * <p>
 * SCHEDULED: all fields freely editable (except segments — frozen always).
 * ACTIVE: conditional restrictions based on bookings and business rules.
 */
public final class TripEditRules {

    private TripEditRules() {
    }

    /**
     * Validates that the proposed update is allowed given the trip's current
     * state.
     *
     * @param existing the trip as currently persisted
     * @param req the incoming update request
     * @param newBusTotalSeats totalSeats of the new bus (only needed if bus
     * changes)
     */
    public static void validate(TripType existing, TripUpdateRequest req, Integer newBusTotalSeats) {
        // Segments are ALWAYS frozen — TripUpdateRequest doesn't even have a segments field

        if (existing.getStatus() == TripStatusEnum.SCHEDULED) {
            validateScheduled(existing, req);
        } else if (existing.getStatus() == TripStatusEnum.ACTIVE) {
            validateActive(existing, req, newBusTotalSeats);
        } else {
            // COMPLETED / CANCELLED — only status transition allowed
            if (hasNonStatusChanges(req)) {
                throw new BadRequestException(
                        "Trip is " + existing.getStatus() + " — only status transitions allowed");
            }
        }
    }

    // ── SCHEDULED: mostly free, check express fare stop guard ───────────
    private static void validateScheduled(TripType existing, TripUpdateRequest req) {
        if (req.getStopSchedule() != null) {
            // Check if any removed stops break express fares
            Set<String> newPlaceIds = req.getStopSchedule().stream()
                    .map(TripUpdateRequest.StopInput::getPlaceId)
                    .collect(Collectors.toSet());

            for (StopType existingStop : existing.getStopSchedule()) {
                if (!newPlaceIds.contains(existingStop.getPlaceId())) {
                    ExpressFareStopGuard.assertRemovalAllowed(
                            existingStop.getPlaceId(),
                            existing.getSegments(),
                            existing.getExpressFares());
                }
            }
        }
    }

    // ── ACTIVE: restricted edits ────────────────────────────────────────
    private static void validateActive(TripType existing, TripUpdateRequest req, Integer newBusTotalSeats) {
        // departureDate & currency: BLOCKED
        if (req.getDepartureDate() != null) {
            throw new BadRequestException("BLOCKED: departureDate cannot be changed on ACTIVE trip");
        }
        if (req.getCurrency() != null) {
            throw new BadRequestException("BLOCKED: currency cannot be changed on ACTIVE trip");
        }

        // Stop removal: BLOCKED on active trips
        if (req.getStopSchedule() != null) {
            Set<String> existingPlaceIds = existing.getStopSchedule().stream()
                    .map(StopType::getPlaceId)
                    .collect(Collectors.toSet());
            Set<String> newPlaceIds = req.getStopSchedule().stream()
                    .map(TripUpdateRequest.StopInput::getPlaceId)
                    .collect(Collectors.toSet());

            // Check for removals
            for (String placeId : existingPlaceIds) {
                if (!newPlaceIds.contains(placeId)) {
                    throw new BadRequestException(
                            "BLOCKED: cannot remove stops from ACTIVE trip");
                }
            }

            // Check stop time changes when segment has bookings
            validateStopTimeChanges(existing, req.getStopSchedule());
        }

        // Bus reassignment: capacity check
        if (req.getBus() != null && newBusTotalSeats != null) {
            int maxBooked = existing.getSegments().stream()
                    .mapToInt(SegmentType::getBookedSeats)
                    .max()
                    .orElse(0);
            if (newBusTotalSeats < maxBooked) {
                throw new BadRequestException(
                        "BUS_REASSIGNMENT_BLOCKED_INSUFFICIENT_CAPACITY: new bus totalSeats ("
                        + newBusTotalSeats + ") < max bookedSeats (" + maxBooked + ")");
            }
        }
    }

    /**
     * Stop time changes are blocked when any segment touching that stop has
     * bookedSeats > 0.
     */
    private static void validateStopTimeChanges(TripType existing, List<TripUpdateRequest.StopInput> newStops) {
        // Build map: placeId → existing stop
        var existingByPlace = existing.getStopSchedule().stream()
                .collect(Collectors.toMap(StopType::getPlaceId, s -> s));

        for (TripUpdateRequest.StopInput ns : newStops) {
            StopType es = existingByPlace.get(ns.getPlaceId());
            if (es == null) {
                continue; // new stop being added — allowed
            }
            boolean timeChanged
                    = !java.util.Objects.equals(es.getArrivalTime(), ns.getArrivalTime())
                    || !java.util.Objects.equals(es.getDepartureTime(), ns.getDepartureTime());

            if (timeChanged) {
                // Check if any segment references this stop and has bookings
                boolean hasBookings = existing.getSegments().stream()
                        .filter(seg -> seg.getFromPlaceId().equals(ns.getPlaceId())
                        || seg.getToPlaceId().equals(ns.getPlaceId()))
                        .anyMatch(seg -> seg.getBookedSeats() > 0);

                if (hasBookings) {
                    throw new BadRequestException(
                            "BLOCKED: cannot change stop times for placeId '"
                            + ns.getPlaceId()
                            + "' — segment has active bookings");
                }
            }
        }
    }

    private static boolean hasNonStatusChanges(TripUpdateRequest req) {
        return req.getDepartureDate() != null
                || req.getTimezone() != null
                || req.getCurrency() != null
                || req.getSeatHoldMinutes() != null
                || req.getBus() != null
                || req.getStopSchedule() != null
                || req.getPickupPoints() != null
                || req.getDropoffPoints() != null;
    }
}
