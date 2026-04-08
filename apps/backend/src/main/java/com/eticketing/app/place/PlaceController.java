package com.eticketing.app.place;

import com.eticketing.app.country.CountryRepository;
import com.eticketing.app.country.CountryType;
import com.eticketing.app.state.StateRepository;
import com.eticketing.app.state.StateType;
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
    public record TargetReq(String company, String pos) {

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

    public record TargetRes(String company, String pos) {

        static TargetRes from(PlaceType.TargetType t) {
            return t == null ? null : new TargetRes(t.getCompany(), t.getPos());
        }
    }

    public record PlaceRes(
            String id,
            String city,
            String kind,
            StateRes state,
            CountryRes country,
            TargetRes target,
            Instant createdAt,
            Instant updatedAt
            ) {

        static PlaceRes from(PlaceType p, StateType s, CountryType c) {
            return new PlaceRes(
                    p.getId(),
                    p.getCity(),
                    p.getKind() != null ? p.getKind().name() : "CITY",
                    StateRes.from(s),
                    CountryRes.from(c),
                    TargetRes.from(p.getTarget()),
                    p.getCreatedAt(),
                    p.getUpdatedAt()
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

        Page<PlaceType> p = (searchString != null && !searchString.isBlank())
                ? repo.findByKindAndCityIgnoreCaseContaining(
                        PlaceType.PlaceKind.CITY,
                        searchString,
                        PageRequest.of(page, limit))
                : repo.findByKind(PlaceType.PlaceKind.CITY, PageRequest.of(page, limit));

        var list = p.getContent().stream().map(this::buildPlaceRes).toList();
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
        var list = p.getContent().stream().map(this::buildPlaceRes).toList();
        return new Paginated<>(list, p.getTotalElements(), p.isLast());
    }

    @GetMapping("/{id}")
    public PlaceRes get(@PathVariable String id) {
        PlaceType p = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Place not found"));
        return buildPlaceRes(p);
    }

    @PostMapping
    public PlaceRes create(@RequestBody PlaceReq req) {
        PlaceType p = new PlaceType();
        p.setCity(req.city());
        p.setKind(PlaceType.PlaceKind.CITY);
        p.setStateId(req.stateId());
        p.setCountryId(req.countryId());
        if (req.target() != null && req.target().pos() != null && !req.target().pos().isBlank()) {
            p.setTarget(new PlaceType.TargetType(req.target().company(), req.target().pos()));
        }
        // Server-managed timestamps
        Instant now = Instant.now();
        p.setCreatedAt(now);
        p.setUpdatedAt(now);

        PlaceType saved = repo.save(p);
        return buildPlaceRes(saved);
    }

    @PutMapping("/{id}")
    public PlaceRes update(@PathVariable String id, @RequestBody PlaceReq req) {
        PlaceType p = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Place not found"));

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
        return buildPlaceRes(saved);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable String id) {
        repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Place not found"));
        repo.deleteById(id);
    }

    // ========== Helpers ==========
    private PlaceRes buildPlaceRes(PlaceType p) {
        StateType s = p.getStateId() != null ? stateRepo.findById(p.getStateId()).orElse(null) : null;
        CountryType c = p.getCountryId() != null ? countryRepo.findById(p.getCountryId()).orElse(null) : null;

        return PlaceRes.from(p, s, c);
    }
}
