package com.eticketing.app.trip.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class TripRouteAvailabilityResponse {

    private String tripId;
    private String originPlaceId;
    private String destinationPlaceId;
    private boolean sellable;
    private boolean requiresExpressSegment;
    private int availableSeats;
    private BigDecimal displayPrice;
    private String currencyCode;
    private String expressSegmentId;
    private List<String> segmentIds;
}
