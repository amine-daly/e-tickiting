package com.eticketing.app.web;

import com.eticketing.app.trip.TripType;
import com.eticketing.app.place.PlaceRepository;
import com.eticketing.app.place.PlaceDocument;
import com.eticketing.app.trip.LonLatType;
import com.eticketing.app.trip.ZoneTypesEnum;
import com.eticketing.app.trip.SeatStateEnum;
import com.eticketing.app.trip.SeatUnit;
import com.eticketing.app.trip.TripTypeRepository;
import com.eticketing.app.user.RoleType;
import com.eticketing.app.user.UserTypeRepository;
import com.eticketing.app.agency.AgencyRepository;
import com.eticketing.app.agency.Agency;
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

    @Operation(
        summary = "Create a new trip",
        requestBody = @RequestBody(content = @Content(mediaType = "application/json",
            examples = @ExampleObject(value = "{\n  \"agencyId\": \"...\",\n  \"originId\": \"...\",\n  \"destinationId\": \"...\",\n  \"departureDate\": \"2025-11-20\",\n  \"price\": 25.0,\n  \"availableSeats\": 54\n}"))),
        responses = {
            @ApiResponse(responseCode = "200", description = "Trip created"),
            @ApiResponse(responseCode = "400", description = "Invalid input")
        }
    )
    @PostMapping
    public ResponseEntity<Map<String, Object>> createTrip(@RequestBody TripType trip) {
        // Debug: print incoming TripType fields
        System.out.println("DEBUG TripType: agencyId=" + trip.getAgencyId());
        System.out.println("DEBUG TripType: originId=" + trip.getOriginId());
        System.out.println("DEBUG TripType: destinationId=" + trip.getDestinationId());
        System.out.println("DEBUG TripType: departureDate=" + trip.getDepartureDate());
        System.out.println("DEBUG TripType: price=" + trip.getPrice());
        System.out.println("DEBUG TripType: availableSeats=" + trip.getAvailableSeats());
        // Optionally: validate referenced IDs exist (agency, origin, destination)
        // Save trip
        TripType saved = trips.save(trip);
        // Return mapped view
        return ResponseEntity.ok(toView(saved));
    }

    @Operation(
        summary = "Search trips with filters and pagination",
        parameters = {
            @Parameter(name = "originId", description = "Origin place ID"),
            @Parameter(name = "destinationId", description = "Destination place ID"),
            @Parameter(name = "date", description = "Departure date (yyyy-MM-dd)", example = "2025-11-01"),
            @Parameter(name = "agencyId", description = "Agency ID"),
            @Parameter(name = "page", description = "Page index (0-based)", example = "0"),
            @Parameter(name = "limit", description = "Page size", example = "10")
        },
        responses = {
            @ApiResponse(responseCode = "200", description = "Trips found"),
            @ApiResponse(responseCode = "400", description = "Invalid parameters")
        }
    )
    @GetMapping("/search")
    public ResponseEntity<PaginateResponseType<Map<String, Object>>> searchTrips(
            @RequestParam(required = false) String originId,
            @RequestParam(required = false) String destinationId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) String agencyId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int limit) {
        if (page < 0) page = 0;
        if (limit < 1 || limit > 100) limit = 10;
        Pageable pageable = PageRequest.of(page, limit, Sort.by(Sort.Direction.ASC, "departureDate"));

        // Use TripFilterInput for clean filter handling
        TripFilterInput filter = new TripFilterInput(originId, destinationId, date, agencyId);

        // Build dynamic query
        var q = new org.springframework.data.mongodb.core.query.Query();
        if (filter.originId() != null && !filter.originId().isBlank())
            q.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("originId").is(filter.originId()));
        if (filter.destinationId() != null && !filter.destinationId().isBlank())
            q.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("destinationId").is(filter.destinationId()));
        if (filter.date() != null)
            q.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("departureDate").is(filter.date()));
        if (filter.agencyId() != null && !filter.agencyId().isBlank())
            q.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("agencyId").is(filter.agencyId()));
        q.with(pageable);

        List<TripType> found = mongoTemplate.find(q, TripType.class);
        long count = mongoTemplate.count(q.skip(-1).limit(-1), TripType.class);

        // Map to view objects
        List<Map<String, Object>> tripsView = found.stream().map(this::toView).toList();
        boolean isLast = (page * limit + found.size()) >= count;
        return ResponseEntity.ok(new PaginateResponseType<>(tripsView, count, isLast));
    }

    /**
     * Clean filter input for searching trips.
     */
    public record TripFilterInput(
        String originId,
        String destinationId,
        LocalDate date,
        String agencyId
    ) {}

    private final TripTypeRepository trips;
    private final UserTypeRepository users;
    private final AgencyRepository agencies;
    private final PlaceRepository places;
    private final org.springframework.data.mongodb.core.MongoTemplate mongoTemplate;

    public TripController(TripTypeRepository trips, UserTypeRepository users, AgencyRepository agencies, PlaceRepository places, org.springframework.data.mongodb.core.MongoTemplate mongoTemplate) {
        System.out.println("TripController instance loaded: " + this.getClass().getName());
        this.trips = trips;
        this.users = users;
        this.agencies = agencies;
        this.places = places;
        this.mongoTemplate = mongoTemplate;
    }

    @Schema(name = "SeatUnitPayload")
    public record SeatUnitPayload(@Min(1) int row, @Min(1) int col, @NotNull SeatStateEnum state) {}

    @Schema(name = "UpdateSeatsPayload")
    public record UpdateSeatsPayload(@NotNull List<@Valid SeatUnitPayload> seats) {}


    @Operation(
        summary = "Get seat map for a trip",
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
            throw new ConflictException("This trip was updated by another user. Please reload the page to see the latest seat map and try again.");
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

    private Map<String, Object> toView(TripType trip) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("id", trip.getId());
    map.put("departureDate", trip.getDepartureDate());
    map.put("availableSeats", trip.getAvailableSeats());
    // Fetch and embed full origin, destination, and agency objects
    map.put("origin", trip.getOriginId() != null ? places.findById(trip.getOriginId()).orElse(null) : null);
    map.put("destination", trip.getDestinationId() != null ? places.findById(trip.getDestinationId()).orElse(null) : null);
    map.put("agency", trip.getAgencyId() != null ? agencies.findById(trip.getAgencyId()).orElse(null) : null);
    // Add more fields as needed
    return map;
    }
}
