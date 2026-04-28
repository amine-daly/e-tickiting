package com.eticketing.app.trip;

import com.eticketing.app.trip.dto.*;
import com.eticketing.app.user.UserType;
import com.eticketing.app.user.UserTypeRepository;
import com.eticketing.app.web.PaginateResponseType;
import com.eticketing.app.web.error.ApiExceptions.BadRequestException;
import com.eticketing.app.web.error.ApiExceptions.UnauthorizedException;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.User;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

/**
 * Trip REST controller — full CRUD with validation pipeline, status machine,
 * edit rules, and sub-resource endpoints.
 */
@RestController
@RequestMapping(path = {"/api/trip", "/api/trips"})
@Tag(name = "Trips", description = "Trip management API")
@RequiredArgsConstructor
public class TripController {

    private final TripService tripService;
    private final TripResponseEnricher enricher;
    private final UserTypeRepository userRepository;
    private final HttpServletRequest httpServletRequest;

    // ════════════════════════════════════════════════════════════════════
    // CRUD
    // ════════════════════════════════════════════════════════════════════
    @Operation(summary = "Create a new trip")
    @PostMapping
    public ResponseEntity<TripResponse> createTrip(
            @Valid @RequestBody TripCreateRequest req,
            @AuthenticationPrincipal User principal) {
        String companyId = resolveCompanyId(principal);
        TripType trip = tripService.create(req, companyId);
        return ResponseEntity.status(HttpStatus.CREATED).body(enricher.enrich(trip));
    }

    @Operation(summary = "Get a trip by ID")
    @GetMapping("/{id}")
    public ResponseEntity<TripResponse> getTripById(
            @PathVariable String id,
            @AuthenticationPrincipal User principal) {
        String companyId = resolveCompanyId(principal);
        TripType trip = tripService.getById(id, companyId);
        return ResponseEntity.ok(enricher.enrich(trip));
    }

    @Operation(summary = "List trips for the authenticated user's company")
    @GetMapping
    public ResponseEntity<PaginateResponseType<TripResponse>> listTrips(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String order,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int limit,
            @AuthenticationPrincipal User principal) {
        String companyId = resolveCompanyId(principal);
        TripStatusEnum statusEnum = (status != null && !status.isBlank())
                ? TripStatusEnum.fromValue(status) : null;
        Page<TripType> result = tripService.list(companyId, statusEnum, sortBy, order, page, limit);
        var content = enricher.enrich(result.getContent());
        return ResponseEntity.ok(new PaginateResponseType<>(
                content, result.getTotalElements(), result.isLast()));
    }

    @Operation(summary = "List trips by company (admin / cross-company)")
    @GetMapping("/by-company/{companyId}")
    public ResponseEntity<PaginateResponseType<TripResponse>> listByCompany(
            @PathVariable String companyId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String order,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int limit) {
        TripStatusEnum statusEnum = (status != null && !status.isBlank())
                ? TripStatusEnum.fromValue(status) : null;
        Page<TripType> result = tripService.list(companyId, statusEnum, sortBy, order, page, limit);
        var content = enricher.enrich(result.getContent());
        return ResponseEntity.ok(new PaginateResponseType<>(
                content, result.getTotalElements(), result.isLast()));
    }

    @Operation(summary = "Search trips with filters")
    @GetMapping("/search")
    public ResponseEntity<?> searchTrips(
            @RequestParam(required = false) String companyId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String searchTerm,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String order,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) String originPlaceId,
            @RequestParam(required = false) String destinationPlaceId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int limit,
            @AuthenticationPrincipal User principal) {
        String scopedCompanyId = (companyId != null && !companyId.isBlank())
                ? companyId
                : principal != null ? resolveCompanyId(principal) : null;
        TripStatusEnum statusEnum = (status != null && !status.isBlank())
                ? TripStatusEnum.fromValue(status) : null;
        Page<TripType> result = tripService.search(
                scopedCompanyId,
                statusEnum,
                searchTerm,
                sortBy,
                order,
                date,
                originPlaceId,
                destinationPlaceId,
                page,
                limit);
        var content = enricher.enrich(result.getContent());
        return ResponseEntity.ok(new PaginateResponseType<>(
                content, result.getTotalElements(), result.isLast()));
    }

    @Operation(summary = "Update a trip")
    @PutMapping("/{id}")
    public ResponseEntity<TripResponse> updateTrip(
            @PathVariable String id,
            @Valid @RequestBody TripUpdateRequest req,
            @AuthenticationPrincipal User principal) {
        String companyId = resolveCompanyId(principal);
        TripType trip = tripService.update(id, req, companyId);
        return ResponseEntity.ok(enricher.enrich(trip));
    }

    @Operation(summary = "Delete a trip (SCHEDULED only)")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTrip(
            @PathVariable String id,
            @AuthenticationPrincipal User principal) {
        String companyId = resolveCompanyId(principal);
        tripService.delete(id, companyId);
        return ResponseEntity.ok(Map.of("message", "Trip deleted successfully", "id", id));
    }

    // ════════════════════════════════════════════════════════════════════
    // STATUS TRANSITION
    // ════════════════════════════════════════════════════════════════════
    @Operation(summary = "Transition trip status")
    @PatchMapping("/{id}/status")
    public ResponseEntity<TripResponse> transitionStatus(
            @PathVariable String id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User principal) {
        String companyId = resolveCompanyId(principal);
        String targetStatus = body.get("status");
        if (targetStatus == null || targetStatus.isBlank()) {
            throw new BadRequestException("status is required");
        }
        TripType trip = tripService.transitionStatus(
                id, TripStatusEnum.fromValue(targetStatus), companyId);
        return ResponseEntity.ok(enricher.enrich(trip));
    }

    // ════════════════════════════════════════════════════════════════════
    // SEGMENT FIELD UPDATES
    // ════════════════════════════════════════════════════════════════════
    @Operation(summary = "Update segment base price")
    @PatchMapping("/{id}/segments/{segmentId}/price")
    public ResponseEntity<TripResponse> updateSegmentPrice(
            @PathVariable String id,
            @PathVariable String segmentId,
            @RequestBody Map<String, BigDecimal> body,
            @AuthenticationPrincipal User principal) {
        String companyId = resolveCompanyId(principal);
        BigDecimal price = body.get("basePrice");
        if (price == null) {
            throw new BadRequestException("basePrice is required");
        }
        TripType trip = tripService.updateSegmentPrice(id, segmentId, price, companyId);
        return ResponseEntity.ok(enricher.enrich(trip));
    }

    @Operation(summary = "Update segment max seats")
    @PatchMapping("/{id}/segments/{segmentId}/max-seats")
    public ResponseEntity<TripResponse> updateSegmentMaxSeats(
            @PathVariable String id,
            @PathVariable String segmentId,
            @RequestBody Map<String, Integer> body,
            @AuthenticationPrincipal User principal) {
        String companyId = resolveCompanyId(principal);
        Integer maxSeats = body.get("maxSeats");
        if (maxSeats == null) {
            throw new BadRequestException("maxSeats is required");
        }
        TripType trip = tripService.updateSegmentMaxSeats(id, segmentId, maxSeats, companyId);
        return ResponseEntity.ok(enricher.enrich(trip));
    }

    // ════════════════════════════════════════════════════════════════════
    // EXPRESS FARE SUB-RESOURCE
    // ════════════════════════════════════════════════════════════════════
    @Operation(summary = "Add an express fare to a trip")
    @PostMapping("/{id}/express-fares")
    public ResponseEntity<TripResponse> addExpressFare(
            @PathVariable String id,
            @Valid @RequestBody ExpressFareRequest req,
            @AuthenticationPrincipal User principal) {
        String companyId = resolveCompanyId(principal);
        TripType trip = tripService.addExpressFare(id, req, companyId);
        return ResponseEntity.status(HttpStatus.CREATED).body(enricher.enrich(trip));
    }

    @Operation(summary = "Update an express fare")
    @PutMapping("/{id}/express-fares/{expressId}")
    public ResponseEntity<TripResponse> updateExpressFare(
            @PathVariable String id,
            @PathVariable String expressId,
            @Valid @RequestBody ExpressFareUpdateRequest req,
            @AuthenticationPrincipal User principal) {
        String companyId = resolveCompanyId(principal);
        TripType trip = tripService.updateExpressFare(id, expressId, req, companyId);
        return ResponseEntity.ok(enricher.enrich(trip));
    }

    @Operation(summary = "Delete/deactivate an express fare")
    @DeleteMapping("/{id}/express-fares/{expressId}")
    public ResponseEntity<TripResponse> deleteExpressFare(
            @PathVariable String id,
            @PathVariable String expressId,
            @AuthenticationPrincipal User principal) {
        String companyId = resolveCompanyId(principal);
        TripType trip = tripService.deleteExpressFare(id, expressId, companyId);
        return ResponseEntity.ok(enricher.enrich(trip));
    }

    // ════════════════════════════════════════════════════════════════════
    // PICKUP POINT SUB-RESOURCE
    // ════════════════════════════════════════════════════════════════════
    @Operation(summary = "Add a pickup point")
    @PostMapping("/{id}/pickup-points")
    public ResponseEntity<TripResponse> addPickupPoint(
            @PathVariable String id,
            @Valid @RequestBody PickupPointRequest req,
            @AuthenticationPrincipal User principal) {
        String companyId = resolveCompanyId(principal);
        TripType trip = tripService.addPickupPoint(id, req, companyId);
        return ResponseEntity.status(HttpStatus.CREATED).body(enricher.enrich(trip));
    }

    @Operation(summary = "Update a pickup point")
    @PutMapping("/{id}/pickup-points/{pointId}")
    public ResponseEntity<TripResponse> updatePickupPoint(
            @PathVariable String id,
            @PathVariable String pointId,
            @Valid @RequestBody PickupPointRequest req,
            @AuthenticationPrincipal User principal) {
        String companyId = resolveCompanyId(principal);
        TripType trip = tripService.updatePickupPoint(id, pointId, req, companyId);
        return ResponseEntity.ok(enricher.enrich(trip));
    }

    // ════════════════════════════════════════════════════════════════════
    // DROPOFF POINT SUB-RESOURCE
    // ════════════════════════════════════════════════════════════════════
    @Operation(summary = "Add a dropoff point")
    @PostMapping("/{id}/dropoff-points")
    public ResponseEntity<TripResponse> addDropoffPoint(
            @PathVariable String id,
            @Valid @RequestBody DropoffPointRequest req,
            @AuthenticationPrincipal User principal) {
        String companyId = resolveCompanyId(principal);
        TripType trip = tripService.addDropoffPoint(id, req, companyId);
        return ResponseEntity.status(HttpStatus.CREATED).body(enricher.enrich(trip));
    }

    @Operation(summary = "Update a dropoff point")
    @PutMapping("/{id}/dropoff-points/{pointId}")
    public ResponseEntity<TripResponse> updateDropoffPoint(
            @PathVariable String id,
            @PathVariable String pointId,
            @Valid @RequestBody DropoffPointRequest req,
            @AuthenticationPrincipal User principal) {
        String companyId = resolveCompanyId(principal);
        TripType trip = tripService.updateDropoffPoint(id, pointId, req, companyId);
        return ResponseEntity.ok(enricher.enrich(trip));
    }

    // ════════════════════════════════════════════════════════════════════
    // AUTH HELPER
    // ════════════════════════════════════════════════════════════════════
    private String resolveCompanyId(User principal) {
        if (principal == null) {
            throw new UnauthorizedException("Authentication required");
        }
        // Prefer X-Company-Id header (multi-account: company is on the account, not the user)
        String headerCompanyId = httpServletRequest.getHeader("X-Company-Id");
        if (headerCompanyId != null && !headerCompanyId.isBlank()) {
            return headerCompanyId.trim();
        }
        // Fallback: read from user document (single-account legacy)
        UserType user = userRepository.findById(principal.getUsername())
                .orElseThrow(() -> new UnauthorizedException("User not found"));
        if (user.getTarget() == null || user.getTarget().getCompany() == null) {
            throw new BadRequestException("User has no company assigned");
        }
        return user.getTarget().getCompany();
    }
}
