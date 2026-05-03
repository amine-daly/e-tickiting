package com.eticketing.app.trip;

import com.eticketing.app.bus.BusType;
import com.eticketing.app.trip.dto.TripRouteAvailabilityResponse;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.fail;

class NestedInventoryScenarioSuiteTest {

    private static final int BUS_TOTAL_SEATS = 51;

    private static final String PLACE_DJERBA = "DJERBA";
    private static final String PLACE_SFAX = "SFAX";
    private static final String PLACE_TUNIS = "TUNIS";

    private static final String SEGMENT_1_ID = "seg-1";
    private static final String SEGMENT_2_ID = "seg-2";
    private static final String EXPRESS_SEGMENT_ID = "express-1";

    @Test
    void nestedInventoryScenarioSuite() {
        List<Scenario> scenarios = List.of(
                new Scenario(
                        "TEST 1: Empty Bus",
                        List.of(),
                        new AvailabilitySnapshot(51, 12, 20),
                        BookingError.NONE),
                new Scenario(
                        "TEST 2: Seg 1 Ceiling Reached",
                        List.of(new BookingCommand(BookingKind.LOCAL_SEG1, 12)),
                        new AvailabilitySnapshot(39, 0, 20),
                        BookingError.NONE),
                new Scenario(
                        "TEST 3: Seg 2 Ceiling Reached",
                        List.of(new BookingCommand(BookingKind.LOCAL_SEG2, 20)),
                        new AvailabilitySnapshot(31, 12, 0),
                        BookingError.NONE),
                new Scenario(
                        "TEST 4: Physical Restriction (High Express Demand)",
                        List.of(new BookingCommand(BookingKind.EXPRESS, 45)),
                        new AvailabilitySnapshot(6, 6, 6),
                        BookingError.NONE),
                new Scenario(
                        "TEST 5: Full Bus Via Express",
                        List.of(new BookingCommand(BookingKind.EXPRESS, 51)),
                        new AvailabilitySnapshot(0, 0, 0),
                        BookingError.NONE),
                new Scenario(
                        "TEST 6: Final Bottleneck (Sfax -> Tunis Full)",
                        List.of(
                                new BookingCommand(BookingKind.EXPRESS, 31),
                                new BookingCommand(BookingKind.LOCAL_SEG2, 20)),
                        new AvailabilitySnapshot(0, 12, 0),
                        BookingError.NONE),
                new Scenario(
                        "TEST 7: Initial Bottleneck (Djerba -> Sfax Full)",
                        List.of(
                                new BookingCommand(BookingKind.EXPRESS, 39),
                                new BookingCommand(BookingKind.LOCAL_SEG1, 12)),
                        new AvailabilitySnapshot(0, 0, 12),
                        BookingError.NONE),
                new Scenario(
                        "TEST 8: Ceiling Rejection",
                        List.of(new BookingCommand(BookingKind.LOCAL_SEG1, 13)),
                        new AvailabilitySnapshot(51, 12, 20),
                        BookingError.CEILING_EXCEEDED),
                new Scenario(
                        "TEST 9: Physical Capacity Rejection",
                        List.of(new BookingCommand(BookingKind.EXPRESS, 52)),
                        new AvailabilitySnapshot(51, 12, 20),
                        BookingError.CAPACITY_EXCEEDED),
                new Scenario(
                        "TEST 10: Physical/Ceiling Conflict",
                        List.of(
                                new BookingCommand(BookingKind.EXPRESS, 40),
                                new BookingCommand(BookingKind.LOCAL_SEG1, 12)),
                        new AvailabilitySnapshot(11, 11, 11),
                        BookingError.CAPACITY_EXCEEDED));

        for (Scenario scenario : scenarios) {
            TripType trip = resetInventory();
            ScenarioResult result = executeScenario(trip, scenario);
            if (!result.passed()) {
                fail(result.observation());
            }
        }
    }

    private TripType resetInventory() {
        return TripType.builder()
                .id("trip-nested-inventory")
                .departureDate(Instant.parse("2026-05-10T08:00:00Z"))
                .bus(TripBusRef.builder().busId("bus-51").build())
                .currency(TripCurrency.builder().currencyId("currency-tnd").build())
                .stopSchedule(List.of(
                        stop(PLACE_DJERBA, 1, null, Instant.parse("2026-05-10T08:00:00Z"), true, false),
                        stop(PLACE_SFAX, 2, Instant.parse("2026-05-10T11:00:00Z"), Instant.parse("2026-05-10T11:05:00Z"), true, true),
                        stop(PLACE_TUNIS, 3, Instant.parse("2026-05-10T14:15:00Z"), null, false, true)))
                .segments(List.of(
                        segment(SEGMENT_1_ID, 1, PLACE_DJERBA, PLACE_SFAX, 20, 12, 0, 12),
                        segment(SEGMENT_2_ID, 2, PLACE_SFAX, PLACE_TUNIS, 25, 20, 0, 20)))
                .expressSegments(List.of(
                        expressSegment(EXPRESS_SEGMENT_ID, PLACE_DJERBA, PLACE_TUNIS, List.of(SEGMENT_1_ID, SEGMENT_2_ID), 33, 0, true)))
                .build();
    }

    private ScenarioResult executeScenario(TripType trip, Scenario scenario) {
        BookingOutcome finalOutcome = BookingOutcome.success("No booking actions executed.");

        for (BookingCommand command : scenario.commands()) {
            finalOutcome = bookTickets(trip, command.kind(), command.count());
            if (!finalOutcome.success()) {
                break;
            }
        }

        AvailabilitySnapshot actualAvailability = checkAvailability(trip);

        if (scenario.expectedError() == BookingError.NONE) {
            if (!finalOutcome.success()) {
                return ScenarioResult.fail(
                        scenario.name(),
                        "Expected successful bookings, but got error " + finalOutcome.error() + " (" + finalOutcome.observation() + ").");
            }
        } else {
            if (finalOutcome.success()) {
                return ScenarioResult.fail(
                        scenario.name(),
                        "Expected error " + scenario.expectedError() + " but all bookings succeeded.");
            }
            if (finalOutcome.error() != scenario.expectedError()) {
                return ScenarioResult.fail(
                        scenario.name(),
                        "Expected error " + scenario.expectedError() + " but got " + finalOutcome.error() + " (" + finalOutcome.observation() + ").");
            }
        }

        if (!scenario.expectedAvailability().equals(actualAvailability)) {
            return ScenarioResult.fail(
                    scenario.name(),
                    "Expected availability " + scenario.expectedAvailability().format()
                    + " but got " + actualAvailability.format() + "."
                    + (finalOutcome.success() ? "" : " Last booking error: " + finalOutcome.observation()));
        }

        String observation = scenario.expectedError() == BookingError.NONE
                ? "Observed " + actualAvailability.format() + "."
                : "Received expected " + scenario.expectedError() + "; state remained " + actualAvailability.format() + ".";
        return ScenarioResult.pass(scenario.name(), observation);
    }

    private BookingOutcome bookTickets(TripType trip, BookingKind kind, int count) {
        return switch (kind) {
            case EXPRESS ->
                bookExpress(trip, count);
            case LOCAL_SEG1 ->
                bookLocal(trip, List.of(SEGMENT_1_ID), count);
            case LOCAL_SEG2 ->
                bookLocal(trip, List.of(SEGMENT_2_ID), count);
        };
    }

    private BookingOutcome bookLocal(TripType trip, List<String> segmentIds, int count) {
        List<SegmentType> requestedSegments = resolveSegments(trip, segmentIds);
        Map<String, Integer> expressBookedBySegmentId = TripInventoryAvailabilityCalculator.buildExpressBookedBySegmentId(trip, segmentIds);

        int localAvailability = TripInventoryAvailabilityCalculator.computeLocalAvailability(
                requestedSegments,
                expressBookedBySegmentId,
                BUS_TOTAL_SEATS);

        int ceilingRemaining = requestedSegments.stream()
                .mapToInt(segment -> Math.max(segment.getMaxBooking(), 0) - Math.max(segment.getBookedCount(), 0))
                .min()
                .orElse(0);
        int physicalRemaining = requestedSegments.stream()
                .mapToInt(segment -> Math.max(
                0,
                BUS_TOTAL_SEATS
                - Math.max(segment.getBookedCount(), 0)
                - expressBookedBySegmentId.getOrDefault(segment.getSegmentId(), 0)))
                .min()
                .orElse(0);

        if (count > localAvailability) {
            BookingError error = physicalRemaining < ceilingRemaining
                    ? BookingError.CAPACITY_EXCEEDED
                    : BookingError.CEILING_EXCEEDED;
            return BookingOutcome.failure(
                    error,
                    "Requested " + count + " LOCAL but only " + localAvailability
                    + " seats are available (ceiling=" + ceilingRemaining
                    + ", physical=" + physicalRemaining + ").");
        }

        requestedSegments.forEach(segment -> segment.setBookedCount(segment.getBookedCount() + count));
        return BookingOutcome.success("Booked " + count + " LOCAL tickets on " + segmentIds + '.');
    }

    private BookingOutcome bookExpress(TripType trip, int count) {
        ExpressSegmentType expressSegment = trip.getExpressSegments().stream()
                .filter(segment -> EXPRESS_SEGMENT_ID.equals(segment.getExpressSegmentId()))
                .findFirst()
                .orElse(null);
        if (expressSegment == null) {
            return BookingOutcome.failure(BookingError.CAPACITY_EXCEEDED, "Express segment not found.");
        }

        List<SegmentType> requestedSegments = resolveSegments(trip, expressSegment.getSegmentsCovered());
        Map<String, Integer> expressBookedBySegmentId = TripInventoryAvailabilityCalculator.buildExpressBookedBySegmentId(
                trip,
                expressSegment.getSegmentsCovered());
        int availability = TripInventoryAvailabilityCalculator.computeExpressAvailability(
                requestedSegments,
                expressBookedBySegmentId,
                BUS_TOTAL_SEATS);

        if (count > availability) {
            return BookingOutcome.failure(
                    BookingError.CAPACITY_EXCEEDED,
                    "Requested " + count + " EXPRESS but only " + availability + " seats are available.");
        }

        expressSegment.setBookedCount(expressSegment.getBookedCount() + count);
        return BookingOutcome.success("Booked " + count + " EXPRESS tickets.");
    }

    private AvailabilitySnapshot checkAvailability(TripType trip) {
        TripRouteAvailabilityResponse express = TripMarketplaceProjectionFactory.buildRouteAvailability(
                trip,
                PLACE_DJERBA,
                PLACE_TUNIS,
                bus(),
                "TND");
        TripRouteAvailabilityResponse localSeg1 = TripMarketplaceProjectionFactory.buildRouteAvailability(
                trip,
                PLACE_DJERBA,
                PLACE_SFAX,
                bus(),
                "TND");
        TripRouteAvailabilityResponse localSeg2 = TripMarketplaceProjectionFactory.buildRouteAvailability(
                trip,
                PLACE_SFAX,
                PLACE_TUNIS,
                bus(),
                "TND");

        assertNotNull(express, "Express route availability should resolve.");
        assertNotNull(localSeg1, "Local segment 1 availability should resolve.");
        assertNotNull(localSeg2, "Local segment 2 availability should resolve.");

        return new AvailabilitySnapshot(
                express.getAvailableSeats(),
                localSeg1.getAvailableSeats(),
                localSeg2.getAvailableSeats());
    }

    private List<SegmentType> resolveSegments(TripType trip, List<String> segmentIds) {
        return segmentIds.stream()
                .map(segmentId -> trip.getSegments().stream()
                .filter(segment -> segmentId.equals(segment.getSegmentId()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Missing segment " + segmentId)))
                .toList();
    }

    private BusType bus() {
        return BusType.builder().id("bus-51").totalSeats(BUS_TOTAL_SEATS).build();
    }

    private StopType stop(
            String placeId,
            int sequence,
            Instant arrivalTime,
            Instant departureTime,
            boolean boardingAllowed,
            boolean droppingAllowed) {
        return StopType.builder()
                .placeId(placeId)
                .sequence(sequence)
                .arrivalTime(arrivalTime)
                .departureTime(departureTime)
                .boardingAllowed(boardingAllowed)
                .droppingAllowed(droppingAllowed)
                .build();
    }

    private SegmentType segment(
            String segmentId,
            int sequence,
            String fromPlaceId,
            String toPlaceId,
            int basePrice,
            int durationMinutes,
            int bookedCount,
            int maxBooking) {
        return SegmentType.builder()
                .segmentId(segmentId)
                .sequence(sequence)
                .fromPlaceId(fromPlaceId)
                .toPlaceId(toPlaceId)
                .basePrice(BigDecimal.valueOf(basePrice))
                .durationMinutes(durationMinutes)
                .bookedCount(bookedCount)
                .maxBooking(maxBooking)
                .build();
    }

    private ExpressSegmentType expressSegment(
            String expressSegmentId,
            String fromPlaceId,
            String toPlaceId,
            List<String> segmentsCovered,
            int price,
            int bookedCount,
            boolean active) {
        return ExpressSegmentType.builder()
                .expressSegmentId(expressSegmentId)
                .fromPlaceId(fromPlaceId)
                .toPlaceId(toPlaceId)
                .segmentsCovered(segmentsCovered)
                .price(BigDecimal.valueOf(price))
                .bookedCount(bookedCount)
                .validFrom(Instant.parse("2025-01-01T00:00:00Z"))
                .validUntil(Instant.parse("2027-12-31T23:59:59Z"))
                .active(active)
                .build();
    }

    private enum BookingKind {
        EXPRESS,
        LOCAL_SEG1,
        LOCAL_SEG2
    }

    private enum BookingError {
        NONE,
        CEILING_EXCEEDED,
        CAPACITY_EXCEEDED
    }

    private record BookingCommand(BookingKind kind, int count) {

    }

    private record AvailabilitySnapshot(int express, int localSeg1, int localSeg2) {

        private String format() {
            return "EXPRESS=" + express + ", LOCAL_SEG1=" + localSeg1 + ", LOCAL_SEG2=" + localSeg2;
        }
    }

    private record Scenario(String name, List<BookingCommand> commands, AvailabilitySnapshot expectedAvailability,
            BookingError expectedError) {

    }

    private record BookingOutcome(boolean success, BookingError error, String observation) {

        private static BookingOutcome success(String observation) {
            return new BookingOutcome(true, BookingError.NONE, observation);
        }

        private static BookingOutcome failure(BookingError error, String observation) {
            return new BookingOutcome(false, error, observation);
        }
    }

    private record ScenarioResult(boolean passed, String testName, String observation) {

        private static ScenarioResult pass(String testName, String observation) {
            return new ScenarioResult(true, testName, observation);
        }

        private static ScenarioResult fail(String testName, String observation) {
            return new ScenarioResult(false, testName, testName + " — " + observation);
        }
    }
}
