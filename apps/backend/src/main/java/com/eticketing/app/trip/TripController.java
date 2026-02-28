package com.eticketing.app.trip;

import com.eticketing.app.common.TargetInput;
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

import com.eticketing.app.country.CountryRepository;
import com.eticketing.app.country.CountryType;
import com.eticketing.app.place.PlaceRepository;
import com.eticketing.app.place.PlaceType;
import com.eticketing.app.subplace.SubPlaceRepository;
import com.eticketing.app.subplace.SubPlaceType;
import com.eticketing.app.state.StateRepository;
import com.eticketing.app.state.StateType;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.format.DateTimeFormatter;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.Instant;

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
    private final PlaceRepository placeRepository;
    private final SubPlaceRepository subPlaceRepository;
    private final StateRepository stateRepository;
    private final CountryRepository countryRepository;
    private final org.springframework.data.mongodb.core.MongoTemplate mongoTemplate;

    public TripController(
            TripTypeRepository tripTypeRepository,
            PlaceRepository placeRepository,
            SubPlaceRepository subPlaceRepository,
            StateRepository stateRepository,
            CountryRepository countryRepository,
            org.springframework.data.mongodb.core.MongoTemplate mongoTemplate
    ) {
        this.tripTypeRepository = tripTypeRepository;
        this.placeRepository = placeRepository;
        this.subPlaceRepository = subPlaceRepository;
        this.stateRepository = stateRepository;
        this.countryRepository = countryRepository;
        this.mongoTemplate = mongoTemplate;
    }

    private com.eticketing.app.place.LonLatType resolveCityLocation(String cityId) {
        if (cityId == null || cityId.isBlank()) {
            return null;
        }

        List<SubPlaceType> list = subPlaceRepository.findByParentId(cityId);
        if (list == null || list.isEmpty()) {
            return null;
        }

        for (SubPlaceType sp : list) {
            if (sp.getLocation() != null) {
                return sp.getLocation();
            }
        }
        return null;
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
        // Handle target (new multi-tenant model)
        if (payload.target() != null && payload.target().getPos() != null) {
            toSave.setTarget(payload.target());
        }
        toSave.setOriginId(payload.originId());
        toSave.setDestinationId(payload.destinationId());
        toSave.setTotalPrice(payload.totalPrice());

        // Capacity is admin-entered. Available seats starts equal to total places.
        if (payload.totalPlaces() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "totalPlaces must be >= 0");
        }
        toSave.setTotalPlaces(payload.totalPlaces());
        toSave.setAvailableSeats(payload.totalPlaces());

        // Process stops: simple StopType with placeId, rank, fare
        List<StopType> stopsList = new ArrayList<>();
        if (payload.stops() != null && !payload.stops().isEmpty()) {
            for (int i = 0; i < payload.stops().size(); i++) {
                StopInput si = payload.stops().get(i);
                if (si.placeId() == null || si.placeId().isBlank()) {
                    continue;
                }
                StopType stop = new StopType();
                stop.setPlaceId(si.placeId());
                stop.setRank(si.rank() != null ? si.rank() : i);
                stop.setFare(si.fare() != null ? si.fare() : BigDecimal.ZERO);
                stopsList.add(stop);
            }
        }
        // Sort by rank
        stopsList.sort(Comparator.comparing(s -> s.getRank() == null ? Integer.MAX_VALUE : s.getRank()));
        toSave.setStops(stopsList);

        // Process pickup points (selected sub-places with per-trip scheduled times)
        List<TripSubPlaceType> pickupPointsList = new ArrayList<>();
        if (payload.pickupPoints() != null) {
            for (SubPlaceInput spi : payload.pickupPoints()) {
                if (spi.subPlaceId() == null || spi.subPlaceId().isBlank()) continue;
                TripSubPlaceType pp = new TripSubPlaceType();
                pp.setSubPlaceId(spi.subPlaceId());
                if (spi.scheduledTime() != null) {
                    pp.setScheduledTime(spi.scheduledTime().withOffsetSameInstant(ZoneOffset.UTC));
                }
                pickupPointsList.add(pp);
            }
        }
        toSave.setPickupPoints(pickupPointsList);

        if (payload.departureDate() != null) {
            toSave.setDepartureDate(payload.departureDate().withOffsetSameInstant(ZoneOffset.UTC));
        }
        toSave.setStatus(payload.status() == null ? TripStatusEnum.SCHEDULED : payload.status());

        // Server-managed timestamps
        Instant now = Instant.now();
        toSave.setCreatedAt(now);
        toSave.setUpdatedAt(now);

        TripType saved = tripTypeRepository.save(toSave);
        // Create response: include createdAt only
        return ResponseEntity.ok(buildTripResponse(saved));
    }

    // DTO for create-trip
    /**
     * CreateTripRequest DTO.
     *
     * @param target Target containing POS ID for multi-tenant scoping
     */
    public record CreateTripRequest(
            TargetInput target,
            @NotNull String originId,
            @NotNull String destinationId,
            @NotNull BigDecimal totalPrice,
            List<StopInput> stops,
            List<SubPlaceInput> pickupPoints,
            OffsetDateTime departureDate,
            int totalPlaces,
            TripStatusEnum status
            ) {

    }

    public record StopInput(
            @NotNull String placeId,
            Integer rank,
            BigDecimal fare
            ) {

    }

    public record SubPlaceInput(
            @NotNull String subPlaceId,
            OffsetDateTime scheduledTime
            ) {

    }

    @Operation(
            summary = "Get trips by POS (terminal-scoped)",
            description = "Returns trips scoped to a specific Point of Sale. Used by terminal app.",
            parameters = {
                @Parameter(name = "posId", description = "Point of Sale ID", required = true),
                @Parameter(name = "date", description = "Filter by departure date (yyyy-MM-dd)", example = "2025-11-01"),
                @Parameter(name = "page", description = "Page index (0-based)", example = "0"),
                @Parameter(name = "limit", description = "Page size", example = "10")
            },
            responses = {
                @ApiResponse(responseCode = "200", description = "Trips found"),
                @ApiResponse(responseCode = "400", description = "Invalid parameters")
            }
    )
    @GetMapping("/by-target/{posId}")
    public ResponseEntity<PaginateResponseType<Map<String, Object>>> getTripsByPos(
            @PathVariable String posId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int limit) {
        if (posId == null || posId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "posId is required");
        }
        if (page < 0) {
            page = 0;
        }
        if (limit < 1 || limit > 100) {
            limit = 10;
        }
        Pageable pageable = PageRequest.of(page, limit, Sort.by(Sort.Direction.ASC, "departureDate"));

        org.springframework.data.domain.Page<TripType> result;
        if (date != null) {
            var start = date.atStartOfDay().atOffset(ZoneOffset.UTC);
            var end = date.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC);
            result = tripTypeRepository.findByTargetPosAndDateRange(posId, start, end, pageable);
        } else {
            result = tripTypeRepository.findByTargetPos(posId, pageable);
        }

        List<Map<String, Object>> tripsView = result.getContent().stream().map(t -> buildTripResponse(t)).toList();
        return ResponseEntity.ok(new PaginateResponseType<>(tripsView, result.getTotalElements(), result.isLast()));
    }

    @Operation(
            summary = "Search trips with filters and pagination",
            parameters = {
                @Parameter(name = "originId", description = "Origin place ID"),
                @Parameter(name = "destinationId", description = "Destination place ID"),
                @Parameter(name = "date", description = "Departure date (yyyy-MM-dd)", example = "2025-11-01"),
                @Parameter(name = "posId", description = "POS ID for filtering"),
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
            @RequestParam(required = false) String posId,
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
            q.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("originId").is(originId));
        }
        if (destinationId != null && !destinationId.isBlank()) {
            // Match destination or any stop with this placeId
            var cDest = org.springframework.data.mongodb.core.query.Criteria.where("destinationId").is(destinationId);
            var cStops = org.springframework.data.mongodb.core.query.Criteria.where("stops.placeId").is(destinationId);
            q.addCriteria(new org.springframework.data.mongodb.core.query.Criteria().orOperator(cDest, cStops));
        }
        if (date != null) {
            // Match trips on the given date (comparing date part of departureDate)
            var start = date.atStartOfDay().atOffset(ZoneOffset.UTC);
            var end = date.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC);
            q.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("departureDate").gte(start).lt(end));
        }
        if (posId != null && !posId.isBlank()) {
            q.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("target.pos").is(posId));
        }
        q.with(pageable);

        List<TripType> found = mongoTemplate.find(q, TripType.class);
        long count = mongoTemplate.count(q.skip(-1).limit(-1), TripType.class);

        List<Map<String, Object>> tripsView = found.stream().map(t -> buildTripResponse(t)).toList();
        boolean isLast = (page * limit + found.size()) >= count;
        return ResponseEntity.ok(new PaginateResponseType<>(tripsView, count, isLast));
    }

    @PostMapping(path = "/update/{id}", consumes = org.springframework.http.MediaType.APPLICATION_JSON_VALUE, produces = org.springframework.http.MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> updateTrip(
            @PathVariable String id,
            @RequestBody Map<String, Object> updates) {
        TripType trip = tripTypeRepository.findById(id).orElseThrow(() -> new RuntimeException("Trip not found"));

        // Prevent clients from setting server-managed timestamps
        if (updates.containsKey("createdAt") || updates.containsKey("updatedAt")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "createdAt/updatedAt are server-managed and must not be provided");
        }

        // Handle target (new multi-tenant model)
        if (updates.containsKey("target") && updates.get("target") != null) {
            Object targetObj = updates.get("target");
            if (targetObj instanceof Map targetMap) {
                TargetInput target = new TargetInput();
                if (targetMap.get("pos") != null) {
                    target.setPos(targetMap.get("pos").toString());
                }
                trip.setTarget(target);
            }
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
                List<StopType> stopsList = new ArrayList<>();
                for (int i = 0; i < list.size(); i++) {
                    Object raw = list.get(i);
                    if (raw instanceof Map m) {
                        String placeId = m.get("placeId") != null ? m.get("placeId").toString() : null;
                        if (placeId == null || placeId.isBlank()) {
                            continue;
                        }

                        StopType stop = new StopType();
                        stop.setPlaceId(placeId);

                        Object rankObj = m.get("rank");
                        Integer rank = i;
                        if (rankObj instanceof Number n) {
                            rank = n.intValue();
                        }
                        stop.setRank(rank);

                        Object fareObj = m.get("fare");
                        BigDecimal fare = BigDecimal.ZERO;
                        if (fareObj instanceof Number n) {
                            fare = BigDecimal.valueOf(n.doubleValue());
                        } else if (fareObj instanceof String s) {
                            fare = new BigDecimal(s);
                        }
                        stop.setFare(fare);

                        stopsList.add(stop);
                    }
                }
                stopsList.sort(Comparator.comparing(s -> s.getRank() == null ? Integer.MAX_VALUE : s.getRank()));
                trip.setStops(stopsList);
            }
        }

        // Handle pickupPoints (selected sub-places with per-trip scheduled times)
        if (updates.containsKey("pickupPoints") && updates.get("pickupPoints") != null) {
            Object val = updates.get("pickupPoints");
            if (val instanceof List<?> list) {
                List<TripSubPlaceType> ppList = new ArrayList<>();
                for (Object raw : list) {
                    if (raw instanceof Map m) {
                        String spId = m.get("subPlaceId") != null ? m.get("subPlaceId").toString() : null;
                        if (spId == null || spId.isBlank()) continue;
                        TripSubPlaceType pp = new TripSubPlaceType();
                        pp.setSubPlaceId(spId);
                        Object stObj = m.get("scheduledTime");
                        if (stObj != null) {
                            var dt = OffsetDateTime.parse(stObj.toString());
                            pp.setScheduledTime(dt.withOffsetSameInstant(ZoneOffset.UTC));
                        }
                        ppList.add(pp);
                    }
                }
                trip.setPickupPoints(ppList);
            }
        }

        if (updates.containsKey("departureDate") && updates.get("departureDate") != null) {
            String dateStr = updates.get("departureDate").toString();
            var dt = java.time.OffsetDateTime.parse(dateStr);
            trip.setDepartureDate(dt.withOffsetSameInstant(ZoneOffset.UTC));
        }

        // Capacity update: totalPlaces is editable by admin; availableSeats is derived and NOT directly editable.
        if (updates.containsKey("totalPlaces") && updates.get("totalPlaces") != null) {
            int newTotal;
            Object val = updates.get("totalPlaces");
            if (val instanceof Number n) {
                newTotal = n.intValue();
            } else {
                newTotal = Integer.parseInt(val.toString());
            }
            if (newTotal < 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "totalPlaces must be >= 0");
            }

            List<SeatUnit> seats = trip.getSeats();
            if (seats != null && !seats.isEmpty()) {
                // Keep capacity consistent with the seat map.
                if (newTotal != seats.size()) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "totalPlaces must match the seat map size (" + seats.size() + ")"
                    );
                }
                long reserved = seats.stream().filter(s -> s.getState() != SeatStateEnum.AVAILABLE).count();
                if (newTotal < reserved) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "totalPlaces cannot be less than currently reserved/blocked seats (" + reserved + ")"
                    );
                }
                trip.setTotalPlaces(newTotal);
                trip.setAvailableSeats((int) (newTotal - reserved));
            } else {
                int oldTotal = trip.getTotalPlaces();
                int oldAvailable = trip.getAvailableSeats();
                int reserved = Math.max(0, oldTotal - oldAvailable);
                trip.setTotalPlaces(newTotal);
                trip.setAvailableSeats(Math.max(0, newTotal - reserved));
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

        // Server-managed timestamps
        Instant now = Instant.now();
        if (trip.getCreatedAt() == null) {
            trip.setCreatedAt(now);
        }
        trip.setUpdatedAt(now);

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

        // Server-managed timestamps
        Instant now = Instant.now();
        if (trip.getCreatedAt() == null) {
            trip.setCreatedAt(now);
        }
        trip.setUpdatedAt(now);

        TripType saved = tripTypeRepository.save(trip);
        return ResponseEntity.ok(buildTripResponse(saved));
    }

    @PostMapping(path = "/{id}/seats/generate", consumes = org.springframework.http.MediaType.APPLICATION_JSON_VALUE,
            produces = org.springframework.http.MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> generateSeats(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, Integer> body) {
        TripType trip = tripTypeRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip not found"));

        if (trip.getTotalPlaces() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "totalPlaces must be set before generating seats");
        }

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

        if (seats.size() != trip.getTotalPlaces()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Generated seat count (" + seats.size() + ") does not match totalPlaces (" + trip.getTotalPlaces() + ")"
            );
        }
        trip.setSeats(seats);
        trip.setAvailableSeats((int) seats.stream().filter(s -> s.getState() == SeatStateEnum.AVAILABLE).count());

        // Server-managed timestamps
        Instant now = Instant.now();
        if (trip.getCreatedAt() == null) {
            trip.setCreatedAt(now);
        }
        trip.setUpdatedAt(now);

        TripType saved = tripTypeRepository.save(trip);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Seats generated successfully");
        response.put("seats", saved.getSeats());
        response.put("availableSeats", saved.getAvailableSeats());
        response.put("updatedAt", saved.getUpdatedAt() != null
                ? DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(saved.getUpdatedAt().atOffset(ZoneOffset.UTC))
                : null);
        return ResponseEntity.ok(response);
    }

    private Map<String, Object> buildTripResponse(TripType trip) {
        PlaceType origin = trip.getOriginId() != null ? placeRepository.findById(trip.getOriginId()).orElse(null) : null;
        PlaceType destination = trip.getDestinationId() != null ? placeRepository.findById(trip.getDestinationId()).orElse(null) : null;

        // Expand stops with place details
        List<Map<String, Object>> expandedStops = new ArrayList<>();
        if (trip.getStops() != null) {
            for (StopType stop : trip.getStops()) {
                Map<String, Object> stopMap = new LinkedHashMap<>();
                stopMap.put("placeId", stop.getPlaceId());
                stopMap.put("rank", stop.getRank());
                stopMap.put("fare", stop.getFare());
                PlaceType place = stop.getPlaceId() != null ? placeRepository.findById(stop.getPlaceId()).orElse(null) : null;
                stopMap.put("place", buildPlaceView(place, true));
                expandedStops.add(stopMap);
            }
        }

        // Expand pickupPoints with sub-place details
        List<Map<String, Object>> expandedPickupPoints = new ArrayList<>();
        if (trip.getPickupPoints() != null) {
            for (TripSubPlaceType pp : trip.getPickupPoints()) {
                Map<String, Object> ppMap = new LinkedHashMap<>();
                ppMap.put("subPlaceId", pp.getSubPlaceId());
                ppMap.put("scheduledTime", pp.getScheduledTime() == null
                        ? null : pp.getScheduledTime().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));
                SubPlaceType sp = pp.getSubPlaceId() != null
                        ? subPlaceRepository.findById(pp.getSubPlaceId()).orElse(null) : null;
                if (sp != null) {
                    ppMap.put("address", sp.getAddress());
                    ppMap.put("location", sp.getLocation());
                    ppMap.put("pickupInstructions", sp.getPickupInstructions());
                    ppMap.put("parentId", sp.getParentId());
                } else {
                    ppMap.put("address", null);
                    ppMap.put("location", null);
                    ppMap.put("pickupInstructions", null);
                    ppMap.put("parentId", null);
                }
                expandedPickupPoints.add(ppMap);
            }
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", trip.getId());
        response.put("version", trip.getVersion());
        response.put("target", trip.getTarget() != null ? Map.of("pos", trip.getTarget().getPos()) : null);
        response.put("originId", trip.getOriginId());
        response.put("destinationId", trip.getDestinationId());
        response.put("origin", buildPlaceView(origin, true));
        response.put("destination", buildPlaceView(destination, true));
        response.put("stops", expandedStops);
        response.put("pickupPoints", expandedPickupPoints);
        response.put(
                "departureDate",
                trip.getDepartureDate() == null
                ? null
                : trip.getDepartureDate().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
        );
        response.put("availableSeats", trip.getAvailableSeats());
        response.put("totalPlaces", trip.getTotalPlaces());
        response.put("seats", trip.getSeats());
        response.put("totalPrice", trip.getTotalPrice());
        response.put("status", trip.getStatus());
        response.put("createdAt", trip.getCreatedAt() != null
                ? DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(trip.getCreatedAt().atOffset(ZoneOffset.UTC))
                : null);
        response.put("updatedAt", trip.getUpdatedAt() != null
                ? DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(trip.getUpdatedAt().atOffset(ZoneOffset.UTC))
                : null);
        return response;
    }

    /**
     * Build a place view with state, country, and sub-places (if includePlaces
     * is true).
     */
    private Map<String, Object> buildPlaceView(PlaceType place, boolean includePlaces) {
        if (place == null) {
            return null;
        }

        StateType state = place.getStateId() != null ? stateRepository.findById(place.getStateId()).orElse(null) : null;
        CountryType country = place.getCountryId() != null ? countryRepository.findById(place.getCountryId()).orElse(null) : null;

        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", place.getId());
        view.put("city", place.getCity());
        view.put("location", resolveCityLocation(place.getId()));

        // State object
        if (state != null) {
            Map<String, Object> stateView = new LinkedHashMap<>();
            stateView.put("id", state.getId());
            stateView.put("name", state.getName());
            stateView.put("code", state.getCode());
            stateView.put("countryId", state.getCountryId());
            view.put("state", stateView);
        } else {
            view.put("state", null);
        }

        // Country object
        if (country != null) {
            Map<String, Object> countryView = new LinkedHashMap<>();
            countryView.put("id", country.getId());
            countryView.put("name", country.getName());
            countryView.put("code", country.getCode());
            countryView.put("flag", country.getFlag());
            view.put("country", countryView);
        } else {
            view.put("country", null);
        }

        // Sub-places (pickup/dropoff points) - only for CITY places
        if (includePlaces && place.getKind() == PlaceType.PlaceKind.CITY) {
            List<SubPlaceType> subPlaces = subPlaceRepository.findByParentId(place.getId());
            List<Map<String, Object>> placesView = subPlaces.stream().map(sp -> {
                Map<String, Object> spView = new LinkedHashMap<>();
                spView.put("id", sp.getId());
                spView.put("address", sp.getAddress());
                spView.put("location", sp.getLocation());
                spView.put("pickupInstructions", sp.getPickupInstructions());
                return spView;
            }).toList();
            view.put("places", placesView);
        }

        return view;
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
