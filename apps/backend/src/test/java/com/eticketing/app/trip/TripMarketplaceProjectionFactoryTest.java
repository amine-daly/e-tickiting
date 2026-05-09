package com.eticketing.app.trip;

import com.eticketing.app.bus.BusType;
import com.eticketing.app.place.PlaceType;
import com.eticketing.app.trip.dto.TripRouteAvailabilityResponse;
import com.eticketing.app.trip.dto.TripResponse;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class TripMarketplaceProjectionFactoryTest {

    @Test
    void buildReturnsSingleSegmentProjection() {
        TripType trip = TripType.builder()
                .departureDate(Instant.parse("2026-05-10T08:00:00Z"))
                .status(TripStatusEnum.ACTIVE)
                .bus(TripBusRef.builder().busId("bus-1").build())
                .currency(TripCurrency.builder().currencyId("currency-1").build())
                .stopSchedule(List.of(
                        stop("A", 1, null, Instant.parse("2026-05-10T08:00:00Z"), true, false),
                        stop("B", 2, Instant.parse("2026-05-10T09:10:00Z"), null, false, true)))
                .segments(List.of(segment("seg-1", 1, "A", "B", 70, 12, 6)))
                .build();

        TripResponse.MarketplaceView projection = TripMarketplaceProjectionFactory.build(
                trip,
                "A",
                "B",
                BusType.builder().id("bus-1").totalSeats(40).build(),
                "DT",
                placeMap());

        assertNotNull(projection);
        assertEquals(BigDecimal.valueOf(12), projection.getPrice());
        assertEquals(34, projection.getAvailableSeats());
        assertEquals("Tunis", projection.getRoute().getOrigin().getCity());
        assertEquals("2026-05-10", projection.getSchedule().getTravelDate());
    }

    @Test
    void buildRouteAvailabilityUsesSegmentMaxBookingForSingleSegmentRoutes() {
        TripType trip = TripType.builder()
                .id("trip-1")
                .departureDate(Instant.parse("2026-05-10T08:00:00Z"))
                .status(TripStatusEnum.ACTIVE)
                .bus(TripBusRef.builder().busId("bus-1").build())
                .currency(TripCurrency.builder().currencyId("currency-1").build())
                .stopSchedule(List.of(
                        stop("A", 1, null, Instant.parse("2026-05-10T08:00:00Z"), true, false),
                        stop("B", 2, Instant.parse("2026-05-10T09:10:00Z"), null, false, true)))
                .segments(List.of(segment("seg-1", 1, "A", "B", 70, 12, 6, 12)))
                .build();

        TripRouteAvailabilityResponse availability = TripMarketplaceProjectionFactory.buildRouteAvailability(
                trip,
                "A",
                "B",
                BusType.builder().id("bus-1").totalSeats(51).build(),
                "DT");

        assertNotNull(availability);
        assertEquals(6, availability.getAvailableSeats());
        assertEquals(BigDecimal.valueOf(12), availability.getDisplayPrice());
    }

    @Test
    void buildRejectsMultiSegmentRouteWithoutExactActiveExpressSegment() {
        TripType trip = TripType.builder()
                .departureDate(Instant.parse("2026-05-10T08:00:00Z"))
                .status(TripStatusEnum.ACTIVE)
                .bus(TripBusRef.builder().busId("bus-1").build())
                .currency(TripCurrency.builder().currencyId("currency-1").build())
                .stopSchedule(List.of(
                        stop("A", 1, null, Instant.parse("2026-05-10T08:00:00Z"), true, false),
                        stop("B", 2, Instant.parse("2026-05-10T08:40:00Z"), Instant.parse("2026-05-10T08:45:00Z"), true, true),
                        stop("C", 3, Instant.parse("2026-05-10T09:30:00Z"), null, false, true)))
                .segments(List.of(
                        segment("seg-1", 1, "A", "B", 40, 10, 5),
                        segment("seg-2", 2, "B", "C", 50, 12, 4)))
                .expressSegments(List.of(expressSegment(
                        "express-1",
                        "A",
                        "C",
                        List.of("seg-1"),
                        20,
                        3,
                        true)))
                .build();

        TripResponse.MarketplaceView projection = TripMarketplaceProjectionFactory.build(
                trip,
                "A",
                "C",
                BusType.builder().id("bus-1").totalSeats(40).build(),
                "DT",
                placeMap());

        assertNull(projection);
    }

    @Test
    void buildReturnsExactExpressSegmentProjectionForMultiSegmentRoute() {
        TripType trip = TripType.builder()
                .departureDate(Instant.parse("2026-05-10T08:00:00Z"))
                .status(TripStatusEnum.ACTIVE)
                .bus(TripBusRef.builder().busId("bus-1").build())
                .currency(TripCurrency.builder().currencyId("currency-1").build())
                .stopSchedule(List.of(
                        stop("A", 1, null, Instant.parse("2026-05-10T08:00:00Z"), true, false),
                        stop("B", 2, Instant.parse("2026-05-10T08:40:00Z"), Instant.parse("2026-05-10T08:45:00Z"), true, true),
                        stop("C", 3, Instant.parse("2026-05-10T09:35:00Z"), null, false, true)))
                .segments(List.of(
                        segment("seg-1", 1, "A", "B", 40, 10, 5),
                        segment("seg-2", 2, "B", "C", 55, 15, 4)))
                .expressSegments(List.of(expressSegment(
                        "express-2",
                        "A",
                        "C",
                        List.of("seg-1", "seg-2"),
                        25,
                        7,
                        true)))
                .build();

        TripResponse.MarketplaceView projection = TripMarketplaceProjectionFactory.build(
                trip,
                "A",
                "C",
                BusType.builder().id("bus-1").totalSeats(40).build(),
                "DT",
                placeMap());

        assertNotNull(projection);
        assertEquals(BigDecimal.valueOf(25), projection.getPrice());
        assertEquals(95, projection.getSchedule().getDurationMinutes());
        assertEquals(28, projection.getAvailableSeats());
        assertEquals("Sfax", projection.getRoute().getDestination().getCity());
    }

    @Test
    void buildReturnsProjectionWhenSegmentPlaceRefsAreMissing() {
        TripType trip = TripType.builder()
                .departureDate(Instant.parse("2026-05-10T08:00:00Z"))
                .status(TripStatusEnum.ACTIVE)
                .bus(TripBusRef.builder().busId("bus-1").build())
                .currency(TripCurrency.builder().currencyId("currency-1").build())
                .stopSchedule(List.of(
                        stop("A", 1, null, Instant.parse("2026-05-10T08:00:00Z"), true, false),
                        stop("B", 2, Instant.parse("2026-05-10T08:40:00Z"), Instant.parse("2026-05-10T08:45:00Z"), true, true),
                        stop("C", 3, Instant.parse("2026-05-10T09:35:00Z"), null, false, true)))
                .segments(List.of(
                        segment("seg-1", 1, null, null, 40, 10, 5),
                        segment("seg-2", 2, null, null, 55, 15, 4)))
                .expressSegments(List.of(expressSegment(
                        "express-null",
                        null,
                        null,
                        List.of("seg-1", "seg-2"),
                        25,
                        7,
                        true)))
                .build();

        TripResponse.MarketplaceView projection = TripMarketplaceProjectionFactory.build(
                trip,
                "A",
                "C",
                BusType.builder().id("bus-1").totalSeats(40).build(),
                "DT",
                placeMap());

        assertNotNull(projection);
        assertEquals(BigDecimal.valueOf(25), projection.getPrice());
        assertEquals(95, projection.getSchedule().getDurationMinutes());
        assertEquals(28, projection.getAvailableSeats());
        assertEquals("Tunis", projection.getRoute().getOrigin().getCity());
        assertEquals("Sfax", projection.getRoute().getDestination().getCity());
    }

    @Test
    void buildRouteAvailabilityRejectsNonActiveTrips() {
        TripType trip = TripType.builder()
                .id("trip-2")
                .departureDate(Instant.parse("2026-05-10T08:00:00Z"))
                .status(TripStatusEnum.COMPLETED)
                .bus(TripBusRef.builder().busId("bus-1").build())
                .currency(TripCurrency.builder().currencyId("currency-1").build())
                .stopSchedule(List.of(
                        stop("A", 1, null, Instant.parse("2026-05-10T08:00:00Z"), true, false),
                        stop("B", 2, Instant.parse("2026-05-10T09:10:00Z"), null, false, true)))
                .segments(List.of(segment("seg-1", 1, "A", "B", 70, 12, 6)))
                .build();

        TripRouteAvailabilityResponse availability = TripMarketplaceProjectionFactory.buildRouteAvailability(
                trip,
                "A",
                "B",
                BusType.builder().id("bus-1").totalSeats(40).build(),
                "DT");

        assertNotNull(availability);
        assertEquals(false, availability.isSellable());
        assertEquals(0, availability.getAvailableSeats());
    }

    private Map<String, PlaceType> placeMap() {
        return Map.of(
                "A", place("A", "Tunis"),
                "B", place("B", "Sousse"),
                "C", place("C", "Sfax"));
    }

    private PlaceType place(String id, String city) {
        PlaceType place = new PlaceType();
        place.setId(id);
        place.setCity(city);
        return place;
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
            String originPlaceId,
            String destinationPlaceId,
            int durationMinutes,
            int basePrice,
            int bookedCount) {
        return segment(segmentId, sequence, originPlaceId, destinationPlaceId, durationMinutes, basePrice, bookedCount, 40);
    }

    private SegmentType segment(
            String segmentId,
            int sequence,
            String originPlaceId,
            String destinationPlaceId,
            int durationMinutes,
            int basePrice,
            int bookedCount,
            int maxBooking) {
        return SegmentType.builder()
                .segmentId(segmentId)
                .sequence(sequence)
                .fromPlace(TripPlaceRef.of(originPlaceId))
                .toPlace(TripPlaceRef.of(destinationPlaceId))
                .durationMinutes(durationMinutes)
                .basePrice(BigDecimal.valueOf(basePrice))
                .maxBooking(maxBooking)
                .bookedCount(bookedCount)
                .build();
    }

    private ExpressSegmentType expressSegment(
            String expressSegmentId,
            String originPlaceId,
            String destinationPlaceId,
            List<String> segmentsCovered,
            int price,
            int bookedCount,
            boolean active) {
        return ExpressSegmentType.builder()
                .expressSegmentId(expressSegmentId)
                .fromPlace(TripPlaceRef.of(originPlaceId))
                .toPlace(TripPlaceRef.of(destinationPlaceId))
                .segmentsCovered(segmentsCovered)
                .price(BigDecimal.valueOf(price))
                .bookedCount(bookedCount)
                .validFrom(Instant.parse("2026-01-01T00:00:00Z"))
                .validUntil(Instant.parse("2026-12-31T23:59:59Z"))
                .active(active)
                .build();
    }
}
