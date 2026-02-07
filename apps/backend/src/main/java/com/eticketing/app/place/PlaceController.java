package com.eticketing.app.place;

import com.eticketing.app.country.CountryRepository;
import com.eticketing.app.country.CountryType;
import com.eticketing.app.state.StateRepository;
import com.eticketing.app.state.StateType;
import com.eticketing.app.subplace.SubPlaceRes;
import com.eticketing.app.subplace.SubPlaceRepository;
import com.eticketing.app.subplace.SubPlaceType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/places")
public class PlaceController {

    // ========== Request/Response DTOs ==========
    public record TargetReq(String pos) {

    }

    public record PlaceReq(
            String city,
            String kind, // "CITY"
            String stateId,
            String countryId,
            TargetReq target
            ) {

    }

    public record CountryRes(String id, String name, String code, String flag) {

        static CountryRes from(CountryType c) {
            return c == null ? null : new CountryRes(c.getId(), c.getName(), c.getCode(), c.getFlag());
        }
    }

    public record StateRes(String id, String name, String code, String countryId) {

        static StateRes from(StateType s) {
            return s == null ? null : new StateRes(s.getId(), s.getName(), s.getCode(), s.getCountryId());
        }
    }

    public record TargetRes(String pos) {

        static TargetRes from(PlaceType.TargetType t) {
            return t == null ? null : new TargetRes(t.getPos());
        }
    }

    public record PlaceRes(
            String id,
            String city,
            String kind,
            StateRes state,
            CountryRes country,
            TargetRes target,
            List<SubPlaceRes> subPlaces,
            Instant createdAt,
            Instant updatedAt
            ) {

        static PlaceRes from(PlaceType p, StateType s, CountryType c, List<SubPlaceRes> subPlaces) {
            return new PlaceRes(
                    p.getId(),
                    p.getCity(),
                    p.getKind() != null ? p.getKind().name() : "CITY",
                    StateRes.from(s),
                    CountryRes.from(c),
                    TargetRes.from(p.getTarget()),
                    subPlaces,
                    p.getCreatedAt(),
                    p.getUpdatedAt()
            );
        }
    }

    public record Paginated<T>(List<T> objects, long count, boolean isLast) {

    }

    // ========== Dependencies ==========
    private final PlaceRepository repo;
    private final SubPlaceRepository subPlaceRepo;
    private final StateRepository stateRepo;
    private final CountryRepository countryRepo;

    public PlaceController(PlaceRepository repo, SubPlaceRepository subPlaceRepo, StateRepository stateRepo, CountryRepository countryRepo) {
        this.repo = repo;
        this.subPlaceRepo = subPlaceRepo;
        this.stateRepo = stateRepo;
        this.countryRepo = countryRepo;
    }

    // ========== Endpoints ==========
    @GetMapping
    public Paginated<PlaceRes> list(
            @RequestParam(defaultValue = "") String searchString,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int limit) {

        Page<PlaceType> p;
        // Default to CITY
        if (searchString != null && !searchString.isBlank()) {
            // Find SubPlaces matching the search string and collect their parent CITY ids
            List<SubPlaceType> matchingSubPlaces = subPlaceRepo.findByAddressIgnoreCaseContaining(searchString);
            List<String> parentIds = matchingSubPlaces.stream()
                    .map(SubPlaceType::getParentId)
                    .filter(pid -> pid != null && !pid.isBlank())
                    .distinct()
                    .toList();

            // Find Cities matching name OR having matching subplaces
            p = repo.findByKindAndIdInOrKindAndCityIgnoreCaseContaining(
                    PlaceType.PlaceKind.CITY, parentIds,
                    PlaceType.PlaceKind.CITY, searchString,
                    PageRequest.of(page, limit));
        } else {
            p = repo.findByKind(PlaceType.PlaceKind.CITY, PageRequest.of(page, limit));
        }

        // Fetch response: include both timestamps
        var list = p.getContent().stream().map(place -> buildPlaceRes(place, true)).toList();
        return new Paginated<>(list, p.getTotalElements(), p.isLast());
    }

    @GetMapping("/by-target")
    public Paginated<PlaceRes> byTarget(
            @RequestParam String posId,
            @RequestParam(defaultValue = "") String searchString,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int limit) {
        if (posId == null || posId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "posId is required");
        }
        Page<PlaceType> p = (searchString != null && !searchString.isBlank())
                ? repo.findByTargetPosAndKindAndCityLike(posId, PlaceType.PlaceKind.CITY, searchString, PageRequest.of(page, limit))
                : repo.findByTargetPosAndKind(posId, PlaceType.PlaceKind.CITY, PageRequest.of(page, limit));
        // Fetch response: include both timestamps
        var list = p.getContent().stream().map(place -> buildPlaceRes(place, true)).toList();
        return new Paginated<>(list, p.getTotalElements(), p.isLast());
    }

    @GetMapping("/{id}")
    public PlaceRes get(@PathVariable String id) {
        PlaceType p = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Place not found"));
        // Fetch response: include both timestamps
        return buildPlaceRes(p, true);
    }

    @GetMapping("/{id}/places")
    public List<SubPlaceRes> getSubPlaces(@PathVariable String id) {
        // Verify parent exists
        PlaceType parent = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Place not found"));
        List<SubPlaceType> subPlaces = subPlaceRepo.findByParentId(id);
        return subPlaces.stream().map(sp -> SubPlaceRes.from(sp, parent.getCity())).toList();
    }

    @PostMapping
    public PlaceRes create(@RequestBody PlaceReq req) {
        PlaceType p = new PlaceType();
        p.setCity(req.city());
        p.setKind(PlaceType.PlaceKind.CITY);
        p.setStateId(req.stateId());
        p.setCountryId(req.countryId());
        if (req.target() != null && req.target().pos() != null && !req.target().pos().isBlank()) {
            p.setTarget(new PlaceType.TargetType(req.target().pos()));
        }
        // Server-managed timestamps
        Instant now = Instant.now();
        p.setCreatedAt(now);
        p.setUpdatedAt(now);

        PlaceType saved = repo.save(p);
        // Create response: include createdAt only
        return buildPlaceRes(saved, false);
    }

    @PutMapping("/{id}")
    public PlaceRes update(@PathVariable String id, @RequestBody PlaceReq req) {
        PlaceType p = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Place not found"));

        if (p.getKind() == PlaceType.PlaceKind.POINT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot update SubPlace via Place API");
        }

        if (req.city() != null) {
            p.setCity(req.city());
        }
        if (req.stateId() != null) {
            p.setStateId(req.stateId());
        }
        if (req.countryId() != null) {
            p.setCountryId(req.countryId());
        }
        // Server-managed timestamps
        p.setUpdatedAt(Instant.now());

        PlaceType saved = repo.save(p);
        return buildPlaceRes(saved, false);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable String id) {
        PlaceType p = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Place not found"));

        if (p.getKind() == PlaceType.PlaceKind.POINT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use /api/sub-places to delete SubPlace");
        }

        // Also delete sub-places
        List<SubPlaceType> subPlaces = subPlaceRepo.findByParentId(id);
        subPlaceRepo.deleteAll(subPlaces);
        repo.deleteById(id);
    }

    // ========== Helpers ==========
    private PlaceRes buildPlaceRes(PlaceType p, boolean includeSubPlaces) {
        StateType s = p.getStateId() != null ? stateRepo.findById(p.getStateId()).orElse(null) : null;
        CountryType c = p.getCountryId() != null ? countryRepo.findById(p.getCountryId()).orElse(null) : null;

        List<SubPlaceRes> subPlaces = null;
        if (includeSubPlaces && p.getKind() == PlaceType.PlaceKind.CITY) {
            List<SubPlaceType> children = subPlaceRepo.findByParentId(p.getId());
            subPlaces = children.stream().map(sp -> SubPlaceRes.from(sp, p.getCity())).toList();
        }

        return PlaceRes.from(p, s, c, subPlaces);
    }
}
