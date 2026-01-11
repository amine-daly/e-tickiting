package com.eticketing.app.place;

import com.eticketing.app.country.CountryRepository;
import com.eticketing.app.country.CountryType;
import com.eticketing.app.state.StateRepository;
import com.eticketing.app.state.StateType;
import com.eticketing.app.subplace.SubPlaceRes;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/places")
public class PlaceController {

    // ========== Request/Response DTOs ==========
    public record PlaceReq(
            String city,
            LonLatType location,
            String kind, // "CITY"
            String stateId,
            String countryId
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

    public record PlaceRes(
            String id,
            String city,
            String kind,
            StateRes state,
            CountryRes country,
            List<SubPlaceRes> subPlaces
            ) {

        static PlaceRes from(PlaceType p, StateType s, CountryType c, List<SubPlaceRes> subPlaces) {
            return new PlaceRes(
                    p.getId(),
                    p.getCity(),
                    p.getKind() != null ? p.getKind().name() : "CITY",
                    StateRes.from(s),
                    CountryRes.from(c),
                    subPlaces
            );
        }
    }

    public record Paginated<T>(List<T> objects, long count, boolean isLast) {

    }

    // ========== Dependencies ==========
    private final PlaceRepository repo;
    private final StateRepository stateRepo;
    private final CountryRepository countryRepo;

    public PlaceController(PlaceRepository repo, StateRepository stateRepo, CountryRepository countryRepo) {
        this.repo = repo;
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
            // Find SubPlaces (POINT) matching the search string
            List<PlaceType> matchingSubPlaces = repo.findByKindAndAddressIgnoreCaseContaining(PlaceType.PlaceKind.POINT, searchString);
            List<String> parentIds = matchingSubPlaces.stream()
                    .map(PlaceType::getParentId)
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

        var list = p.getContent().stream().map(place -> buildPlaceRes(place, true)).toList();
        return new Paginated<>(list, p.getTotalElements(), p.isLast());
    }

    @GetMapping("/{id}")
    public PlaceRes get(@PathVariable String id) {
        PlaceType p = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Place not found"));
        return buildPlaceRes(p, true);
    }

    @GetMapping("/{id}/places")
    public List<SubPlaceRes> getSubPlaces(@PathVariable String id) {
        // Verify parent exists
        PlaceType parent = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Place not found"));
        List<PlaceType> subPlaces = repo.findByParentId(id);
        return subPlaces.stream().map(sp -> SubPlaceRes.from(sp, parent.getCity())).toList();
    }

    @PostMapping
    public PlaceRes create(@RequestBody PlaceReq req) {
        PlaceType p = new PlaceType();
        p.setCity(req.city());
        p.setLocation(req.location());
        p.setKind(PlaceType.PlaceKind.CITY);
        p.setStateId(req.stateId());
        p.setCountryId(req.countryId());

        PlaceType saved = repo.save(p);
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
        if (req.location() != null) {
            p.setLocation(req.location());
        }
        if (req.stateId() != null) {
            p.setStateId(req.stateId());
        }
        if (req.countryId() != null) {
            p.setCountryId(req.countryId());
        }

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
        List<PlaceType> subPlaces = repo.findByParentId(id);
        repo.deleteAll(subPlaces);
        repo.deleteById(id);
    }

    // ========== Helpers ==========
    private PlaceRes buildPlaceRes(PlaceType p, boolean includeSubPlaces) {
        StateType s = p.getStateId() != null ? stateRepo.findById(p.getStateId()).orElse(null) : null;
        CountryType c = p.getCountryId() != null ? countryRepo.findById(p.getCountryId()).orElse(null) : null;

        List<SubPlaceRes> subPlaces = null;
        if (includeSubPlaces && p.getKind() == PlaceType.PlaceKind.CITY) {
            List<PlaceType> children = repo.findByParentId(p.getId());
            subPlaces = children.stream().map(sp -> SubPlaceRes.from(sp, p.getCity())).toList();
        }

        return PlaceRes.from(p, s, c, subPlaces);
    }
}
