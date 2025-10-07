package com.eticketing.app.web;

import com.eticketing.app.trip.TripType;
import com.eticketing.app.trip.PlaceType;
import com.eticketing.app.trip.LonLatType;
import com.eticketing.app.trip.ZoneTypesEnum;
import com.eticketing.app.trip.SeatStateEnum;
import com.eticketing.app.trip.SeatUnit;
import com.eticketing.app.trip.TripTypeRepository;
import com.eticketing.app.user.RoleType;
import com.eticketing.app.user.UserTypeRepository;
import com.eticketing.app.web.error.ApiExceptions.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.User;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.dao.OptimisticLockingFailureException;

@RestController
@RequestMapping("/api/trips")
@Tag(name = "Trips", description = "Trip management APIs")
public class TripController {

    private final TripTypeRepository trips;
    private final UserTypeRepository users;

    public TripController(TripTypeRepository trips, UserTypeRepository users) {
        this.trips = trips;
        this.users = users;
    }

    @Schema(name = "TripPayload")
    public record TripPayload(
        @NotNull PlacePayload source,
        @NotNull PlacePayload destination,
            @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate departureDate,
            @NotNull BigDecimal price,
            @Min(0) int availableSeats
    ) {}

    @Schema(name = "PlacePayload")
    public record PlacePayload(
        @NotBlank String city,
        @NotNull LocationPayload location
    ) {}

    @Schema(name = "LocationPayload")
    public record LocationPayload(
        @NotNull ZoneTypesEnum type,
        @NotNull List<Double> coordinates
    ) {}

    @Operation(summary = "Create a trip (ADMIN or MANAGER)",
        requestBody = @RequestBody(content = @Content(mediaType = "application/json",
        examples = @ExampleObject(value = "{\n  \"source\": {\n    \"city\": \"Tunis\",\n    \"location\": {\n      \"type\": \"POINT\",\n      \"coordinates\": [10.1815, 36.8065]\n    }\n  },\n  \"destination\": {\n    \"city\": \"Sfax\",\n    \"location\": {\n      \"type\": \"POINT\",\n      \"coordinates\": [10.7603, 34.739]\n    }\n  },\n  \"departureDate\": \"2025-10-10\",\n  \"price\": 19.9,\n  \"availableSeats\": 30\n}"))),
        responses = {@ApiResponse(responseCode = "201", description = "Created"), @ApiResponse(responseCode = "403", description = "Forbidden")} )
    @PostMapping
    public ResponseEntity<Map<String, Object>> create(@Valid @org.springframework.web.bind.annotation.RequestBody TripPayload payload,
                                                      @AuthenticationPrincipal User principal) {
    var me = ensureAdminOrManager(principal);
    var trip = new TripType(
        new PlaceType(payload.source().city(), new LonLatType(payload.source().location().type(), payload.source().location().coordinates())),
        new PlaceType(payload.destination().city(), new LonLatType(payload.destination().location().type(), payload.destination().location().coordinates())),
        payload.departureDate(), payload.price(), payload.availableSeats());
        trips.save(trip);
        return ResponseEntity.status(201).body(toView(trip));
    }

    @Operation(summary = "Get trip by id")
    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getById(@Parameter(description = "Trip id") @PathVariable String id) {
        var t = trips.findById(id).orElseThrow(() -> new NotFoundException("Trip not found"));
        return ResponseEntity.ok(toView(t));
    }

    @Operation(summary = "Delete a trip (ADMIN or MANAGER)")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@Parameter(description = "Trip id") @PathVariable String id, @AuthenticationPrincipal User principal) {
        ensureAdminOrManager(principal);
        if (trips.existsById(id)) {
            trips.deleteById(id);
        }
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "List trips (ADMIN or MANAGER)")
    @GetMapping
    public ResponseEntity<PaginateResponseType<Map<String, Object>>> list(
            @Parameter(description = "0-based page index", example = "0") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size (items per page)", example = "10") @RequestParam(defaultValue = "10") int limit,
            @AuthenticationPrincipal User principal) {
        ensureAdminOrManager(principal);
        if (page < 0) page = 0;
        if (limit < 1) limit = 10;
        Pageable pageable = PageRequest.of(page, limit, Sort.by("departureDate").descending());
        var p = trips.findAll(pageable);
        List<Map<String, Object>> objects = p.getContent().stream().map(this::toView).toList();
        return ResponseEntity.ok(new PaginateResponseType<>(objects, p.getTotalElements(), p.isLast()));
    }

    private Map<String, Object> toView(TripType t) {
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
    if (t.getSeats() != null) {
        m.put("seats", t.getSeats().stream().map(s -> Map.of(
            "row", s.getRow(),
            "col", s.getCol(),
            "state", s.getState().name()
        )).toList());
    }
        return m;
    }

    @Operation(summary = "Get seat map for a trip",
        responses = {
            @ApiResponse(responseCode = "200", description = "Seat map returned"),
            @ApiResponse(responseCode = "404", description = "Trip not found")
        }
    )
    @GetMapping("/{id}/seats")
    public ResponseEntity<Map<String, Object>> seatMap(@PathVariable String id) {
    var t = trips.findById(id).orElseThrow(() -> new NotFoundException("Trip not found"));
    Map<String, Object> resp = new LinkedHashMap<>();
    resp.put("tripId", t.getId());
    resp.put("seats", t.getSeats() == null ? List.of() : t.getSeats().stream().map(s -> Map.of(
        "row", s.getRow(),
        "col", s.getCol(),
        "state", s.getState().name()
    )).toList());
    return ResponseEntity.ok(resp);
    }

    @Schema(name = "ReserveSeatPayload")
    public record ReserveSeatPayload(
        @NotNull List<SeatCoord> seats
    ) {}

    public record SeatCoord(@Min(1) int row, @Min(1) int col) {}

    @Operation(summary = "Reserve seats for a trip",
        requestBody = @RequestBody(content = @Content(mediaType = "application/json",
            examples = @ExampleObject(value = "{\n  \"seats\": [ { \"row\": 3, \"col\": 1 }, { \"row\": 3, \"col\": 2 } ]\n}"))),
        responses = {
            @ApiResponse(responseCode = "200", description = "Seats reserved"),
            @ApiResponse(responseCode = "400", description = "Seat map not available"),
            @ApiResponse(responseCode = "401", description = "Authentication required"),
            @ApiResponse(responseCode = "404", description = "Trip or seat not found"),
            @ApiResponse(responseCode = "409", description = "Seat not available or concurrent update")
        }
    )
    @PostMapping("/{id}/seats:reserve")
    public ResponseEntity<Map<String, Object>> reserveSeats(@PathVariable String id,
                                @Valid @org.springframework.web.bind.annotation.RequestBody ReserveSeatPayload payload,
                                @AuthenticationPrincipal User principal) {
    if (principal == null) throw new UnauthorizedException("Authentication required");
    var trip = trips.findById(id).orElseThrow(() -> new NotFoundException("Trip not found"));

    if (trip.getSeats() == null || trip.getSeats().isEmpty()) {
        throw new BadRequestException("Seat map not available for this trip");
    }

    var wanted = payload.seats().stream().collect(Collectors.toSet());

    // Reserve only AVAILABLE seats; reject if any requested is not AVAILABLE
    for (var sc : payload.seats()) {
        var seat = trip.getSeats().stream()
            .filter(s -> s.getRow() == sc.row() && s.getCol() == sc.col())
            .findFirst()
            .orElseThrow(() -> new NotFoundException("Seat " + sc.row() + "-" + sc.col() + " not found"));
        if (seat.getState() != SeatStateEnum.AVAILABLE) {
        throw new ConflictException("Seat " + sc.row() + "-" + sc.col() + " is not available");
        }
    }

    // All ok, mark as RESERVED
    for (var sc : payload.seats()) {
        trip.getSeats().stream()
            .filter(s -> s.getRow() == sc.row() && s.getCol() == sc.col())
            .findFirst()
            .ifPresent(s -> s.setState(SeatStateEnum.RESERVED));
    }

    // Decrease availableSeats accordingly
    trip.setAvailableSeats(Math.max(0, trip.getAvailableSeats() - payload.seats().size()));
    try {
        trips.save(trip);
    } catch (OptimisticLockingFailureException e) {
        throw new ConflictException("Seat map changed, please refresh and try again");
    }

    Map<String, Object> resp = new LinkedHashMap<>();
    resp.put("tripId", trip.getId());
    resp.put("reserved", payload.seats());
    return ResponseEntity.ok(resp);
    }

    @Schema(name = "SeatUnitPayload")
    public record SeatUnitPayload(@Min(1) int row, @Min(1) int col, @NotNull SeatStateEnum state) {}

    @Schema(name = "UpdateSeatsPayload")
    public record UpdateSeatsPayload(@NotNull List<@Valid SeatUnitPayload> seats) {}

    @Operation(
        summary = "Initialize or update seat map (ADMIN or MANAGER)",
        requestBody = @RequestBody(content = @Content(mediaType = "application/json",
            examples = @ExampleObject(value = "{\n  \"seats\": [\n    { \"row\": 1, \"col\": 1, \"state\": \"AVAILABLE\" },\n    { \"row\": 1, \"col\": 2, \"state\": \"BLOCKED\" }\n  ]\n}"))),
        responses = {
            @ApiResponse(responseCode = "200", description = "Seat map updated"),
            @ApiResponse(responseCode = "403", description = "Forbidden")
        }
    )
    @PutMapping("/{id}/seats")
    public ResponseEntity<Map<String, Object>> updateSeats(
            @PathVariable String id,
            @Valid @org.springframework.web.bind.annotation.RequestBody UpdateSeatsPayload payload,
            @AuthenticationPrincipal User principal) {
        ensureAdminOrManager(principal);
        var trip = trips.findById(id).orElseThrow(() -> new NotFoundException("Trip not found"));

        // Map payload to domain SeatUnit list (allow empty list to clear map)
        List<SeatUnit> newSeats = payload.seats() == null ? List.of() : payload.seats().stream()
                .map(s -> new SeatUnit(s.row(), s.col(), s.state()))
                .toList();
        trip.setSeats(newSeats);

        // Recompute availableSeats as number of AVAILABLE seats
        int available = (int) newSeats.stream().filter(s -> s.getState() == SeatStateEnum.AVAILABLE).count();
        trip.setAvailableSeats(available);

        try {
            trips.save(trip);
        } catch (OptimisticLockingFailureException e) {
            throw new ConflictException("Seat map changed, please refresh and try again");
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("tripId", trip.getId());
        resp.put("seats", trip.getSeats() == null ? List.of() : trip.getSeats().stream().map(s -> Map.of(
            "row", s.getRow(),
            "col", s.getCol(),
            "state", s.getState().name()
        )).toList());
        return ResponseEntity.ok(resp);
    }

    private com.eticketing.app.user.UserType ensureAdminOrManager(User principal) {
        if (principal == null) throw new UnauthorizedException("Authentication required");
        var me = users.findById(principal.getUsername()).orElseThrow(() -> new UnauthorizedException("Authentication subject not found"));
        if (me.getRole() != RoleType.ADMIN && me.getRole() != RoleType.MANAGER) {
            throw new ForbiddenException("ADMIN or MANAGER only");
        }
        return me;
    }
}
