package com.eticketing.app.trip;

import com.eticketing.app.bus.BusType;
import com.eticketing.app.place.PlaceType;
import com.eticketing.app.trip.dto.TripRouteAvailabilityResponse;
import com.eticketing.app.trip.dto.TripResponse;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class TripMarketplaceProjectionFactory {

    private static final DateTimeFormatter ISO_LOCAL_DATE = DateTimeFormatter.ISO_LOCAL_DATE.withZone(ZoneOffset.UTC);

    private TripMarketplaceProjectionFactory() {
    }

    public static TripResponse.MarketplaceView build(
            TripType trip,
            String originPlaceId,
            String destinationPlaceId,
            BusType bus,
            String currencyCode,
            Map<String, PlaceType> placeMap) {
        if (trip == null
                || originPlaceId == null || originPlaceId.isBlank()
                || destinationPlaceId == null || destinationPlaceId.isBlank()) {
            return null;
        }

        TripRouteAvailabilityResponse routeAvailability = buildRouteAvailability(
                trip,
                originPlaceId,
                destinationPlaceId,
                bus,
                currencyCode);
        if (!routeAvailability.isSellable()) {
            return null;
        }

        ResolvedRoute resolvedRoute = resolveRoute(trip, originPlaceId, destinationPlaceId);
        if (resolvedRoute == null) {
            return null;
        }

        ExpressSegmentType expressSegment = findExpressSegmentById(trip, routeAvailability.getExpressSegmentId());

        return TripResponse.MarketplaceView.builder()
                .route(TripResponse.MarketplaceRoute.builder()
                        .origin(toRoutePoint(resolvedRoute.originStop().getPlaceId(), placeMap))
                        .destination(toRoutePoint(resolvedRoute.destinationStop().getPlaceId(), placeMap))
                        .build())
                .schedule(TripResponse.MarketplaceSchedule.builder()
                        .departureDate(trip.getDepartureDate())
                        .travelDate(toTravelDate(trip.getDepartureDate()))
                        .departureTime(resolvedRoute.originStop().getDepartureTime())
                        .arrivalTime(resolvedRoute.destinationStop().getArrivalTime())
                        .durationMinutes(expressSegment != null
                                ? ExpressSegmentValidator.computeTotalDurationMinutes(expressSegment, trip.getSegments())
                                : resolvedRoute.chain().stream()
                                        .mapToInt(segment -> Math.max(segment.getDurationMinutes(), 0))
                                        .sum())
                        .build())
                .pricing(TripResponse.MarketplacePricing.builder()
                        .displayPrice(routeAvailability.getDisplayPrice())
                        .currencyCode(routeAvailability.getCurrencyCode())
                        .build())
                .capacity(TripResponse.MarketplaceCapacity.builder()
                        .availableSeats(routeAvailability.getAvailableSeats())
                        .build())
                .build();
    }

    public static TripRouteAvailabilityResponse buildRouteAvailability(
            TripType trip,
            String originPlaceId,
            String destinationPlaceId,
            BusType bus,
            String currencyCode) {
        if (trip == null
                || originPlaceId == null || originPlaceId.isBlank()
                || destinationPlaceId == null || destinationPlaceId.isBlank()) {
            return null;
        }

        ResolvedRoute resolvedRoute = resolveRoute(trip, originPlaceId, destinationPlaceId);
        if (resolvedRoute == null) {
            return unavailableRoute(trip.getId(), originPlaceId, destinationPlaceId, currencyCode, false, List.of());
        }

        List<String> segmentIds = resolvedRoute.chain().stream()
                .map(SegmentType::getSegmentId)
                .toList();
        boolean requiresExpressSegment = resolvedRoute.chain().size() > 1;
        ExpressSegmentType expressSegment = requiresExpressSegment
                ? findMatchingExpressSegment(trip, originPlaceId, destinationPlaceId, segmentIds)
                : null;
        if (requiresExpressSegment && expressSegment == null) {
            return unavailableRoute(trip.getId(), originPlaceId, destinationPlaceId, currencyCode, true, segmentIds);
        }

        BigDecimal displayPrice = expressSegment != null && expressSegment.getPrice() != null
                ? expressSegment.getPrice()
                : resolvedRoute.chain().stream()
                        .map(segment -> segment.getBasePrice() != null ? segment.getBasePrice() : BigDecimal.ZERO)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);

        return TripRouteAvailabilityResponse.builder()
                .tripId(trip.getId())
                .originPlaceId(originPlaceId)
                .destinationPlaceId(destinationPlaceId)
                .sellable(true)
                .requiresExpressSegment(requiresExpressSegment)
                .availableSeats(computeAvailableSeats(trip, bus, resolvedRoute.chain(), expressSegment != null))
                .displayPrice(displayPrice)
                .currencyCode(currencyCode)
                .expressSegmentId(expressSegment != null ? expressSegment.getExpressSegmentId() : null)
                .segmentIds(segmentIds)
                .build();
    }

    private static ResolvedRoute resolveRoute(TripType trip, String originPlaceId, String destinationPlaceId) {
        List<StopType> stops = getSortedStops(trip);
        if (stops.isEmpty()) {
            return null;
        }

        StopType originStop = stops.stream()
                .filter(stop -> Objects.equals(stop.getPlaceId(), originPlaceId) && stop.isBoardingAllowed())
                .findFirst()
                .orElse(null);
        StopType destinationStop = stops.stream()
                .filter(stop -> Objects.equals(stop.getPlaceId(), destinationPlaceId) && stop.isDroppingAllowed())
                .reduce((first, second) -> second)
                .orElse(null);

        if (originStop == null || destinationStop == null || originStop.getSequence() >= destinationStop.getSequence()) {
            return null;
        }

        List<SegmentType> chain = getSegmentChain(trip, originPlaceId, destinationPlaceId);
        if (chain.isEmpty()) {
            return null;
        }

        return new ResolvedRoute(originStop, destinationStop, chain);
    }

    private static List<StopType> getSortedStops(TripType trip) {
        return (trip.getStopSchedule() == null ? List.<StopType>of() : trip.getStopSchedule()).stream()
                .sorted(Comparator.comparingInt(StopType::getSequence))
                .toList();
    }

    private static List<SegmentType> getSegmentChain(TripType trip, String originPlaceId, String destinationPlaceId) {
        List<SegmentType> segments = getSortedSegments(trip);
        if (segments.isEmpty()) {
            return List.of();
        }

        int startIndex = -1;
        for (int index = 0; index < segments.size(); index++) {
            if (Objects.equals(segments.get(index).getFromPlaceId(), originPlaceId)) {
                startIndex = index;
                break;
            }
        }
        if (startIndex < 0) {
            return List.of();
        }

        List<SegmentType> chain = new ArrayList<>();
        String currentPlaceId = originPlaceId;

        for (SegmentType segment : segments.subList(startIndex, segments.size())) {
            if (!Objects.equals(segment.getFromPlaceId(), currentPlaceId)) {
                break;
            }

            chain.add(segment);
            currentPlaceId = segment.getToPlaceId();

            if (Objects.equals(currentPlaceId, destinationPlaceId)) {
                return List.copyOf(chain);
            }
        }

        return List.of();
    }

    private static List<SegmentType> getSortedSegments(TripType trip) {
        return (trip.getSegments() == null ? List.<SegmentType>of() : trip.getSegments()).stream()
                .sorted(Comparator.comparingInt(SegmentType::getSequence))
                .toList();
    }

    private static ExpressSegmentType findMatchingExpressSegment(
            TripType trip,
            String originPlaceId,
            String destinationPlaceId,
            List<String> segmentIds) {
        Instant now = Instant.now();
        return (trip.getExpressSegments() == null ? List.<ExpressSegmentType>of() : trip.getExpressSegments()).stream()
                .filter(expressSegment -> expressSegment.getSegmentsCovered() != null)
                .filter(expressSegment -> Objects.equals(expressSegment.getFromPlaceId(), originPlaceId))
                .filter(expressSegment -> Objects.equals(expressSegment.getToPlaceId(), destinationPlaceId))
                .filter(expressSegment -> segmentIds.equals(expressSegment.getSegmentsCovered()))
                .filter(expressSegment -> isExpressSegmentCurrentlyValid(expressSegment, now))
                .findFirst()
                .orElse(null);
    }

    private static ExpressSegmentType findExpressSegmentById(TripType trip, String expressSegmentId) {
        if (trip.getExpressSegments() == null || expressSegmentId == null || expressSegmentId.isBlank()) {
            return null;
        }

        return trip.getExpressSegments().stream()
                .filter(expressSegment -> Objects.equals(expressSegmentId, expressSegment.getExpressSegmentId()))
                .findFirst()
                .orElse(null);
    }

    private static boolean isExpressSegmentCurrentlyValid(ExpressSegmentType expressSegment, Instant now) {
        return expressSegment.isActive()
                && (expressSegment.getValidFrom() == null || !now.isBefore(expressSegment.getValidFrom()))
                && (expressSegment.getValidUntil() == null || !now.isAfter(expressSegment.getValidUntil()));
    }

    private static int computeAvailableSeats(TripType trip, BusType bus, List<SegmentType> chain, boolean expressReservation) {
        int totalSeats = bus != null ? bus.getTotalSeats() : 0;
        if (totalSeats <= 0 || chain.isEmpty()) {
            return 0;
        }

        List<String> segmentIds = chain.stream().map(SegmentType::getSegmentId).toList();
        Map<String, Integer> expressBookedBySegmentId = TripInventoryAvailabilityCalculator.buildExpressBookedBySegmentId(
                trip,
                segmentIds);

        return expressReservation
                ? TripInventoryAvailabilityCalculator.computeExpressAvailability(chain, expressBookedBySegmentId, totalSeats)
                : TripInventoryAvailabilityCalculator.computeLocalAvailability(chain, expressBookedBySegmentId, totalSeats);
    }

    private static TripRouteAvailabilityResponse unavailableRoute(
            String tripId,
            String originPlaceId,
            String destinationPlaceId,
            String currencyCode,
            boolean requiresExpressSegment,
            List<String> segmentIds) {
        return TripRouteAvailabilityResponse.builder()
                .tripId(tripId)
                .originPlaceId(originPlaceId)
                .destinationPlaceId(destinationPlaceId)
                .sellable(false)
                .requiresExpressSegment(requiresExpressSegment)
                .availableSeats(0)
                .displayPrice(BigDecimal.ZERO)
                .currencyCode(currencyCode)
                .expressSegmentId(null)
                .segmentIds(segmentIds)
                .build();
    }

    private static TripResponse.MarketplaceRoutePoint toRoutePoint(String placeId, Map<String, PlaceType> placeMap) {
        PlaceType place = placeMap.get(placeId);
        return TripResponse.MarketplaceRoutePoint.builder()
                .placeId(placeId)
                .city(place != null && place.getCity() != null ? place.getCity() : placeId)
                .build();
    }

    private static String toTravelDate(Instant departureDate) {
        return departureDate != null ? ISO_LOCAL_DATE.format(departureDate) : null;
    }

    private record ResolvedRoute(StopType originStop, StopType destinationStop, List<SegmentType> chain) {

    }
}
