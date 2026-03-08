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

import java.util.List;

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
    public Page<BusType> list(String posId, String searchString, int page, int limit) {
        var pageable = PageRequest.of(page, limit);
        if (searchString != null && !searchString.isBlank()) {
            return busRepository.findByTargetPosAndNameLike(posId, searchString, pageable);
        }
        return busRepository.findByTargetPos(posId, pageable);
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

        // totalSeats change requires lock check
        if (updates.totalSeats() != null) {
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
