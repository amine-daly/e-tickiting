package com.eticketing.app.web;

import com.eticketing.app.trip.TripTypeRepository;
import com.eticketing.app.place.PlaceRepository;
import com.eticketing.app.place.PlaceDocument;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/search")
@Tag(name = "Search", description = "Search APIs")
public class SearchController {
    private final TripTypeRepository trips;
    private final PlaceRepository places;

    public SearchController(TripTypeRepository trips, PlaceRepository places) {
        this.trips = trips;
        this.places = places;
    }

    @GetMapping("/trips")
    @Operation(
            summary = "Search trips",
            description = "Search by source city, destination city, and date",
            responses = {@ApiResponse(responseCode = "200", description = "OK")}
    )
    public ResponseEntity<PaginateResponseType<Map<String, Object>>> search(
        @Parameter(description = "Origin place ID", example = "6537f2b1e4b0a2a1b2c3d4e5") @RequestParam String originId,
        @Parameter(description = "Destination place ID", example = "6537f2b1e4b0a2a1b2c3d4e6") @RequestParam String destinationId,
        @Parameter(description = "Departure date (ISO)", example = "2025-10-10") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
        @Parameter(description = "0-based page index", example = "0") @RequestParam(defaultValue = "0") int page,
        @Parameter(description = "Page size (items per page)", example = "10") @RequestParam(defaultValue = "10") int limit
    ) {
        if (originId == null || originId.isBlank()) throw new BadRequestException("originId is required");
        if (destinationId == null || destinationId.isBlank()) throw new BadRequestException("destinationId is required");
        if (date == null) throw new BadRequestException("date is required");
        if (page < 0) page = 0;
        if (limit < 1) limit = 10;

        Pageable pageable = PageRequest.of(page, limit, Sort.by("departureDate").ascending());
        var result = trips.findByOriginIdAndDestinationIdAndDepartureDate(originId, destinationId, date, pageable);

        List<Map<String, Object>> objects = result.getContent().stream().map(t -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", t.getId());
            PlaceDocument origin = t.getOriginId() != null ? places.findById(t.getOriginId()).orElse(null) : null;
            PlaceDocument destinationPlace = t.getDestinationId() != null ? places.findById(t.getDestinationId()).orElse(null) : null;
            m.put("source", origin == null ? null : Map.of(
                "city", origin.getCity(),
                "location", origin.getLocation() == null ? null : Map.of(
                    "type", origin.getLocation().getType().name(),
                    "coordinates", origin.getLocation().getCoordinates()
                )
            ));
            m.put("destination", destinationPlace == null ? null : Map.of(
                "city", destinationPlace.getCity(),
                "location", destinationPlace.getLocation() == null ? null : Map.of(
                    "type", destinationPlace.getLocation().getType().name(),
                    "coordinates", destinationPlace.getLocation().getCoordinates()
                )
            ));
            m.put("date", t.getDepartureDate());
            m.put("price", t.getPrice());
            m.put("availableSeats", t.getAvailableSeats());
            return m;
        }).toList();

        return ResponseEntity.ok(new PaginateResponseType<>(objects, result.getTotalElements(), result.isLast()));
    }
}
