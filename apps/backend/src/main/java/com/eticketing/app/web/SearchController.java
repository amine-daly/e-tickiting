package com.eticketing.app.web;

import com.eticketing.app.trip.TripTypeRepository;
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

    public SearchController(TripTypeRepository trips) {
        this.trips = trips;
    }

    @GetMapping("/trips")
    @Operation(
            summary = "Search trips",
            description = "Search by source city, destination city, and date",
            responses = {@ApiResponse(responseCode = "200", description = "OK")}
    )
    public ResponseEntity<PaginateResponseType<Map<String, Object>>> search(
        @Parameter(description = "Trip source city", example = "Tunis") @RequestParam String source,
        @Parameter(description = "Trip destination city", example = "Sfax") @RequestParam String destination,
        @Parameter(description = "Departure date (ISO)", example = "2025-10-10") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
        @Parameter(description = "0-based page index", example = "0") @RequestParam(defaultValue = "0") int page,
        @Parameter(description = "Page size (items per page)", example = "10") @RequestParam(defaultValue = "10") int limit
    ) {
        if (source == null || source.isBlank()) throw new BadRequestException("source is required");
        if (destination == null || destination.isBlank()) throw new BadRequestException("destination is required");
        if (date == null) throw new BadRequestException("date is required");
        if (page < 0) page = 0;
        if (limit < 1) limit = 10;

    Pageable pageable = PageRequest.of(page, limit, Sort.by("departureDate").ascending());
    var result = trips.findBySource_CityIgnoreCaseAndDestination_CityIgnoreCaseAndDepartureDate(source, destination, date, pageable);

        List<Map<String, Object>> objects = result.getContent().stream().map(t -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", t.getId());
        m.put("source", Map.of(
            "city", t.getSource().getCity(),
            "location", Map.of(
                "type", t.getSource().getLocation().getType().name(),
                "coordinates", t.getSource().getLocation().getCoordinates()
            )
        ));
        m.put("destination", Map.of(
            "city", t.getDestination().getCity(),
            "location", Map.of(
                "type", t.getDestination().getLocation().getType().name(),
                "coordinates", t.getDestination().getLocation().getCoordinates()
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
