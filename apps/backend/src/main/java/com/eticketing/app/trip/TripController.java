package com.eticketing.app.trip;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

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
import com.eticketing.app.place.PlaceDocument;

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
    private final org.springframework.data.mongodb.core.MongoTemplate mongoTemplate;

    public TripController(
            TripTypeRepository tripTypeRepository,
            AgencyRepository agencyRepository,
            PlaceRepository placeRepository,
            org.springframework.data.mongodb.core.MongoTemplate mongoTemplate
    ) {
        this.tripTypeRepository = tripTypeRepository;
        this.agencyRepository = agencyRepository;
        this.placeRepository = placeRepository;
        this.mongoTemplate = mongoTemplate;
    }

    @PostMapping(path = "/create", consumes = org.springframework.http.MediaType.APPLICATION_JSON_VALUE,
            produces = org.springframework.http.MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> createTrip(@Valid @RequestBody CreateTripRequest payload) {
        // Map request with full datetime to domain entity (stores date part)
        TripType toSave = new TripType();
        toSave.setAgencyId(payload.agencyId());
        toSave.setOriginId(payload.originId());
        toSave.setDestinationId(payload.destinationId());
        if (payload.departureDate() != null) {
            // Persist both date-only (for indexing/filter) and full datetime (for accurate responses)
            toSave.setDepartureDate(payload.departureDate().toLocalDate());
            toSave.setDepartureDateTime(payload.departureDate().withOffsetSameInstant(ZoneOffset.UTC));
        }
        toSave.setPrice(payload.price());
        toSave.setAvailableSeats(payload.availableSeats());
        toSave.setStatus(payload.status() == null ? TripStatusEnum.SCHEDULED : payload.status());

        TripType saved = tripTypeRepository.save(toSave);
        // Fetch referenced objects
        AgencyType agency = null;
        if (saved.getAgencyId() != null) {
            agency = agencyRepository.findById(saved.getAgencyId()).orElse(null);
        }
        PlaceDocument origin = null;
        if (saved.getOriginId() != null) {
            origin = placeRepository.findById(saved.getOriginId()).orElse(null);
        }
        PlaceDocument destination = null;
        if (saved.getDestinationId() != null) {
            destination = placeRepository.findById(saved.getDestinationId()).orElse(null);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", saved.getId());
        response.put("version", saved.getVersion());
        response.put("agency", agency);
        response.put("origin", origin);
        response.put("destination", destination);
        // Echo back full datetime from request
        response.put(
                "departureDate",
                payload.departureDate() == null ? null : payload.departureDate().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
        );
        response.put("price", saved.getPrice());
        response.put("availableSeats", saved.getAvailableSeats());
        response.put("status", saved.getStatus());
        return ResponseEntity.ok(response);
    }

    // DTO for create-trip with full datetime
    public record CreateTripRequest(
            String agencyId,
            String originId,
            String destinationId,
            OffsetDateTime departureDate,
            java.math.BigDecimal price,
            int availableSeats,
            TripStatusEnum status
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

        // Use TripFilterInput for clean filter handling
        TripFilterInput filter = new TripFilterInput(originId, destinationId, date, agencyId);

        // Build dynamic query
        var q = new org.springframework.data.mongodb.core.query.Query();
        if (filter.originId() != null && !filter.originId().isBlank()) {
            q.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("originId").is(filter.originId()));
        }
        if (filter.destinationId() != null && !filter.destinationId().isBlank()) {
            q.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("destinationId").is(filter.destinationId()));
        }
        if (filter.date() != null) {
            q.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("departureDate").is(filter.date()));
        }
        if (filter.agencyId() != null && !filter.agencyId().isBlank()) {
            q.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("agencyId").is(filter.agencyId()));
        }
        q.with(pageable);

        List<TripType> found = mongoTemplate.find(q, TripType.class);
        long count = mongoTemplate.count(q.skip(-1).limit(-1), TripType.class);

        // Map to view objects
        List<Map<String, Object>> tripsView = found.stream().map(trip -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", trip.getId());
            map.put("version", trip.getVersion());
            // Expand foreign keys to full objects
            map.put("agency", trip.getAgencyId() != null ? agencyRepository.findById(trip.getAgencyId()).orElse(null) : null);
            map.put("origin", trip.getOriginId() != null ? placeRepository.findById(trip.getOriginId()).orElse(null) : null);
            map.put("destination", trip.getDestinationId() != null ? placeRepository.findById(trip.getDestinationId()).orElse(null) : null);
            map.put(
                    "departureDate",
                    trip.getDepartureDateTime() != null
                    ? trip.getDepartureDateTime().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
                    : (trip.getDepartureDate() == null
                    ? null
                    : trip.getDepartureDate().atStartOfDay().atOffset(ZoneOffset.UTC).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME))
            );
            map.put("price", trip.getPrice());
            map.put("availableSeats", trip.getAvailableSeats());
            map.put("seats", trip.getSeats());
            map.put("status", trip.getStatus());
            return map;
        }).toList();
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
            ) {

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
        if (updates.containsKey("departureDate") && updates.get("departureDate") != null) {
            String dateStr = updates.get("departureDate").toString();
            System.out.println("DEBUG: Updating departureDate with value: " + dateStr);
            // Accept ISO 8601 with or without time
            if (dateStr.length() > 10) { // has time component
                System.out.println("DEBUG: Detected time component in departureDate: " + 11);
                var dt = java.time.OffsetDateTime.parse(dateStr);
                trip.setDepartureDate(dt.toLocalDate());
                trip.setDepartureDateTime(dt.withOffsetSameInstant(ZoneOffset.UTC));
            } else { // only date
                System.out.println("DEBUG: Detected time component in departureDate: " + 22);
                var date = java.time.LocalDate.parse(dateStr);
                trip.setDepartureDate(date);
                trip.setDepartureDateTime(date.atStartOfDay().atOffset(ZoneOffset.UTC));
            }
        }
        if (updates.containsKey("price")) {
            Object val = updates.get("price");
            if (val instanceof Number n) {
                trip.setPrice(java.math.BigDecimal.valueOf(n.doubleValue()));
            } else if (val instanceof String s) {
                trip.setPrice(new java.math.BigDecimal(s));
            }
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
        // Optionally handle seats update if needed
        if (updates.containsKey("seats") && updates.get("seats") != null) {
            // Assume seats is a List<Map<String, Object>>
            Object val = updates.get("seats");
            if (val instanceof List<?> list) {
                List<com.eticketing.app.trip.SeatUnit> seatUnits = list.stream().filter(e -> e instanceof java.util.Map).map(e -> {
                    var m = (java.util.Map<String, Object>) e;
                    int row = Integer.parseInt(m.get("row").toString());
                    int col = Integer.parseInt(m.get("col").toString());
                    com.eticketing.app.trip.SeatStateEnum state = com.eticketing.app.trip.SeatStateEnum.valueOf(m.get("state").toString());
                    String label = (String) m.getOrDefault("label", generateSeatLabel(row, col));
                    return new com.eticketing.app.trip.SeatUnit(row, col, state, label);
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

        // Ensure seats are initialized
        List<SeatUnit> current = trip.getSeats();
        if (current == null || current.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No seats initialized for this trip. Generate seats first.");
        }

        // Build lookup maps for existing seats: by label and by position (row-col)
        java.util.Map<String, SeatUnit> byLabel = new java.util.HashMap<>();
        java.util.Map<String, SeatUnit> byPos = new java.util.HashMap<>();
        for (SeatUnit s : current) {
            if (s.getLabel() != null && !s.getLabel().isBlank()) {
                byLabel.put(s.getLabel(), s);
            }
            byPos.put(s.getRow() + "-" + s.getCol(), s);
        }

        // Track not-found seats to fail fast
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
                // collect missing seat info
                Map<String, Object> miss = new LinkedHashMap<>();
                miss.put("label", reqSeat.getLabel());
                miss.put("row", reqSeat.getRow());
                miss.put("col", reqSeat.getCol());
                notFound.add(miss);
            } else {
                // Update only state; keep label/row/col intact
                target.setState(reqSeat.getState());
            }
        }

        if (!notFound.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Some seats do not exist: " + notFound);
        }

        // Recompute available seats
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
            if (rowsVal != null) {
                int val = rowsVal;
                if (val > 0) {
                    rows = val;
                }
            }
            Integer colsVal = body.get("cols");
            if (colsVal != null) {
                int val = colsVal;
                if (val > 0) {
                    cols = val;
                }
            }
            Integer backVal = body.get("lastRowSeats");
            if (backVal != null) {
                int val = backVal;
                if (val > 0) {
                    lastRowSeats = val;
                }
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
        return ResponseEntity.ok(response);
    }

    private Map<String, Object> buildTripResponse(TripType trip) {
        AgencyType agency = trip.getAgencyId() != null ? agencyRepository.findById(trip.getAgencyId()).orElse(null) : null;
        PlaceDocument origin = trip.getOriginId() != null ? placeRepository.findById(trip.getOriginId()).orElse(null) : null;
        PlaceDocument destination = trip.getDestinationId() != null ? placeRepository.findById(trip.getDestinationId()).orElse(null) : null;

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", trip.getId());
        response.put("version", trip.getVersion());
        response.put("agency", agency);
        response.put("origin", origin);
        response.put("destination", destination);
        response.put(
                "departureDate",
                trip.getDepartureDateTime() == null
                ? (trip.getDepartureDate() == null ? null : trip.getDepartureDate().atStartOfDay().atOffset(ZoneOffset.UTC).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME))
                : trip.getDepartureDateTime().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
        );
        response.put("price", trip.getPrice());
        response.put("availableSeats", trip.getAvailableSeats());
        response.put("seats", trip.getSeats());
        response.put("status", trip.getStatus());
        return response;
    }

    private String generateSeatLabel(int row, int col) {
        // Rows become letters: 1->A, 2->B, ... 27->AA, etc.
        StringBuilder sb = new StringBuilder();
        int r = row;
        while (r > 0) {
            r--; // 0-index
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
