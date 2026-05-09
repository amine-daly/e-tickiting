package com.eticketing.app.trip.dto;

import com.eticketing.app.trip.TripPlaceRef;

import com.eticketing.app.bus.BusType;
import com.eticketing.app.common.MediaMapper;
import com.eticketing.app.common.MediaType;
import com.eticketing.app.common.TargetInput;
import com.eticketing.app.company.CompanyType;
import com.eticketing.app.currency.CurrencyType;
import com.eticketing.app.place.PlaceType;
import com.eticketing.app.trip.*;
import com.eticketing.app.bus.LayoutElement;
import com.eticketing.app.bus.LayoutTemplate;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Read-facing trip response DTO with expanded reference names and computed
 * express segment fields.
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
    private List<EnrichedExpressSegment> expressSegments;
    private MarketplaceView marketplace;

    private Instant createdAt;
    private Instant updatedAt;

    // ── Nested summary DTOs ─────────────────────────────────────────────
    @Data
    @Builder
    public static class BusSummary {

        private String id;
        private String busId;
        private String name;
        private TargetInput target;
        private int totalSeats;
        private java.util.List<com.eticketing.app.bus.AmenityEnum> amenities;
        private MediaSummary media;
        private LayoutTemplateSummary layoutTemplate;
        private Instant createdAt;
        private Instant updatedAt;
    }

    @Data
    @Builder
    public static class PictureSummary {

        private String baseUrl;
        private String path;
    }

    @Data
    @Builder
    public static class MediaSummary {

        private List<PictureSummary> pictures;
    }

    @Data
    @Builder
    public static class LayoutElementSummary {

        private String type;
        private String seatNo;
        private int gridX;
        private int gridY;
    }

    @Data
    @Builder
    public static class LayoutTemplateSummary {

        private int gridColumns;
        private int gridRows;
        private boolean hasDecks;
        private List<LayoutElementSummary> lowerDeck;
        private List<LayoutElementSummary> upperDeck;
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
        private PlaceSummary fromPlace;
        private PlaceSummary toPlace;
        private Instant departureTime;
        private Instant arrivalTime;
        private int maxBooking;
        private int bookedCount;
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
    public static class EnrichedExpressSegment {

        private String expressSegmentId;
        private PlaceSummary fromPlace;
        private PlaceSummary toPlace;
        private List<String> segmentsCovered;
        private BigDecimal price;
        private int bookedCount;
        private Instant validFrom;
        private Instant validUntil;
        private boolean active;
        private double totalDistanceKm;
        private int totalDurationMinutes;
    }

    @Data
    @Builder
    public static class MarketplaceRoutePoint {

        private String placeId;
        private String city;
    }

    @Data
    @Builder
    public static class MarketplaceRoute {

        private MarketplaceRoutePoint origin;
        private MarketplaceRoutePoint destination;
    }

    @Data
    @Builder
    public static class MarketplaceSchedule {

        private Instant departureDate;
        private String travelDate;
        private Instant departureTime;
        private Instant arrivalTime;
        private int durationMinutes;
    }

    @Data
    @Builder
    public static class MarketplaceView {

        private MarketplaceRoute route;
        private MarketplaceSchedule schedule;
        private BigDecimal price;
        private int availableSeats;
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
        return from(trip, placeMap, busMap, currencyMap, companyMap, null);
    }

    public static TripResponse from(TripType trip,
            Map<String, PlaceType> placeMap,
            Map<String, BusType> busMap,
            Map<String, CurrencyType> currencyMap,
            Map<String, CompanyType> companyMap,
            MarketplaceView marketplace) {

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
                .expressSegments(enrichExpressSegments(trip.getExpressSegments(), trip.getSegments(), placeMap))
                .marketplace(marketplace)
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
                .id(bus != null ? bus.getId() : ref.getBusId())
                .busId(ref.getBusId())
                .name(bus != null ? bus.getName() : null)
                .target(bus != null ? bus.getTarget() : null)
                .totalSeats(bus != null ? bus.getTotalSeats() : 0)
                .amenities(bus != null ? bus.getAmenities() : java.util.List.of())
                .media(toMediaSummary(bus != null ? bus.getMedia() : null))
                .layoutTemplate(toLayoutTemplateSummary(bus != null ? bus.getLayoutTemplate() : null))
                .createdAt(bus != null ? bus.getCreatedAt() : null)
                .updatedAt(bus != null ? bus.getUpdatedAt() : null)
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

    private static MediaSummary toMediaSummary(MediaType media) {
        return MediaSummary.builder()
                .pictures(MediaMapper.picturesOrEmpty(media).stream()
                        .map(TripResponse::toPictureSummary)
                        .toList())
                .build();
    }

    private static LayoutTemplateSummary toLayoutTemplateSummary(LayoutTemplate layoutTemplate) {
        if (layoutTemplate == null) {
            return null;
        }

        return LayoutTemplateSummary.builder()
                .gridColumns(layoutTemplate.getGridColumns())
                .gridRows(layoutTemplate.getGridRows())
                .hasDecks(layoutTemplate.isHasDecks())
                .lowerDeck(toLayoutElementSummaries(layoutTemplate.getLowerDeck()))
                .upperDeck(toLayoutElementSummaries(layoutTemplate.getUpperDeck()))
                .build();
    }

    private static List<LayoutElementSummary> toLayoutElementSummaries(List<LayoutElement> elements) {
        if (elements == null) {
            return List.of();
        }

        return elements.stream()
                .map(TripResponse::toLayoutElementSummary)
                .toList();
    }

    private static LayoutElementSummary toLayoutElementSummary(LayoutElement element) {
        if (element == null) {
            return null;
        }

        return LayoutElementSummary.builder()
                .type(element.getType() != null ? element.getType().name() : null)
                .seatNo(element.getSeatNo())
                .gridX(element.getGridX())
                .gridY(element.getGridY())
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
                .fromPlace(toPlaceSummary(TripPlaceRef.idOf(s.getFromPlace()), placeMap))
                .toPlace(toPlaceSummary(TripPlaceRef.idOf(s.getToPlace()), placeMap))
                .departureTime(s.getDepartureTime())
                .arrivalTime(s.getArrivalTime())
                .maxBooking(s.getMaxBooking())
                .bookedCount(s.getBookedCount())
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

    private static List<EnrichedExpressSegment> enrichExpressSegments(
            List<ExpressSegmentType> expressSegments, List<SegmentType> segments, Map<String, PlaceType> placeMap) {
        if (expressSegments == null) {
            return List.of();
        }
        return expressSegments.stream().map(expressSegment -> EnrichedExpressSegment.builder()
                .expressSegmentId(expressSegment.getExpressSegmentId())
                .fromPlace(toPlaceSummary(TripPlaceRef.idOf(expressSegment.getFromPlace()), placeMap))
                .toPlace(toPlaceSummary(TripPlaceRef.idOf(expressSegment.getToPlace()), placeMap))
                .segmentsCovered(expressSegment.getSegmentsCovered())
                .price(expressSegment.getPrice())
                .bookedCount(expressSegment.getBookedCount())
                .validFrom(expressSegment.getValidFrom())
                .validUntil(expressSegment.getValidUntil())
                .active(expressSegment.isActive())
                .totalDistanceKm(ExpressSegmentValidator.computeTotalDistanceKm(expressSegment, segments))
                .totalDurationMinutes(ExpressSegmentValidator.computeTotalDurationMinutes(expressSegment, segments))
                .build()
        ).toList();
    }
}
