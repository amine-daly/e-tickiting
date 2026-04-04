package com.eticketing.app.web;

import com.eticketing.app.trip.TripTypeRepository;
import com.eticketing.app.place.PlaceRepository;
import com.eticketing.app.place.LonLatType;
import com.eticketing.app.place.PlaceType;
import com.eticketing.app.subplace.SubPlaceRepository;
import com.eticketing.app.subplace.SubPlaceType;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
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

        // Return first sub-place with a location
        for (SubPlaceType sp : list) {
            if (sp.getLocation() != null) {
                return sp.getLocation();
            }
        }
        return null;
    }

    // TODO: Rewrite in Batch 2 — segment-based search with stop schedule model
    @GetMapping("/trips")
    @Operation(
            summary = "Search trips",
            description = "Search by source city, destination city, and date (being migrated to segment-based model)",
            responses = {
                @ApiResponse(responseCode = "501", description = "Not yet implemented")}
    )
    public ResponseEntity<?> search(
            @Parameter(description = "Origin place ID") @RequestParam String originId,
            @Parameter(description = "Destination place ID") @RequestParam String destinationId,
            @Parameter(description = "Departure date (ISO)", example = "2025-10-10") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int limit
    ) {
        return ResponseEntity.status(501)
                .body(Map.of("error", "Search being migrated to segment-based model"));
    }
}
