package com.eticketing.app.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api/search")
@Tag(name = "Search", description = "Search APIs")
public class SearchController {

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
