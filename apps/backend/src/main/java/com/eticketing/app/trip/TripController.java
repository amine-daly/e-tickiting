package com.eticketing.app.trip;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import com.eticketing.app.agency.AgencyRepository;
import com.eticketing.app.agency.AgencyType;
import com.eticketing.app.place.PlaceRepository;
import com.eticketing.app.route.RouteRepository;
import com.eticketing.app.route.RouteType;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.format.DateTimeFormatter;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.server.ResponseStatusException;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;

import org.springframework.web.bind.annotation.GetMapping;

import com.eticketing.app.web.PaginateResponseType;

@RestController
@RequestMapping(path = {"/api/trip", "/api/trips"})
public class TripController {

    private final TripTypeRepository tripTypeRepository;
    private final AgencyRepository agencyRepository;
    private final PlaceRepository placeRepository;
    private final RouteRepository routeRepository;
    private final org.springframework.data.mongodb.core.MongoTemplate mongoTemplate;

    public TripController(
            TripTypeRepository tripTypeRepository,
            AgencyRepository agencyRepository,
            PlaceRepository placeRepository,
            RouteRepository routeRepository,
            org.springframework.data.mongodb.core.MongoTemplate mongoTemplate
    ) {
        this.tripTypeRepository = tripTypeRepository;
        this.agencyRepository = agencyRepository;
        this.placeRepository = placeRepository;
        this.routeRepository = routeRepository;
        this.mongoTemplate = mongoTemplate;
    }

    @Operation(summary = "Get a trip by id", responses = {
        @ApiResponse(responseCode = "200", description = "Trip found"),
        @ApiResponse(responseCode = "404", description = "Trip not found")
    })
    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getTripById(@PathVariable String id) {
        TripType trip = tripTypeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip not found"));
        return ResponseEntity.ok(buildTripResponse(trip));
    }

    @PostMapping(path = "/create", consumes = org.springframework.http.MediaType.APPLICATION_JSON_VALUE,
            produces = org.springframework.http.MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> createTrip(@Valid @RequestBody CreateTripRequest payload) {
        TripType toSave = new TripType();
        toSave.setAgencyId(payload.agencyId());
        toSave.setOriginId(payload.originId());
        toSave.setDestinationId(payload.destinationId());
        toSave.setTotalPrice(payload.totalPrice() != null ? payload.totalPrice() : BigDecimal.ZERO);

        // Process stops: build snapshots from route IDs
        List<TripRouteSnapshot> stopSnapshots = new ArrayList<>();
        if (payload.stops() != null && !payload.stops().isEmpty()) {
            for (int i = 0; i < payload.stops().size(); i++) {
                RouteInput ri = payload.stops().get(i);
                RouteType route = routeRepository.findById(ri.id())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Route not found: " + ri.id()));

                TripRouteSnapshot snapshot = new TripRouteSnapshot();
                snapshot.setId(route.getId());
                snapshot.setOriginId(route.getOriginId());
                snapshot.setDestinationId(route.getDestinationId());
                snapshot.setRank(ri.rank() != null ? ri.rank() : i);
                // Use provided fare if present, otherwise use route's default fare
                snapshot.setFare(ri.fare() != null ? ri.fare() : route.getFare());
                stopSnapshots.add(snapshot);
            }
        }
        // Sort by rank
        stopSnapshots.sort(Comparator.comparing(r -> r.getRank() == null ? Integer.MAX_VALUE : r.getRank()));
        toSave.setStops(stopSnapshots);

        if (payload.departureDate() != null) {
            toSave.setDepartureDate(payload.departureDate().withOffsetSameInstant(ZoneOffset.UTC));
        }
        toSave.setAvailableSeats(payload.availableSeats());
        toSave.setStatus(payload.status() == null ? TripStatusEnum.SCHEDULED : payload.status());

        TripType saved = tripTypeRepository.save(toSave);
        return ResponseEntity.ok(buildTripResponse(saved));
    }

    // DTO for create-trip
    public record CreateTripRequest(
            String agencyId,
            @NotNull String originId,
            @NotNull String destinationId,
            @NotNull BigDecimal totalPrice,
            List<RouteInput> stops,
            OffsetDateTime departureDate,
            int availableSeats,
            TripStatusEnum status
            ) {

    }

    public record RouteInput(
            @NotNull String id,
            Integer rank,
            BigDecimal fare
            ) {

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
        if (page < 0) {
            page = 0;
        }
        if (limit < 1 || limit > 100) {
            limit = 10;
        }
        Pageable pageable = PageRequest.of(page, limit, Sort.by(Sort.Direction.ASC, "departureDate"));

        // Build dynamic query
        var q = new org.springframework.data.mongodb.core.query.Query();
        if (originId != null && !originId.isBlank()) {
            q.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("routes.originId").is(originId));
        }
        if (destinationId != null && !destinationId.isBlank()) {
            q.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("routes.destinationId").is(destinationId));
        }
        if (date != null) {
            // Match trips on the given date (comparing date part of departureDate)
            var start = date.atStartOfDay().atOffset(ZoneOffset.UTC);
            var end = date.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC);
            q.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("departureDate").gte(start).lt(end));
        }
        if (agencyId != null && !agencyId.isBlank()) {
            q.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("agencyId").is(agencyId));
        }
        q.with(pageable);

        List<TripType> found = mongoTemplate.find(q, TripType.class);
        long count = mongoTemplate.count(q.skip(-1).limit(-1), TripType.class);

        List<Map<String, Object>> tripsView = found.stream().map(this::buildTripResponse).toList();
        boolean isLast = (page * limit + found.size()) >= count;
        return ResponseEntity.ok(new PaginateResponseType<>(tripsView, count, isLast));
    }

    @PostMapping(path = "/update/{id}", consumes = org.springframework.http.MediaType.APPLICATION_JSON_VALUE, produces = org.springframework.http.MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> updateTrip(
            @PathVariable String id,
            @RequestBody Map<String, Object> updates) {
        TripType trip = tripTypeRepository.findById(id).orElseThrow(() -> new RuntimeException("Trip not found"));

        if (updates.containsKey("agencyId")) {
            trip.setAgencyId((String) updates.get("agencyId"));
        }

        if (updates.containsKey("originId")) {
            trip.setOriginId((String) updates.get("originId"));
        }

        if (updates.containsKey("destinationId")) {
            trip.setDestinationId((String) updates.get("destinationId"));
        }

        if (updates.containsKey("totalPrice")) {
            Object val = updates.get("totalPrice");
            if (val instanceof Number n) {
                trip.setTotalPrice(BigDecimal.valueOf(n.doubleValue()));
            } else if (val instanceof String s) {
                trip.setTotalPrice(new BigDecimal(s));
            }
        }

        if (updates.containsKey("stops") && updates.get("stops") != null) {
            Object val = updates.get("stops");
            if (val instanceof List<?> list) {
                List<TripRouteSnapshot> stopSnapshots = new ArrayList<>();
                for (int i = 0; i < list.size(); i++) {
                    Object raw = list.get(i);
                    if (raw instanceof Map m) {
                        String routeId = m.get("id") != null ? m.get("id").toString() : null;
                        if (routeId == null) {
                            continue;
                        }

                        RouteType route = routeRepository.findById(routeId).orElse(null);
                        if (route == null) {
                            continue;
                        }

                        TripRouteSnapshot snapshot = new TripRouteSnapshot();
                        snapshot.setId(route.getId());
                        snapshot.setOriginId(route.getOriginId());
                        snapshot.setDestinationId(route.getDestinationId());

                        Object rankObj = m.get("rank");
                        Integer rank = i;
                        if (rankObj instanceof Number n) {
                            rank = n.intValue();
                        }
                        snapshot.setRank(rank);

                        Object fareObj = m.get("fare");
                        BigDecimal fare = route.getFare();
                        if (fareObj instanceof Number n) {
                            fare = BigDecimal.valueOf(n.doubleValue());
                        } else if (fareObj instanceof String s) {
                            fare = new BigDecimal(s);
                        }
                        snapshot.setFare(fare);
                        stopSnapshots.add(snapshot);
                    }
                }
                stopSnapshots.sort(Comparator.comparing(r -> r.getRank() == null ? Integer.MAX_VALUE : r.getRank()));
                trip.setStops(stopSnapshots);
            }
        }

        if (updates.containsKey("departureDate") && updates.get("departureDate") != null) {
            String dateStr = updates.get("departureDate").toString();
            var dt = java.time.OffsetDateTime.parse(dateStr);
            trip.setDepartureDate(dt.withOffsetSameInstant(ZoneOffset.UTC));
        }

        if (updates.containsKey("availableSeats")) {
            Object val = updates.get("availableSeats");
            if (val instanceof Number n) {
                trip.setAvailableSeats(n.intValue());
            } else if (val instanceof String s) {
                trip.setAvailableSeats(Integer.parseInt(s));
            }
        }
        if (updates.containsKey("status")) {
            Object val = updates.get("status");
            if (val != null) {
                try {
                    trip.setStatus(TripStatusEnum.valueOf(val.toString().trim().toUpperCase()));
                } catch (IllegalArgumentException ex) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid trip status");
                }
            }
        }
        // Handle seats update
        if (updates.containsKey("seats") && updates.get("seats") != null) {
            Object val = updates.get("seats");
            if (val instanceof List<?> list) {
                List<SeatUnit> seatUnits = list.stream().filter(e -> e instanceof java.util.Map).map(e -> {
                    var m = (java.util.Map<String, Object>) e;
                    int row = Integer.parseInt(m.get("row").toString());
                    int col = Integer.parseInt(m.get("col").toString());
                    SeatStateEnum state = SeatStateEnum.valueOf(m.get("state").toString());
                    String label = (String) m.getOrDefault("label", generateSeatLabel(row, col));
                    return new SeatUnit(row, col, state, label);
                }).collect(Collectors.toCollection(java.util.ArrayList::new));
                trip.setSeats(seatUnits);
                trip.setAvailableSeats((int) seatUnits.stream().filter(seat -> seat.getState() == SeatStateEnum.AVAILABLE).count());
            }
        }

        TripType saved = tripTypeRepository.save(trip);
        return ResponseEntity.ok(buildTripResponse(saved));
    }

    @PutMapping(path = "/{id}/seats", consumes = org.springframework.http.MediaType.APPLICATION_JSON_VALUE,
            produces = org.springframework.http.MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> updateSeats(
            @PathVariable String id,
            @Valid @RequestBody UpdateSeatsRequest request) {
        TripType trip = tripTypeRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip not found"));

        if (request.seats().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Seats payload cannot be empty");
        }

        List<SeatUnit> current = trip.getSeats();
        if (current == null || current.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No seats initialized for this trip. Generate seats first.");
        }

        java.util.Map<String, SeatUnit> byLabel = new java.util.HashMap<>();
        java.util.Map<String, SeatUnit> byPos = new java.util.HashMap<>();
        for (SeatUnit s : current) {
            if (s.getLabel() != null && !s.getLabel().isBlank()) {
                byLabel.put(s.getLabel(), s);
            }
            byPos.put(s.getRow() + "-" + s.getCol(), s);
        }

        List<Map<String, Object>> notFound = new ArrayList<>();

        for (SeatUnit reqSeat : request.seats()) {
            SeatUnit target = null;
            if (reqSeat.getLabel() != null && !reqSeat.getLabel().isBlank()) {
                target = byLabel.get(reqSeat.getLabel());
            }
            if (target == null) {
                String key = reqSeat.getRow() + "-" + reqSeat.getCol();
                target = byPos.get(key);
            }

            if (target == null) {
                Map<String, Object> miss = new LinkedHashMap<>();
                miss.put("label", reqSeat.getLabel());
                miss.put("row", reqSeat.getRow());
                miss.put("col", reqSeat.getCol());
                notFound.add(miss);
            } else {
                target.setState(reqSeat.getState());
            }
        }

        if (!notFound.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Some seats do not exist: " + notFound);
        }

        trip.setAvailableSeats((int) current.stream().filter(seat -> seat.getState() == SeatStateEnum.AVAILABLE).count());

        TripType saved = tripTypeRepository.save(trip);
        return ResponseEntity.ok(buildTripResponse(saved));
    }

    @PostMapping(path = "/{id}/seats/generate", consumes = org.springframework.http.MediaType.APPLICATION_JSON_VALUE,
            produces = org.springframework.http.MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> generateSeats(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, Integer> body) {
        TripType trip = tripTypeRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip not found"));

        int rows = 10;
        int cols = 4;
        int lastRowSeats = 5;

        if (body != null) {
            Integer rowsVal = body.get("rows");
            if (rowsVal != null && rowsVal > 0) {
                rows = rowsVal;
            }
            Integer colsVal = body.get("cols");
            if (colsVal != null && colsVal > 0) {
                cols = colsVal;
            }
            Integer backVal = body.get("lastRowSeats");
            if (backVal != null && backVal > 0) {
                lastRowSeats = backVal;
            }
        }

        List<SeatUnit> seats = new ArrayList<>();
        for (int r = 1; r <= rows; r++) {
            for (int c = 1; c <= cols; c++) {
                String label = generateSeatLabel(r, c);
                seats.add(new SeatUnit(r, c, SeatStateEnum.AVAILABLE, label));
            }
        }
        int backRowIndex = rows + 1;
        for (int c = 1; c <= lastRowSeats; c++) {
            String label = generateSeatLabel(backRowIndex, c);
            seats.add(new SeatUnit(backRowIndex, c, SeatStateEnum.AVAILABLE, label));
        }
        trip.setSeats(seats);
        trip.setAvailableSeats((int) seats.stream().filter(s -> s.getState() == SeatStateEnum.AVAILABLE).count());

        TripType saved = tripTypeRepository.save(trip);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Seats generated successfully");
        response.put("seats", saved.getSeats());
        response.put("availableSeats", saved.getAvailableSeats());
        return ResponseEntity.ok(response);
    }

    private Map<String, Object> buildTripResponse(TripType trip) {
        AgencyType agency = trip.getAgencyId() != null ? agencyRepository.findById(trip.getAgencyId()).orElse(null) : null;
        var origin = trip.getOriginId() != null ? placeRepository.findById(trip.getOriginId()).orElse(null) : null;
        var destination = trip.getDestinationId() != null ? placeRepository.findById(trip.getDestinationId()).orElse(null) : null;

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", trip.getId());
        response.put("version", trip.getVersion());
        response.put("agency", agency != null ? Map.of("id", agency.getId(), "name", agency.getName()) : null);
        response.put("originId", trip.getOriginId());
        response.put("destinationId", trip.getDestinationId());
        response.put("origin", origin);
        response.put("destination", destination);
        response.put("stops", trip.getStops());
        response.put(
                "departureDate",
                trip.getDepartureDate() == null
                ? null
                : trip.getDepartureDate().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
        );
        response.put("availableSeats", trip.getAvailableSeats());
        response.put("seats", trip.getSeats());
        response.put("totalPrice", trip.getTotalPrice());
        response.put("status", trip.getStatus());
        response.put("createdAt", trip.getCreatedAt() != null ? trip.getCreatedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME) : null);
        response.put("updatedAt", trip.getUpdatedAt() != null ? trip.getUpdatedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME) : null);
        return response;
    }

    private String generateSeatLabel(int row, int col) {
        StringBuilder sb = new StringBuilder();
        int r = row;
        while (r > 0) {
            r--;
            sb.insert(0, (char) ('A' + (r % 26)));
            r /= 26;
        }
        return sb.toString() + col;
    }

    public record UpdateSeatsRequest(
            @NotNull(message = "seats is required")
            @NotEmpty(message = "seats cannot be empty")
            List<@Valid SeatUnit> seats
            ) {

    }

    @Operation(summary = "Delete a trip by id", responses = {
        @ApiResponse(responseCode = "200", description = "Trip deleted successfully"),
        @ApiResponse(responseCode = "404", description = "Trip not found")
    })
    @org.springframework.web.bind.annotation.DeleteMapping("/delete/{id}")
    public ResponseEntity<?> deleteTrip(@PathVariable String id) {
        if (!tripTypeRepository.existsById(id)) {
            return ResponseEntity.status(404).body(Map.of("error", "Trip not found"));
        }
        tripTypeRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Trip deleted successfully", "id", id));
    }
}
