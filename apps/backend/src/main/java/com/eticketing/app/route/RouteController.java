package com.eticketing.app.route;

import com.eticketing.app.place.PlaceRepository;
import com.eticketing.app.place.PlaceType;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * REST Controller for managing routes and route coefficients.
 */
@RestController
@RequestMapping("/api/routes")
public class RouteController {

    private final RouteRepository routeRepository;
    private final RouteCoefficientRepository coefficientRepository;
    private final PlaceRepository placeRepository;

    public RouteController(
            RouteRepository routeRepository,
            RouteCoefficientRepository coefficientRepository,
            PlaceRepository placeRepository
    ) {
        this.routeRepository = routeRepository;
        this.coefficientRepository = coefficientRepository;
        this.placeRepository = placeRepository;
    }

    // ==================== ROUTE CRUD ====================
    @Operation(summary = "Get all routes", responses = {
        @ApiResponse(responseCode = "200", description = "Routes found")
    })
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllRoutes() {
        List<RouteType> routes = routeRepository.findAll();
        List<Map<String, Object>> result = routes.stream().map(this::buildRouteResponse).toList();
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Get active routes only", responses = {
        @ApiResponse(responseCode = "200", description = "Active routes found")
    })
    @GetMapping("/active")
    public ResponseEntity<List<Map<String, Object>>> getActiveRoutes() {
        List<RouteType> routes = routeRepository.findByActiveTrue();
        List<Map<String, Object>> result = routes.stream().map(this::buildRouteResponse).toList();
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Get a route by ID", responses = {
        @ApiResponse(responseCode = "200", description = "Route found"),
        @ApiResponse(responseCode = "404", description = "Route not found")
    })
    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getRouteById(@PathVariable String id) {
        RouteType route = routeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Route not found"));
        return ResponseEntity.ok(buildRouteResponse(route));
    }

    @Operation(summary = "Find route by origin and destination", responses = {
        @ApiResponse(responseCode = "200", description = "Route found"),
        @ApiResponse(responseCode = "404", description = "Route not found")
    })
    @GetMapping("/find")
    public ResponseEntity<Map<String, Object>> findRoute(
            @RequestParam String originId,
            @RequestParam String destinationId) {
        RouteType route = routeRepository.findByOriginIdAndDestinationId(originId, destinationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Route not found"));
        return ResponseEntity.ok(buildRouteResponse(route));
    }

    @Operation(summary = "Create a new route", responses = {
        @ApiResponse(responseCode = "200", description = "Route created"),
        @ApiResponse(responseCode = "400", description = "Invalid request or route already exists")
    })
    @PostMapping
    public ResponseEntity<Map<String, Object>> createRoute(@Valid @RequestBody CreateRouteRequest request) {
        // Check if route already exists
        if (routeRepository.existsByOriginIdAndDestinationId(request.originId(), request.destinationId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Route already exists for this pair");
        }

        // Validate places exist
        if (!placeRepository.existsById(request.originId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Origin place not found");
        }
        if (!placeRepository.existsById(request.destinationId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Destination place not found");
        }

        RouteType route = new RouteType();
        route.setOriginId(request.originId());
        route.setDestinationId(request.destinationId());
        route.setFare(request.fare() != null ? request.fare() : BigDecimal.ZERO);
        route.setRank(request.rank());
        route.setActive(request.active() != null ? request.active() : true);

        RouteType saved = routeRepository.save(route);
        return ResponseEntity.ok(buildRouteResponse(saved));
    }

    @Operation(summary = "Update an existing route", responses = {
        @ApiResponse(responseCode = "200", description = "Route updated"),
        @ApiResponse(responseCode = "404", description = "Route not found")
    })
    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updateRoute(
            @PathVariable String id,
            @RequestBody Map<String, Object> updates) {
        RouteType route = routeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Route not found"));

        // Support updating origin/destination with validation and uniqueness check
        String newOriginId = route.getOriginId();
        String newDestinationId = route.getDestinationId();

        if (updates.containsKey("originId")) {
            Object val = updates.get("originId");
            if (val == null || !(val instanceof String s) || s.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Origin place id is invalid");
            }
            String originId = ((String) val).toString();
            if (!placeRepository.existsById(originId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Origin place not found");
            }
            newOriginId = originId;
        }

        if (updates.containsKey("destinationId")) {
            Object val = updates.get("destinationId");
            if (val == null || !(val instanceof String s) || s.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Destination place id is invalid");
            }
            String destinationId = ((String) val).toString();
            if (!placeRepository.existsById(destinationId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Destination place not found");
            }
            newDestinationId = destinationId;
        }

        // If both endpoints are known, ensure there is no conflicting route pair
        if (newOriginId != null && newDestinationId != null) {
            var existing = routeRepository.findByOriginIdAndDestinationId(newOriginId, newDestinationId);
            if (existing.isPresent() && !existing.get().getId().equals(route.getId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Route already exists for this pair");
            }
        }

        route.setOriginId(newOriginId);
        route.setDestinationId(newDestinationId);

        if (updates.containsKey("fare")) {
            Object val = updates.get("fare");
            if (val instanceof Number n) {
                route.setFare(BigDecimal.valueOf(n.doubleValue()));
            } else if (val instanceof String s) {
                route.setFare(new BigDecimal(s));
            }
        }
        if (updates.containsKey("rank")) {
            Object val = updates.get("rank");
            if (val instanceof Number n) {
                route.setRank(n.intValue());
            }
        }
        if (updates.containsKey("active")) {
            Object val = updates.get("active");
            if (val instanceof Boolean b) {
                route.setActive(b);
            }
        }

        RouteType saved = routeRepository.save(route);
        return ResponseEntity.ok(buildRouteResponse(saved));
    }

    @Operation(summary = "Delete a route", responses = {
        @ApiResponse(responseCode = "200", description = "Route deleted"),
        @ApiResponse(responseCode = "404", description = "Route not found")
    })
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteRoute(@PathVariable String id) {
        if (!routeRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Route not found");
        }
        routeRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Route deleted successfully", "id", id));
    }

    // ==================== COEFFICIENT CRUD ====================
    @Operation(summary = "Get all coefficients for a route", responses = {
        @ApiResponse(responseCode = "200", description = "Coefficients found")
    })
    @GetMapping("/{routeId}/coefficients")
    public ResponseEntity<List<RouteCoefficient>> getRouteCoefficients(@PathVariable String routeId) {
        List<RouteCoefficient> coefficients = coefficientRepository.findByRouteIdOrderByStartDateDesc(routeId);
        return ResponseEntity.ok(coefficients);
    }

    @Operation(summary = "Get all global coefficients", responses = {
        @ApiResponse(responseCode = "200", description = "Global coefficients found")
    })
    @GetMapping("/coefficients/global")
    public ResponseEntity<List<RouteCoefficient>> getGlobalCoefficients() {
        List<RouteCoefficient> coefficients = coefficientRepository.findByRouteIdIsNullAndActiveTrue();
        return ResponseEntity.ok(coefficients);
    }

    @Operation(summary = "Get active coefficient for a route on a specific date", responses = {
        @ApiResponse(responseCode = "200", description = "Coefficient found")
    })
    @GetMapping("/coefficients/active")
    public ResponseEntity<Map<String, Object>> getActiveCoefficient(
            @RequestParam(required = false) String routeId,
            @RequestParam @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) LocalDate date) {
        // Coefficients are optional now; return BigDecimal.ONE if none found
        BigDecimal coeff = BigDecimal.ONE;
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("routeId", routeId);
        response.put("date", date);
        response.put("coefficient", coeff);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Create a new coefficient", responses = {
        @ApiResponse(responseCode = "200", description = "Coefficient created")
    })
    @PostMapping("/coefficients")
    public ResponseEntity<RouteCoefficient> createCoefficient(@Valid @RequestBody CreateCoefficientRequest request) {
        RouteCoefficient coeff = new RouteCoefficient();
        coeff.setRouteId(request.routeId()); // null for global
        coeff.setStartDate(request.startDate());
        coeff.setEndDate(request.endDate());
        coeff.setCoefficient(request.coefficient() != null ? request.coefficient() : BigDecimal.ONE);
        coeff.setName(request.name());
        coeff.setPriority(request.priority() != null ? request.priority() : 0);
        coeff.setActive(request.active() != null ? request.active() : true);

        RouteCoefficient saved = coefficientRepository.save(coeff);
        return ResponseEntity.ok(saved);
    }

    @Operation(summary = "Update a coefficient", responses = {
        @ApiResponse(responseCode = "200", description = "Coefficient updated"),
        @ApiResponse(responseCode = "404", description = "Coefficient not found")
    })
    @PutMapping("/coefficients/{id}")
    public ResponseEntity<RouteCoefficient> updateCoefficient(
            @PathVariable String id,
            @RequestBody Map<String, Object> updates) {
        RouteCoefficient coeff = coefficientRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Coefficient not found"));

        if (updates.containsKey("startDate")) {
            coeff.setStartDate(LocalDate.parse(updates.get("startDate").toString()));
        }
        if (updates.containsKey("endDate")) {
            coeff.setEndDate(LocalDate.parse(updates.get("endDate").toString()));
        }
        if (updates.containsKey("coefficient")) {
            Object val = updates.get("coefficient");
            if (val instanceof Number n) {
                coeff.setCoefficient(BigDecimal.valueOf(n.doubleValue()));
            } else if (val instanceof String s) {
                coeff.setCoefficient(new BigDecimal(s));
            }
        }
        if (updates.containsKey("name")) {
            coeff.setName((String) updates.get("name"));
        }
        if (updates.containsKey("priority")) {
            Object val = updates.get("priority");
            if (val instanceof Number n) {
                coeff.setPriority(n.intValue());
            }
        }
        if (updates.containsKey("active")) {
            Object val = updates.get("active");
            if (val instanceof Boolean b) {
                coeff.setActive(b);
            }
        }

        RouteCoefficient saved = coefficientRepository.save(coeff);
        return ResponseEntity.ok(saved);
    }

    @Operation(summary = "Delete a coefficient", responses = {
        @ApiResponse(responseCode = "200", description = "Coefficient deleted"),
        @ApiResponse(responseCode = "404", description = "Coefficient not found")
    })
    @DeleteMapping("/coefficients/{id}")
    public ResponseEntity<Map<String, Object>> deleteCoefficient(@PathVariable String id) {
        if (!coefficientRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Coefficient not found");
        }
        coefficientRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Coefficient deleted successfully", "id", id));
    }

    // ==================== HELPERS ====================
    private Map<String, Object> buildRouteResponse(RouteType route) {
        PlaceType origin = route.getOriginId() != null
                ? placeRepository.findById(route.getOriginId()).orElse(null)
                : null;
        PlaceType destination = route.getDestinationId() != null
                ? placeRepository.findById(route.getDestinationId()).orElse(null)
                : null;

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", route.getId());
        response.put("origin", origin);
        response.put("destination", destination);
        response.put("fare", route.getFare());
        response.put("rank", route.getRank());
        response.put("active", route.isActive());
        return response;
    }

    // ==================== DTOs ====================
    public record CreateRouteRequest(
            @NotNull String originId,
            @NotNull String destinationId,
            BigDecimal fare,
            Integer rank,
            Boolean active
            ) {

    }

    public record CreateCoefficientRequest(
            String routeId, // null for global
            @NotNull LocalDate startDate,
            @NotNull LocalDate endDate,
            BigDecimal coefficient,
            String name,
            Integer priority,
            Boolean active
            ) {

    }
}
