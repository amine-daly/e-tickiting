package com.eticketing.app.trip.dto;

import com.eticketing.app.common.TargetInput;
import com.eticketing.app.trip.*;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Read-facing trip response DTO with computed express fare fields.
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
    private TripBusRef bus;
    private String currency;
    private int seatHoldMinutes;

    private List<StopType> stopSchedule;
    private List<PickupPointType> pickupPoints;
    private List<DropoffPointType> dropoffPoints;
    private List<SegmentType> segments;
    private List<EnrichedExpressFare> expressFares;

    private Instant createdAt;
    private Instant updatedAt;

    /**
     * Express fare with computed distance/duration from covered segments.
     */
    @Data
    @Builder
    public static class EnrichedExpressFare {

        private String expressId;
        private String fromPlaceId;
        private String toPlaceId;
        private List<String> segmentsCovered;
        private BigDecimal price;
        private Instant validFrom;
        private Instant validUntil;
        private boolean active;
        private double totalDistanceKm;
        private int totalDurationMinutes;
    }

    /**
     * Maps a TripType entity to a TripResponse, enriching express fares.
     */
    public static TripResponse from(TripType trip) {
        return TripResponse.builder()
                .id(trip.getId())
                .version(trip.getVersion())
                .target(trip.getTarget())
                .departureDate(trip.getDepartureDate())
                .timezone(trip.getTimezone())
                .status(trip.getStatus())
                .bus(trip.getBus())
                .currency(trip.getCurrency())
                .seatHoldMinutes(trip.getSeatHoldMinutes())
                .stopSchedule(trip.getStopSchedule())
                .pickupPoints(trip.getPickupPoints())
                .dropoffPoints(trip.getDropoffPoints())
                .segments(trip.getSegments())
                .expressFares(enrichExpressFares(trip.getExpressFares(), trip.getSegments()))
                .createdAt(trip.getCreatedAt())
                .updatedAt(trip.getUpdatedAt())
                .build();
    }

    private static List<EnrichedExpressFare> enrichExpressFares(
            List<ExpressFareType> fares, List<SegmentType> segments) {
        if (fares == null) {
            return List.of();
        }
        return fares.stream().map(f -> EnrichedExpressFare.builder()
                .expressId(f.getExpressId())
                .fromPlaceId(f.getFromPlaceId())
                .toPlaceId(f.getToPlaceId())
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
