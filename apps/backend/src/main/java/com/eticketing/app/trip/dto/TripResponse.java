package com.eticketing.app.trip.dto;

import com.eticketing.app.bus.BusType;
import com.eticketing.app.common.TargetInput;
import com.eticketing.app.company.CompanyType;
import com.eticketing.app.currency.CurrencyType;
import com.eticketing.app.place.PlaceType;
import com.eticketing.app.trip.*;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Read-facing trip response DTO with expanded reference names and computed
 * express fare fields.
 */
@Data
@Builder
public class TripResponse {

    private String id;
    private Long version;
    private TargetInput target;
    private Instant departureDate;
    private String timezone;
    private TripStatusEnum status;
    private BusSummary bus;
    private CompanySummary company;
    private CurrencySummary currency;

    private List<StopView> stopSchedule;
    private List<PickupPointView> pickupPoints;
    private List<DropoffPointView> dropoffPoints;
    private List<SegmentView> segments;
    private List<EnrichedExpressFare> expressFares;

    private Instant createdAt;
    private Instant updatedAt;

    // ── Nested summary DTOs ─────────────────────────────────────────────
    @Data
    @Builder
    public static class BusSummary {

        private String busId;
        private String name;
        private int totalSeats;
        private java.util.List<com.eticketing.app.bus.AmenityEnum> amenities;
    }

    @Data
    @Builder
    public static class PictureSummary {

        private String baseUrl;
        private String path;
    }

    @Data
    @Builder
    public static class CompanySummary {

        private String id;
        private String name;
        private PictureSummary picture;
    }

    @Data
    @Builder
    public static class CurrencySummary {

        private String id;
        private String code;
        private String name;
        private String iconFlag;
    }

    @Data
    @Builder
    public static class PlaceSummary {

        private String id;
        private String city;
    }

    @Data
    @Builder
    public static class StopView {

        private String placeId;
        private PlaceSummary place;
        private int sequence;
        private Instant arrivalTime;
        private Instant departureTime;
        private boolean boardingAllowed;
        private boolean droppingAllowed;
    }

    @Data
    @Builder
    public static class SegmentView {

        private String segmentId;
        private int sequence;
        private String fromPlaceId;
        private PlaceSummary fromPlace;
        private String toPlaceId;
        private PlaceSummary toPlace;
        private Instant departureTime;
        private Instant arrivalTime;
        private int maxSeats;
        private int bookedSeats;
        private BigDecimal basePrice;
        private double distanceKm;
        private int durationMinutes;
    }

    @Data
    @Builder
    public static class PickupPointView {

        private String pointId;
        private String placeId;
        private PlaceSummary place;
        private String address;
        private Instant scheduledDepartureTime;
        private boolean active;
        private GeoLocation location;
    }

    @Data
    @Builder
    public static class DropoffPointView {

        private String pointId;
        private String placeId;
        private PlaceSummary place;
        private String address;
        private Instant scheduledArrivalTime;
        private boolean active;
        private GeoLocation location;
    }

    @Data
    @Builder
    public static class EnrichedExpressFare {

        private String expressId;
        private String fromPlaceId;
        private PlaceSummary fromPlace;
        private String toPlaceId;
        private PlaceSummary toPlace;
        private List<String> segmentsCovered;
        private BigDecimal price;
        private Instant validFrom;
        private Instant validUntil;
        private boolean active;
        private double totalDistanceKm;
        private int totalDurationMinutes;
    }

    // ── Factory methods ─────────────────────────────────────────────────
    /**
     * Maps a TripType entity to a TripResponse with expanded reference names.
     *
     * @param placeMap id → PlaceType lookup (batch-loaded)
     * @param busMap id → BusType lookup (batch-loaded)
     * @param currencyMap id → CurrencyType lookup (batch-loaded)
     */
    public static TripResponse from(TripType trip,
            Map<String, PlaceType> placeMap,
            Map<String, BusType> busMap,
            Map<String, CurrencyType> currencyMap,
            Map<String, CompanyType> companyMap) {

        BusType busEntity = trip.getBus() != null ? busMap.get(trip.getBus().getBusId()) : null;
        CompanyType companyEntity = trip.getTarget() != null && trip.getTarget().getCompany() != null
                ? companyMap.get(trip.getTarget().getCompany())
                : null;
        CurrencyType currEntity = trip.getCurrency() != null
                ? currencyMap.get(trip.getCurrency().getCurrencyId())
                : null;

        return TripResponse.builder()
                .id(trip.getId())
                .version(trip.getVersion())
                .target(trip.getTarget())
                .departureDate(trip.getDepartureDate())
                .timezone(trip.getTimezone())
                .status(trip.getStatus())
                .bus(toBusSummary(trip.getBus(), busEntity))
                .company(toCompanySummary(trip.getTarget(), companyEntity))
                .currency(toCurrencySummary(trip.getCurrency(), currEntity))
                .stopSchedule(mapStops(trip.getStopSchedule(), placeMap))
                .pickupPoints(mapPickups(trip.getPickupPoints(), placeMap))
                .dropoffPoints(mapDropoffs(trip.getDropoffPoints(), placeMap))
                .segments(mapSegments(trip.getSegments(), placeMap))
                .expressFares(enrichExpressFares(trip.getExpressFares(), trip.getSegments(), placeMap))
                .createdAt(trip.getCreatedAt())
                .updatedAt(trip.getUpdatedAt())
                .build();
    }

    // ── Mapping helpers ─────────────────────────────────────────────────
    private static BusSummary toBusSummary(TripBusRef ref, BusType bus) {
        if (ref == null) {
            return null;
        }
        return BusSummary.builder()
                .busId(ref.getBusId())
                .name(bus != null ? bus.getName() : null)
                .totalSeats(bus != null ? bus.getTotalSeats() : 0)
                .amenities(bus != null ? bus.getAmenities() : java.util.List.of())
                .build();
    }

    private static CurrencySummary toCurrencySummary(TripCurrency ref, CurrencyType c) {
        if (ref == null) {
            return null;
        }
        return CurrencySummary.builder()
                .id(ref.getCurrencyId())
                .code(c != null ? c.getCode() : null)
                .name(c != null ? c.getName() : null)
                .iconFlag(c != null ? c.getIconFlag() : null)
                .build();
    }

    private static CompanySummary toCompanySummary(TargetInput target, CompanyType company) {
        String companyId = target != null ? target.getCompany() : null;
        if (companyId == null && company == null) {
            return null;
        }

        return CompanySummary.builder()
                .id(company != null ? company.getId() : companyId)
                .name(company != null ? company.getName() : null)
                .picture(toPictureSummary(company != null ? company.getPicture() : null))
                .build();
    }

    private static PictureSummary toPictureSummary(com.eticketing.app.common.PictureType picture) {
        if (picture == null) {
            return null;
        }

        return PictureSummary.builder()
                .baseUrl(picture.getBaseUrl())
                .path(picture.getPath())
                .build();
    }

    private static PlaceSummary toPlaceSummary(String placeId, Map<String, PlaceType> placeMap) {
        if (placeId == null) {
            return null;
        }
        PlaceType p = placeMap.get(placeId);
        return PlaceSummary.builder()
                .id(placeId)
                .city(p != null ? p.getCity() : null)
                .build();
    }

    private static List<StopView> mapStops(List<StopType> stops, Map<String, PlaceType> placeMap) {
        if (stops == null) {
            return List.of();
        }
        return stops.stream().map(s -> StopView.builder()
                .placeId(s.getPlaceId())
                .place(toPlaceSummary(s.getPlaceId(), placeMap))
                .sequence(s.getSequence())
                .arrivalTime(s.getArrivalTime())
                .departureTime(s.getDepartureTime())
                .boardingAllowed(s.isBoardingAllowed())
                .droppingAllowed(s.isDroppingAllowed())
                .build()).toList();
    }

    private static List<SegmentView> mapSegments(List<SegmentType> segs, Map<String, PlaceType> placeMap) {
        if (segs == null) {
            return List.of();
        }
        return segs.stream().map(s -> SegmentView.builder()
                .segmentId(s.getSegmentId())
                .sequence(s.getSequence())
                .fromPlaceId(s.getFromPlaceId())
                .fromPlace(toPlaceSummary(s.getFromPlaceId(), placeMap))
                .toPlaceId(s.getToPlaceId())
                .toPlace(toPlaceSummary(s.getToPlaceId(), placeMap))
                .departureTime(s.getDepartureTime())
                .arrivalTime(s.getArrivalTime())
                .maxSeats(s.getMaxSeats())
                .bookedSeats(s.getBookedSeats())
                .basePrice(s.getBasePrice())
                .distanceKm(s.getDistanceKm())
                .durationMinutes(s.getDurationMinutes())
                .build()).toList();
    }

    private static List<PickupPointView> mapPickups(List<PickupPointType> pts, Map<String, PlaceType> placeMap) {
        if (pts == null) {
            return List.of();
        }
        return pts.stream().map(p -> PickupPointView.builder()
                .pointId(p.getPointId())
                .placeId(p.getPlaceId())
                .place(toPlaceSummary(p.getPlaceId(), placeMap))
                .address(p.getAddress())
                .scheduledDepartureTime(p.getScheduledDepartureTime())
                .active(p.isActive())
                .location(p.getLocation())
                .build()).toList();
    }

    private static List<DropoffPointView> mapDropoffs(List<DropoffPointType> pts, Map<String, PlaceType> placeMap) {
        if (pts == null) {
            return List.of();
        }
        return pts.stream().map(d -> DropoffPointView.builder()
                .pointId(d.getPointId())
                .placeId(d.getPlaceId())
                .place(toPlaceSummary(d.getPlaceId(), placeMap))
                .address(d.getAddress())
                .scheduledArrivalTime(d.getScheduledArrivalTime())
                .active(d.isActive())
                .location(d.getLocation())
                .build()).toList();
    }

    private static List<EnrichedExpressFare> enrichExpressFares(
            List<ExpressFareType> fares, List<SegmentType> segments, Map<String, PlaceType> placeMap) {
        if (fares == null) {
            return List.of();
        }
        return fares.stream().map(f -> EnrichedExpressFare.builder()
                .expressId(f.getExpressId())
                .fromPlaceId(f.getFromPlaceId())
                .fromPlace(toPlaceSummary(f.getFromPlaceId(), placeMap))
                .toPlaceId(f.getToPlaceId())
                .toPlace(toPlaceSummary(f.getToPlaceId(), placeMap))
                .segmentsCovered(f.getSegmentsCovered())
                .price(f.getPrice())
                .validFrom(f.getValidFrom())
                .validUntil(f.getValidUntil())
                .active(f.isActive())
                .totalDistanceKm(ExpressFareValidator.computeTotalDistanceKm(f, segments))
                .totalDurationMinutes(ExpressFareValidator.computeTotalDurationMinutes(f, segments))
                .build()
        ).toList();
    }
}
