package com.eticketing.app.trip;

import com.eticketing.app.bus.BusRepository;
import com.eticketing.app.bus.BusService;
import com.eticketing.app.bus.BusType;
import com.eticketing.app.common.TargetInput;
import com.eticketing.app.currency.CurrencyRepository;
import com.eticketing.app.currency.CurrencyType;
import com.eticketing.app.place.PlaceRepository;
import com.eticketing.app.place.PlaceType;
import com.eticketing.app.ticket.TripCancellationHandler;
import com.eticketing.app.trip.dto.*;
import com.eticketing.app.web.error.ApiExceptions.BadRequestException;
import com.eticketing.app.web.error.ApiExceptions.ConflictException;
import com.eticketing.app.web.error.ApiExceptions.ForbiddenException;
import com.eticketing.app.web.error.ApiExceptions.NotFoundException;
import lombok.RequiredArgsConstructor;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Orchestrates all trip business logic: creation, update, read, delete, status
 * transitions, and sub-resource management.
 */
@Service
@RequiredArgsConstructor
public class TripService {

    private final TripTypeRepository tripRepository;
    private final BusService busService;
    private final BusRepository busRepository;
    private final CurrencyRepository currencyRepository;
    private final PlaceRepository placeRepository;
    private final MongoTemplate mongoTemplate;
    private final TripCancellationHandler tripCancellationHandler;

    // ════════════════════════════════════════════════════════════════════
    // CREATE
    // ════════════════════════════════════════════════════════════════════
    /**
     * Full creation pipeline per TRIP_SPEC: 1. Validate stops → 2. Validate bus
     * → 3. Bus lock check → 4. Generate segments → 5. Validate express fares →
     * 6. Validate pickup/dropoff → 7. Persist.
     */
    public TripType create(TripCreateRequest req, String companyId) {
        // ── 1. Build and validate stops ─────────────────────────────────
        List<StopType> stops = req.getStopSchedule().stream()
                .map(s -> StopType.builder()
                .placeId(s.getPlaceId())
                .sequence(s.getSequence())
                .arrivalTime(s.getArrivalTime())
                .departureTime(s.getDepartureTime())
                .boardingAllowed(s.getBoardingAllowed())
                .droppingAllowed(s.getDroppingAllowed())
                .build())
                .toList();
        StopValidator.validate(stops);

        // ── 2. Validate bus exists and belongs to company ───────────────
        BusType bus = busService.getById(req.getBus().getBusId());
        if (bus.getTarget() == null || !companyId.equals(bus.getTarget().getCompany())) {
            throw new ForbiddenException("Bus does not belong to company " + companyId);
        }
        CurrencyType currency = resolveCurrency(req.getCurrencyId());

        // ── 3. Bus lock check — not already in SCHEDULED/ACTIVE trip ────
        List<TripType> busTrips = tripRepository.findByBusBusIdAndStatusIn(
                bus.getId(),
                List.of(TripStatusEnum.SCHEDULED, TripStatusEnum.ACTIVE));
        if (!busTrips.isEmpty()) {
            throw new ConflictException(
                    "BUS_ALREADY_ASSIGNED: bus " + bus.getId()
                    + " is already assigned to a SCHEDULED or ACTIVE trip");
        }

        // ── 4. Auto-generate segments from stops ────────────────────────
        List<SegmentGenerator.SegmentInput> segInputs = req.getSegmentInputs().stream()
                .map(si -> new SegmentGenerator.SegmentInput(
                si.getBasePrice(),
                si.getMaxSeats(),
                si.getDistanceKm(),
                si.getDurationMinutesOverride()))
                .toList();
        List<SegmentType> segments = SegmentGenerator.generate(stops, segInputs, bus.getTotalSeats());

        // Validate maxSeats <= bus.totalSeats
        for (SegmentType seg : segments) {
            if (seg.getMaxSeats() > bus.getTotalSeats()) {
                throw new BadRequestException(
                        "MAX_SEATS_EXCEEDS_BUS: segment " + seg.getSequence()
                        + " maxSeats (" + seg.getMaxSeats()
                        + ") exceeds bus totalSeats (" + bus.getTotalSeats() + ")");
            }
        }

        // ── 5. Build and validate express fares ─────────────────────────
        List<ExpressFareType> expressFares = new ArrayList<>();
        if (req.getExpressFares() != null) {
            for (TripCreateRequest.ExpressFareInput efi : req.getExpressFares()) {
                List<String> segmentIds = efi.getSegmentIndices().stream()
                        .map(idx -> {
                            if (idx < 0 || idx >= segments.size()) {
                                throw new BadRequestException(
                                        "INVALID_EXPRESS_FARE_CHAIN: segmentIndex " + idx + " out of range");
                            }
                            return segments.get(idx).getSegmentId();
                        })
                        .toList();

                String fromPlaceId = segments.get(efi.getSegmentIndices().get(0)).getFromPlaceId();
                String toPlaceId = segments.get(efi.getSegmentIndices().get(efi.getSegmentIndices().size() - 1)).getToPlaceId();

                ExpressFareType fare = ExpressFareType.builder()
                        .expressId(UUID.randomUUID().toString())
                        .fromPlaceId(fromPlaceId)
                        .toPlaceId(toPlaceId)
                        .segmentsCovered(segmentIds)
                        .price(efi.getPrice())
                        .validFrom(efi.getValidFrom())
                        .validUntil(efi.getValidUntil())
                        .active(efi.getActive() != null ? efi.getActive() : true)
                        .build();

                ExpressFareValidator.validate(fare, segments);
                expressFares.add(fare);
            }
        }

        // ── 6. Build and validate pickup/dropoff points ─────────────────
        List<PickupPointType> pickupPoints = req.getPickupPoints().stream()
                .map(pp -> PickupPointType.builder()
                .pointId(UUID.randomUUID().toString())
                .placeId(pp.getPlaceId())
                .address(pp.getAddress())
                .scheduledDepartureTime(pp.getScheduledDepartureTime())
                .active(pp.getActive() != null ? pp.getActive() : true)
                .location(pp.getLocation() != null
                        ? GeoLocation.builder()
                                .latitude(pp.getLocation().getLatitude())
                                .longitude(pp.getLocation().getLongitude())
                                .build()
                        : null)
                .build())
                .toList();

        List<DropoffPointType> dropoffPoints = req.getDropoffPoints().stream()
                .map(dp -> DropoffPointType.builder()
                .pointId(UUID.randomUUID().toString())
                .placeId(dp.getPlaceId())
                .address(dp.getAddress())
                .scheduledArrivalTime(dp.getScheduledArrivalTime())
                .active(dp.getActive() != null ? dp.getActive() : true)
                .location(dp.getLocation() != null
                        ? GeoLocation.builder()
                                .latitude(dp.getLocation().getLatitude())
                                .longitude(dp.getLocation().getLongitude())
                                .build()
                        : null)
                .build())
                .toList();

        PickupDropoffValidator.validate(stops, pickupPoints, dropoffPoints);

        // ── 7. Build and persist trip ───────────────────────────────────
        TripType trip = TripType.builder()
                .target(new TargetInput(companyId, null))
                .departureDate(req.getDepartureDate())
                .timezone(req.getTimezone())
                .status(TripStatusEnum.SCHEDULED)
                .bus(TripBusRef.builder().busId(bus.getId()).build())
                .currency(TripCurrency.builder().currencyId(currency.getId()).build())
                .stopSchedule(stops)
                .pickupPoints(pickupPoints)
                .dropoffPoints(dropoffPoints)
                .segments(segments)
                .expressFares(expressFares)
                .build();

        return tripRepository.save(trip);
    }

    // ════════════════════════════════════════════════════════════════════
    // READ
    // ════════════════════════════════════════════════════════════════════
    public TripType getById(String tripId, String companyId) {
        TripType trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new NotFoundException("Trip not found: " + tripId));
        assertCompanyScope(trip, companyId);
        return trip;
    }

    public Page<TripType> list(
            String companyId,
            TripStatusEnum status,
            String sortBy,
            String order,
            int page,
            int limit) {
        Sort sort = buildSort(sortBy, order);
        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                Math.clamp(limit, 1, 100),
                sort);

        if (status != null) {
            return tripRepository.findByTargetCompanyAndStatus(companyId, status, pageable);
        }
        return tripRepository.findByTargetCompany(companyId, pageable);
    }

    public Page<TripType> search(String companyId, TripStatusEnum status, String searchTerm,
            String sortBy, String order,
            LocalDate date, String originPlaceId, String destinationPlaceId,
            int page, int limit) {
        Sort sort = buildSort(sortBy, order);
        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                Math.clamp(limit, 1, 100),
                sort);

        Query q = new Query();
        if (companyId != null && !companyId.isBlank()) {
            q.addCriteria(Criteria.where("target.company").is(companyId));
        }
        if (status != null) {
            q.addCriteria(Criteria.where("status").is(status.toValue()));
        }
        if (searchTerm != null && !searchTerm.isBlank()) {
            String trimmedSearchTerm = searchTerm.trim();
            Page<BusType> matchingBuses = (companyId != null && !companyId.isBlank())
                    ? busRepository.findByTargetCompanyAndNameLike(companyId, trimmedSearchTerm, PageRequest.of(0, 100))
                    : busRepository.findByNameLike(trimmedSearchTerm, PageRequest.of(0, 100));
            List<String> matchingBusIds = matchingBuses.getContent().stream()
                    .map(BusType::getId)
                    .toList();
            List<String> matchingPlaceIds = placeRepository
                    .findByCityIgnoreCaseContaining(trimmedSearchTerm, PageRequest.of(0, 100))
                    .getContent()
                    .stream()
                    .filter(place -> place.getKind() == null || place.getKind() == PlaceType.PlaceKind.CITY)
                    .map(PlaceType::getId)
                    .toList();

            List<Criteria> searchCriteria = new ArrayList<>();
            if (!matchingBusIds.isEmpty()) {
                searchCriteria.add(Criteria.where("bus.busId").in(matchingBusIds));
            }
            if (!matchingPlaceIds.isEmpty()) {
                searchCriteria.add(Criteria.where("stopSchedule.placeId").in(matchingPlaceIds));
            }

            if (searchCriteria.isEmpty()) {
                return new PageImpl<>(List.of(), pageable, 0);
            }

            q.addCriteria(new Criteria().orOperator(searchCriteria.toArray(Criteria[]::new)));
        }
        if (date != null) {
            Instant start = date.atStartOfDay().toInstant(ZoneOffset.UTC);
            Instant end = date.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
            q.addCriteria(Criteria.where("departureDate").gte(start).lt(end));
        }
        Criteria originCriteria = null;
        Criteria destCriteria = null;
        if (originPlaceId != null && !originPlaceId.isBlank()) {
            originCriteria = Criteria.where("stopSchedule")
                    .elemMatch(Criteria.where("placeId").is(originPlaceId)
                            .and("boardingAllowed").is(true));
        }
        if (destinationPlaceId != null && !destinationPlaceId.isBlank()) {
            destCriteria = Criteria.where("stopSchedule")
                    .elemMatch(Criteria.where("placeId").is(destinationPlaceId)
                            .and("droppingAllowed").is(true));
        }

        if (originCriteria != null && destCriteria != null) {
            q.addCriteria(new Criteria().andOperator(originCriteria, destCriteria));
        } else if (originCriteria != null) {
            q.addCriteria(originCriteria);
        } else if (destCriteria != null) {
            q.addCriteria(destCriteria);
        }
        long total = mongoTemplate.count(q, TripType.class);
        q.with(pageable);

        List<TripType> results = mongoTemplate.find(q, TripType.class);

        // Post-filter: ensure origin stop sequence < destination stop sequence
        if (originPlaceId != null && !originPlaceId.isBlank()
                && destinationPlaceId != null && !destinationPlaceId.isBlank()) {
            results = results.stream().filter(trip -> {
                int originSeq = trip.getStopSchedule().stream()
                        .filter(s -> s.getPlaceId().equals(originPlaceId) && s.isBoardingAllowed())
                        .mapToInt(StopType::getSequence)
                        .min().orElse(Integer.MAX_VALUE);
                int destSeq = trip.getStopSchedule().stream()
                        .filter(s -> s.getPlaceId().equals(destinationPlaceId) && s.isDroppingAllowed())
                        .mapToInt(StopType::getSequence)
                        .max().orElse(Integer.MIN_VALUE);
                return originSeq < destSeq;
            }).collect(Collectors.toList());
        }

        return new PageImpl<>(results, pageable, total);
    }

    private Sort buildSort(String sortBy, String order) {
        String property = switch (sortBy == null || sortBy.isBlank() ? "createdAt" : sortBy.trim()) {
            case "createdAt" ->
                "createdAt";
            case "departureDate" ->
                "departureDate";
            default ->
                throw new BadRequestException(
                        "INVALID_SORT_FIELD: sortBy must be one of [createdAt, departureDate]");
        };

        String normalizedOrder = order == null || order.isBlank()
                ? "desc"
                : order.trim().toLowerCase(Locale.ROOT);
        Sort.Direction direction = switch (normalizedOrder) {
            case "asc" ->
                Sort.Direction.ASC;
            case "desc" ->
                Sort.Direction.DESC;
            default ->
                throw new BadRequestException(
                        "INVALID_SORT_ORDER: order must be one of [asc, desc]");
        };

        return Sort.by(direction, property);
    }

    // ════════════════════════════════════════════════════════════════════
    // UPDATE
    // ════════════════════════════════════════════════════════════════════
    /**
     * Updates a trip applying TRIP_SPEC section 12 edit permission rules.
     */
    public TripType update(String tripId, TripUpdateRequest req, String companyId) {
        TripType trip = getById(tripId, companyId);

        // Resolve new bus totalSeats for capacity check
        Integer newBusTotalSeats = null;
        if (req.getBus() != null) {
            BusType newBus = busService.getById(req.getBus().getBusId());
            if (newBus.getTarget() == null || !companyId.equals(newBus.getTarget().getCompany())) {
                throw new ForbiddenException("Bus does not belong to company " + companyId);
            }
            newBusTotalSeats = newBus.getTotalSeats();
        }

        // ── Edit rules validation ───────────────────────────────────────
        TripEditRules.validate(trip, req, newBusTotalSeats);

        // ── Apply changes (null = no change) ────────────────────────────
        if (req.getDepartureDate() != null) {
            trip.setDepartureDate(req.getDepartureDate());
        }
        if (req.getTimezone() != null) {
            trip.setTimezone(req.getTimezone());
        }
        if (req.getCurrencyId() != null) {
            CurrencyType currency = resolveCurrency(req.getCurrencyId());
            trip.setCurrency(TripCurrency.builder().currencyId(currency.getId()).build());
        }
        // Bus reassignment
        if (req.getBus() != null) {
            // Check that new bus is not in another trip
            BusType newBus = busService.getById(req.getBus().getBusId());
            List<TripType> busTrips = tripRepository.findByBusBusIdAndStatusIn(
                    newBus.getId(),
                    List.of(TripStatusEnum.SCHEDULED, TripStatusEnum.ACTIVE));
            boolean onlyThisTrip = busTrips.stream().allMatch(t -> t.getId().equals(tripId));
            if (!onlyThisTrip) {
                throw new ConflictException("BUS_ALREADY_ASSIGNED: bus is assigned to another trip");
            }
            trip.setBus(TripBusRef.builder().busId(newBus.getId()).build());
        }

        // Stop schedule update (SCHEDULED only — stops are validated by TripEditRules)
        if (req.getStopSchedule() != null) {
            List<StopType> newStops = req.getStopSchedule().stream()
                    .map(s -> StopType.builder()
                    .placeId(s.getPlaceId())
                    .sequence(s.getSequence())
                    .arrivalTime(s.getArrivalTime())
                    .departureTime(s.getDepartureTime())
                    .boardingAllowed(s.getBoardingAllowed())
                    .droppingAllowed(s.getDroppingAllowed())
                    .build())
                    .toList();
            StopValidator.validate(newStops);
            trip.setStopSchedule(newStops);
        }

        // Pickup/Dropoff (always allowed)
        if (req.getPickupPoints() != null) {
            List<PickupPointType> pickups = req.getPickupPoints().stream()
                    .map(pp -> PickupPointType.builder()
                    .pointId(UUID.randomUUID().toString())
                    .placeId(pp.getPlaceId())
                    .address(pp.getAddress())
                    .scheduledDepartureTime(pp.getScheduledDepartureTime())
                    .active(pp.getActive() != null ? pp.getActive() : true)
                    .location(pp.getLocation() != null
                            ? GeoLocation.builder()
                                    .latitude(pp.getLocation().getLatitude())
                                    .longitude(pp.getLocation().getLongitude())
                                    .build()
                            : null)
                    .build())
                    .toList();
            trip.setPickupPoints(pickups);
        }

        if (req.getDropoffPoints() != null) {
            List<DropoffPointType> dropoffs = req.getDropoffPoints().stream()
                    .map(dp -> DropoffPointType.builder()
                    .pointId(UUID.randomUUID().toString())
                    .placeId(dp.getPlaceId())
                    .address(dp.getAddress())
                    .scheduledArrivalTime(dp.getScheduledArrivalTime())
                    .active(dp.getActive() != null ? dp.getActive() : true)
                    .location(dp.getLocation() != null
                            ? GeoLocation.builder()
                                    .latitude(dp.getLocation().getLatitude())
                                    .longitude(dp.getLocation().getLongitude())
                                    .build()
                            : null)
                    .build())
                    .toList();
            trip.setDropoffPoints(dropoffs);
        }

        // Re-validate pickup/dropoff coverage after changes
        PickupDropoffValidator.validate(
                trip.getStopSchedule(), trip.getPickupPoints(), trip.getDropoffPoints());

        // Status transition (handled separately but can be sent inline)
        if (req.getStatus() != null) {
            TripStatusEnum target = TripStatusEnum.fromValue(req.getStatus());
            transitionStatus(trip, target);
        }

        return tripRepository.save(trip);
    }

    // ════════════════════════════════════════════════════════════════════
    // DELETE
    // ════════════════════════════════════════════════════════════════════
    public void delete(String tripId, String companyId) {
        TripType trip = getById(tripId, companyId);
        if (trip.getStatus() != TripStatusEnum.SCHEDULED) {
            throw new BadRequestException("Only SCHEDULED trips can be deleted");
        }
        tripRepository.deleteById(tripId);
    }

    // ════════════════════════════════════════════════════════════════════
    // STATUS TRANSITIONS
    // ════════════════════════════════════════════════════════════════════
    /**
     * Transitions a trip's status enforcing the state machine. Side effects for
     * ACTIVE→CANCELLED (expire tickets, create refunds) will be wired in Batch
     * 3 when the booking engine exists.
     */
    public TripType transitionStatus(String tripId, TripStatusEnum target, String companyId) {
        TripType trip = getById(tripId, companyId);
        transitionStatus(trip, target);
        return tripRepository.save(trip);
    }

    private void transitionStatus(TripType trip, TripStatusEnum target) {
        TripStatusEnum previous = trip.getStatus();
        TripStatusMachine.assertTransition(previous, target);
        trip.setStatus(target);

        // Side effect: ACTIVE → CANCELLED triggers ticket expiry + refunds
        if (previous == TripStatusEnum.ACTIVE && target == TripStatusEnum.CANCELLED) {
            tripCancellationHandler.handleTripCancellation(trip.getId());
        }
    }

    // ════════════════════════════════════════════════════════════════════
    // SEGMENT FIELD UPDATES (price, maxSeats)
    // ════════════════════════════════════════════════════════════════════
    /**
     * Updates a single segment's basePrice (always allowed — tickets are
     * snapshots).
     */
    public TripType updateSegmentPrice(String tripId, String segmentId,
            java.math.BigDecimal newPrice, String companyId) {
        TripType trip = getById(tripId, companyId);
        SegmentType seg = findSegment(trip, segmentId);
        seg.setBasePrice(newPrice);
        return tripRepository.save(trip);
    }

    /**
     * Updates a single segment's maxSeats. Blocked if new value < current
     * bookedSeats.
     */
    public TripType updateSegmentMaxSeats(String tripId, String segmentId,
            int newMaxSeats, String companyId) {
        TripType trip = getById(tripId, companyId);
        SegmentType seg = findSegment(trip, segmentId);
        if (newMaxSeats < seg.getBookedSeats()) {
            throw new BadRequestException(
                    "MAX_SEATS_BELOW_BOOKED: newMaxSeats (" + newMaxSeats
                    + ") < current bookedSeats (" + seg.getBookedSeats() + ")");
        }
        seg.setMaxSeats(newMaxSeats);
        return tripRepository.save(trip);
    }

    // ════════════════════════════════════════════════════════════════════
    // EXPRESS FARE SUB-RESOURCE
    // ════════════════════════════════════════════════════════════════════
    public TripType addExpressFare(String tripId, ExpressFareRequest req, String companyId) {
        TripType trip = getById(tripId, companyId);
        assertExpressFareMutationAllowed(trip, true);

        ExpressFareType fare = ExpressFareType.builder()
                .expressId(UUID.randomUUID().toString())
                .fromPlaceId(req.getFromPlaceId())
                .toPlaceId(req.getToPlaceId())
                .segmentsCovered(req.getSegmentIds())
                .price(req.getPrice())
                .validFrom(req.getValidFrom())
                .validUntil(req.getValidUntil())
                .active(req.getActive() != null ? req.getActive() : true)
                .build();

        ExpressFareValidator.validate(fare, trip.getSegments());
        trip.getExpressFares().add(fare);
        return tripRepository.save(trip);
    }

    public TripType updateExpressFare(String tripId, String expressId,
            ExpressFareUpdateRequest req, String companyId) {
        TripType trip = getById(tripId, companyId);
        assertExpressFareMutationAllowed(trip, false);
        ExpressFareType fare = findExpressFare(trip, expressId);

        if (req.getPrice() != null) {
            fare.setPrice(req.getPrice());
        }
        if (req.getValidFrom() != null) {
            fare.setValidFrom(req.getValidFrom());
        }
        if (req.getValidUntil() != null) {
            fare.setValidUntil(req.getValidUntil());
        }
        if (req.getActive() != null) {
            fare.setActive(req.getActive());
        }

        return tripRepository.save(trip);
    }

    public TripType deleteExpressFare(String tripId, String expressId, String companyId) {
        TripType trip = getById(tripId, companyId);
        assertExpressFareMutationAllowed(trip, false);

        if (trip.getStatus() == TripStatusEnum.ACTIVE) {
            // Deactivate instead of delete when ACTIVE
            ExpressFareType fare = findExpressFare(trip, expressId);
            fare.setActive(false);
        } else {
            trip.getExpressFares().removeIf(f -> f.getExpressId().equals(expressId));
        }
        return tripRepository.save(trip);
    }

    // ════════════════════════════════════════════════════════════════════
    // PICKUP/DROPOFF SUB-RESOURCES
    // ════════════════════════════════════════════════════════════════════
    public TripType addPickupPoint(String tripId, PickupPointRequest req, String companyId) {
        TripType trip = getById(tripId, companyId);
        assertPlaceHasFlag(trip, req.getPlaceId(), true);

        PickupPointType point = PickupPointType.builder()
                .pointId(UUID.randomUUID().toString())
                .placeId(req.getPlaceId())
                .address(req.getAddress())
                .scheduledDepartureTime(req.getScheduledDepartureTime())
                .active(req.getActive() != null ? req.getActive() : true)
                .location(req.getLocation() != null
                        ? GeoLocation.builder()
                                .latitude(req.getLocation().getLatitude())
                                .longitude(req.getLocation().getLongitude())
                                .build()
                        : null)
                .build();

        trip.getPickupPoints().add(point);
        return tripRepository.save(trip);
    }

    public TripType updatePickupPoint(String tripId, String pointId,
            PickupPointRequest req, String companyId) {
        TripType trip = getById(tripId, companyId);
        PickupPointType point = trip.getPickupPoints().stream()
                .filter(p -> p.getPointId().equals(pointId))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Pickup point not found: " + pointId));

        point.setAddress(req.getAddress());
        point.setScheduledDepartureTime(req.getScheduledDepartureTime());
        if (req.getActive() != null) {
            point.setActive(req.getActive());
        }
        if (req.getLocation() != null) {
            point.setLocation(GeoLocation.builder()
                    .latitude(req.getLocation().getLatitude())
                    .longitude(req.getLocation().getLongitude())
                    .build());
        }

        return tripRepository.save(trip);
    }

    public TripType addDropoffPoint(String tripId, DropoffPointRequest req, String companyId) {
        TripType trip = getById(tripId, companyId);
        assertPlaceHasFlag(trip, req.getPlaceId(), false);

        DropoffPointType point = DropoffPointType.builder()
                .pointId(UUID.randomUUID().toString())
                .placeId(req.getPlaceId())
                .address(req.getAddress())
                .scheduledArrivalTime(req.getScheduledArrivalTime())
                .active(req.getActive() != null ? req.getActive() : true)
                .location(req.getLocation() != null
                        ? GeoLocation.builder()
                                .latitude(req.getLocation().getLatitude())
                                .longitude(req.getLocation().getLongitude())
                                .build()
                        : null)
                .build();

        trip.getDropoffPoints().add(point);
        return tripRepository.save(trip);
    }

    public TripType updateDropoffPoint(String tripId, String pointId,
            DropoffPointRequest req, String companyId) {
        TripType trip = getById(tripId, companyId);
        DropoffPointType point = trip.getDropoffPoints().stream()
                .filter(p -> p.getPointId().equals(pointId))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Dropoff point not found: " + pointId));

        point.setAddress(req.getAddress());
        point.setScheduledArrivalTime(req.getScheduledArrivalTime());
        if (req.getActive() != null) {
            point.setActive(req.getActive());
        }
        if (req.getLocation() != null) {
            point.setLocation(GeoLocation.builder()
                    .latitude(req.getLocation().getLatitude())
                    .longitude(req.getLocation().getLongitude())
                    .build());
        }

        return tripRepository.save(trip);
    }

    // ════════════════════════════════════════════════════════════════════
    // HELPERS
    // ════════════════════════════════════════════════════════════════════
    private void assertCompanyScope(TripType trip, String companyId) {
        if (trip.getTarget() == null
                || !companyId.equals(trip.getTarget().getCompany())) {
            throw new ForbiddenException("Trip does not belong to company " + companyId);
        }
    }

    private CurrencyType resolveCurrency(String currencyId) {
        return currencyRepository.findById(currencyId)
                .orElseThrow(() -> new NotFoundException("Currency not found: " + currencyId));
    }

    private SegmentType findSegment(TripType trip, String segmentId) {
        return trip.getSegments().stream()
                .filter(s -> s.getSegmentId().equals(segmentId))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Segment not found: " + segmentId));
    }

    private ExpressFareType findExpressFare(TripType trip, String expressId) {
        return trip.getExpressFares().stream()
                .filter(f -> f.getExpressId().equals(expressId))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Express fare not found: " + expressId));
    }

    private void assertExpressFareMutationAllowed(TripType trip, boolean adding) {
        if (trip.getStatus() == TripStatusEnum.COMPLETED
                || trip.getStatus() == TripStatusEnum.CANCELLED) {
            throw new BadRequestException(
                    "BLOCKED: express fares cannot be modified on " + trip.getStatus() + " trip");
        }

        if (adding && trip.getStatus() == TripStatusEnum.ACTIVE) {
            throw new BadRequestException("BLOCKED: cannot add express fares to ACTIVE trip");
        }
    }

    /**
     * Asserts that the given placeId has the expected flag set in the stop
     * schedule.
     *
     * @param isPickup true = check boardingAllowed, false = check
     * droppingAllowed
     */
    private void assertPlaceHasFlag(TripType trip, String placeId, boolean isPickup) {
        boolean valid = trip.getStopSchedule().stream()
                .filter(s -> s.getPlaceId().equals(placeId))
                .anyMatch(s -> isPickup ? s.isBoardingAllowed() : s.isDroppingAllowed());
        if (!valid) {
            String flag = isPickup ? "boardingAllowed" : "droppingAllowed";
            throw new BadRequestException(
                    "placeId '" + placeId + "' does not have " + flag + "=true in stop schedule");
        }
    }
}
