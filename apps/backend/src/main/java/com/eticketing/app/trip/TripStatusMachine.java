package com.eticketing.app.trip;

import com.eticketing.app.web.error.ApiExceptions.BadRequestException;

import java.util.Map;
import java.util.Set;

/**
 * Trip status state machine per TRIP_SPEC section 11.
 * <pre>
 * SCHEDULED ──→ ACTIVE      (admin publishes, booking engine opens)
 * SCHEDULED ──→ CANCELLED   (admin cancels before publish)
 * ACTIVE    ──→ COMPLETED   (final stop reached)
 * ACTIVE    ──→ CANCELLED   (emergency cancellation)
 * COMPLETED ──→ terminal
 * CANCELLED ──→ terminal
 * </pre>
 */
public final class TripStatusMachine {

    private TripStatusMachine() {
    }

    private static final Map<TripStatusEnum, Set<TripStatusEnum>> TRANSITIONS = Map.of(
            TripStatusEnum.SCHEDULED, Set.of(TripStatusEnum.ACTIVE, TripStatusEnum.CANCELLED),
            TripStatusEnum.ACTIVE, Set.of(TripStatusEnum.COMPLETED, TripStatusEnum.CANCELLED),
            TripStatusEnum.COMPLETED, Set.of(),
            TripStatusEnum.CANCELLED, Set.of()
    );

    /**
     * Returns true if the transition from {@code current} to {@code target} is
     * valid.
     */
    public static boolean isValid(TripStatusEnum current, TripStatusEnum target) {
        Set<TripStatusEnum> allowed = TRANSITIONS.get(current);
        return allowed != null && allowed.contains(target);
    }

    /**
     * Asserts the transition is valid; throws a descriptive 409 otherwise.
     */
    public static void assertTransition(TripStatusEnum current, TripStatusEnum target) {
        if (!isValid(current, target)) {
            throw new BadRequestException(
                    "INVALID_STATUS_TRANSITION: cannot transition from "
                    + current + " to " + target);
        }
    }
}
