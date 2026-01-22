package com.eticketing.app.web;

import com.eticketing.app.trip.TripTypeRepository;
import com.eticketing.app.place.PlaceRepository;
import com.eticketing.app.place.LonLatType;
import com.eticketing.app.place.PlaceType;
import com.eticketing.app.subplace.SubPlaceRepository;
import com.eticketing.app.subplace.SubPlaceType;
import com.eticketing.app.web.error.ApiExceptions.BadRequestException;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/search")
@Tag(name = "Search", description = "Search APIs")
public class SearchController {

    private final TripTypeRepository trips;
    private final PlaceRepository places;
    private final SubPlaceRepository subPlaces;

    public SearchController(TripTypeRepository trips, PlaceRepository places, SubPlaceRepository subPlaces) {
        this.trips = trips;
        this.places = places;
        this.subPlaces = subPlaces;
    }

    private LonLatType resolveCityLocation(String cityId) {
        if (cityId == null || cityId.isBlank()) {
            return null;
        }

        List<SubPlaceType> list = subPlaces.findByParentId(cityId);
        if (list == null || list.isEmpty()) {
            return null;
        }

        // Prefer default with location, else first with location.
        for (SubPlaceType sp : list) {
            if (Boolean.TRUE.equals(sp.getIsDefault()) && sp.getLocation() != null) {
                return sp.getLocation();
            }
        }
        for (SubPlaceType sp : list) {
            if (sp.getLocation() != null) {
                return sp.getLocation();
            }
        }
        return null;
    }

    @GetMapping("/trips")
    @Operation(
            summary = "Search trips",
            description = "Search by source city, destination city, and date",
            responses = {
                @ApiResponse(responseCode = "200", description = "OK")}
    )
    public ResponseEntity<PaginateResponseType<Map<String, Object>>> search(
            @Parameter(description = "Origin place ID", example = "6537f2b1e4b0a2a1b2c3d4e5") @RequestParam String originId,
            @Parameter(description = "Destination place ID", example = "6537f2b1e4b0a2a1b2c3d4e6") @RequestParam String destinationId,
            @Parameter(description = "Departure date (ISO)", example = "2025-10-10") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @Parameter(description = "0-based page index", example = "0") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size (items per page)", example = "10") @RequestParam(defaultValue = "10") int limit
    ) {
        if (originId == null || originId.isBlank()) {
            throw new BadRequestException("originId is required");
        }
        if (destinationId == null || destinationId.isBlank()) {
            throw new BadRequestException("destinationId is required");
        }
        if (date == null) {
            throw new BadRequestException("date is required");
        }
        if (page < 0) {
            page = 0;
        }
        if (limit < 1) {
            limit = 10;
        }

        Pageable pageable = PageRequest.of(page, limit, Sort.by("departureDate").ascending());

        // Convert LocalDate to OffsetDateTime range for the query
        OffsetDateTime startOfDay = date.atStartOfDay().atOffset(ZoneOffset.UTC);
        OffsetDateTime endOfDay = date.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC);

        var result = trips.findByOriginAndDestinationAndDateRange(originId, destinationId, startOfDay, endOfDay, pageable);

        List<Map<String, Object>> objects = result.getContent().stream().map(t -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", t.getId());

            // Use direct originId/destinationId from trip
            PlaceType origin = t.getOriginId() != null ? places.findById(t.getOriginId()).orElse(null) : null;
            PlaceType destinationPlace = t.getDestinationId() != null ? places.findById(t.getDestinationId()).orElse(null) : null;

            LonLatType originLocation = origin == null ? null : resolveCityLocation(origin.getId());
            LonLatType destinationLocation = destinationPlace == null ? null : resolveCityLocation(destinationPlace.getId());
            m.put("source", origin == null ? null : Map.of(
                    "city", origin.getCity(),
                    "location", originLocation == null ? null : Map.of(
                                    "type", originLocation.getType().name(),
                                    "coordinates", originLocation.getCoordinates()
                            )
            ));
            m.put("destination", destinationPlace == null ? null : Map.of(
                    "city", destinationPlace.getCity(),
                    "location", destinationLocation == null ? null : Map.of(
                                    "type", destinationLocation.getType().name(),
                                    "coordinates", destinationLocation.getCoordinates()
                            )
            ));
            m.put("date", t.getDepartureDate());
            m.put("price", t.getTotalPrice());
            m.put("availableSeats", t.getAvailableSeats());
            return m;
        }).toList();

        return ResponseEntity.ok(new PaginateResponseType<>(objects, result.getTotalElements(), result.isLast()));
    }
}
