package com.eticketing.app.bus;

import com.eticketing.app.web.error.ApiExceptions.ConflictException;
import com.eticketing.app.web.error.ApiExceptions.NotFoundException;
import com.eticketing.app.web.error.ApiExceptions.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.stream.Stream;

/**
 * Bus business-logic layer. Handles CRUD, marketplace scoping, and the
 * totalSeats lock check against active/scheduled trips.
 */
@Service
@RequiredArgsConstructor
public class BusService {

    private final BusRepository busRepository;
    private final MongoTemplate mongoTemplate;

    /* ───── Queries ───── */
    public Page<BusType> list(String companyId, String searchString, int page, int limit) {
        var pageable = PageRequest.of(page, limit);
        if (searchString != null && !searchString.isBlank()) {
            return busRepository.findByTargetCompanyAndNameLike(companyId, searchString, pageable);
        }
        return busRepository.findByTargetCompany(companyId, pageable);
    }

    public BusType getById(String id) {
        return busRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Bus not found: " + id));
    }

    /* ───── Commands ───── */
    public BusType create(BusType bus) {
        return busRepository.save(bus);
    }

    public BusType update(String id, BusController.BusUpdateReq updates) {
        var existing = getById(id);

        if (updates.name() != null) {
            if (updates.name().isBlank()) {
                throw new BadRequestException("name must not be blank");
            }
            existing.setName(updates.name());
        }

        // totalSeats change requires lock check (only when no layout is being sent —
        // when layout is present, totalSeats is derived automatically)
        if (updates.totalSeats() != null && updates.layoutTemplate() == null) {
            if (updates.totalSeats() != existing.getTotalSeats()) {
                assertTotalSeatsNotLocked(id);
            }
            existing.setTotalSeats(updates.totalSeats());
        }

        if (updates.amenities() != null) {
            existing.setAmenities(updates.amenities());
        }

        if (updates.media() != null) {
            existing.setMedia(toMedia(updates.media()));
        }

        // Layout template — validate, map, derive totalSeats
        if (updates.layoutTemplate() != null) {
            assertLayoutNotLocked(id);
            var layoutReq = updates.layoutTemplate();
            var layout = validateAndMapLayout(layoutReq);
            existing.setLayoutTemplate(layout);
            // Derive totalSeats from seat count across both decks
            long seatCount = countSeats(layout);
            existing.setTotalSeats((int) seatCount);
        }

        // target is immutable after creation — not updated
        return busRepository.save(existing);
    }

    public void delete(String id) {
        if (!busRepository.existsById(id)) {
            throw new NotFoundException("Bus not found: " + id);
        }
        assertNotInActiveTrip(id);
        busRepository.deleteById(id);
    }

    /* ───── Lock checks ───── */
    /**
     * Queries the trips collection directly via MongoTemplate. No dependency on
     * the Trip module — works as soon as trips adopt the {@code bus.busId}
     * schema from TRIP_SPEC.
     */
    public boolean isBusInActiveTrip(String busId) {
        var query = new Query(Criteria.where("bus.busId").is(busId)
                .and("status").in(List.of("SCHEDULED", "ACTIVE")));
        return mongoTemplate.exists(query, "trips");
    }

    private void assertTotalSeatsNotLocked(String busId) {
        if (isBusInActiveTrip(busId)) {
            throw new ConflictException("BUS_SEATS_LOCKED_ACTIVE_TRIP");
        }
    }

    private void assertNotInActiveTrip(String busId) {
        if (isBusInActiveTrip(busId)) {
            throw new ConflictException("BUS_IN_ACTIVE_TRIP");
        }
    }

    private void assertLayoutNotLocked(String busId) {
        if (isBusInActiveTrip(busId)) {
            throw new ConflictException("LAYOUT_LOCKED");
        }
    }

    /* ───── Layout validation & mapping ───── */
    /**
     * Validates the incoming layout request per BUS_LAYOUT_SPEC §3.4 and maps
     * it to the persisted {@link LayoutTemplate} POJO.
     */
    private LayoutTemplate validateAndMapLayout(BusController.LayoutTemplateReq req) {
        int cols = req.gridColumns();
        int rows = req.gridRows();

        var lowerReq = req.lowerDeck() != null ? req.lowerDeck() : List.<BusController.LayoutElementReq>of();
        var upperReq = req.upperDeck() != null ? req.upperDeck() : List.<BusController.LayoutElementReq>of();

        // Rule 7: if hasDecks == false, upperDeck must be empty
        if (!req.hasDecks() && !upperReq.isEmpty()) {
            throw new BadRequestException("upperDeck must be empty when hasDecks is false");
        }

        // Validate each deck
        var lowerElements = validateDeckElements(lowerReq, cols, rows, "lowerDeck");
        var upperElements = validateDeckElements(upperReq, cols, rows, "upperDeck");

        // Rule 4: no duplicate seatNo across both decks
        var allSeatNos = new HashSet<String>();
        collectSeatNos(lowerElements, allSeatNos, "lowerDeck");
        collectSeatNos(upperElements, allSeatNos, "upperDeck");

        return LayoutTemplate.builder()
                .gridColumns(cols)
                .gridRows(rows)
                .hasDecks(req.hasDecks())
                .lowerDeck(lowerElements)
                .upperDeck(upperElements)
                .build();
    }

    /**
     * Validates all elements in a single deck and maps them to POJOs.
     */
    private List<LayoutElement> validateDeckElements(
            List<BusController.LayoutElementReq> elements,
            int maxCols, int maxRows, String deckName) {

        var positionSet = new HashSet<String>();
        var result = new ArrayList<LayoutElement>(elements.size());

        for (var el : elements) {
            // Rule 1 & 2: bounds check
            if (el.gridX() < 1 || el.gridX() > maxCols) {
                throw new BadRequestException(
                        deckName + ": gridX " + el.gridX() + " out of bounds [1.." + maxCols + "]");
            }
            if (el.gridY() < 1 || el.gridY() > maxRows) {
                throw new BadRequestException(
                        deckName + ": gridY " + el.gridY() + " out of bounds [1.." + maxRows + "]");
            }

            // Rule 3: no duplicate (gridX, gridY) within the same deck
            var posKey = el.gridX() + "," + el.gridY();
            if (!positionSet.add(posKey)) {
                throw new BadRequestException(
                        deckName + ": duplicate position (" + el.gridX() + "," + el.gridY() + ")");
            }

            // Rule 5: seatNo required for SEAT
            if (el.type() == LayoutElementType.SEAT) {
                if (el.seatNo() == null || el.seatNo().isBlank()) {
                    throw new BadRequestException(
                            deckName + ": seatNo is required for SEAT at (" + el.gridX() + "," + el.gridY() + ")");
                }
            }

            // Rule 6: seatNo must be null for non-SEAT
            if (el.type() != LayoutElementType.SEAT && el.seatNo() != null && !el.seatNo().isBlank()) {
                throw new BadRequestException(
                        deckName + ": seatNo must be null for " + el.type() + " at (" + el.gridX() + "," + el.gridY() + ")");
            }

            result.add(new LayoutElement(
                    el.type(),
                    el.type() == LayoutElementType.SEAT ? el.seatNo() : null,
                    el.gridX(),
                    el.gridY()
            ));
        }

        return result;
    }

    /**
     * Collects all seatNo values from a deck's elements into the given set,
     * throwing on duplicates.
     */
    private void collectSeatNos(List<LayoutElement> elements, HashSet<String> allSeatNos, String deckName) {
        for (var el : elements) {
            if (el.getType() == LayoutElementType.SEAT && el.getSeatNo() != null) {
                if (!allSeatNos.add(el.getSeatNo())) {
                    throw new BadRequestException(
                            "Duplicate seatNo \"" + el.getSeatNo() + "\" found in " + deckName);
                }
            }
        }
    }

    /**
     * Counts SEAT elements across both decks.
     */
    private long countSeats(LayoutTemplate layout) {
        return Stream.concat(
                layout.getLowerDeck() != null ? layout.getLowerDeck().stream() : Stream.empty(),
                layout.getUpperDeck() != null ? layout.getUpperDeck().stream() : Stream.empty()
        ).filter(e -> e.getType() == LayoutElementType.SEAT).count();
    }

    private com.eticketing.app.common.MediaType toMedia(BusController.MediaReq req) {
        if (req == null || req.pictures() == null) {
            return com.eticketing.app.common.MediaMapper.fromPictures(List.of());
        }
        var pics = req.pictures().stream()
                .map(p -> new com.eticketing.app.common.PictureType(p.baseUrl(), p.path()))
                .toList();
        return com.eticketing.app.common.MediaMapper.fromPictures(pics);
    }
}
