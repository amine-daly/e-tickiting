package com.eticketing.app.state;

import com.eticketing.app.country.CountryRepository;
import com.eticketing.app.country.CountryType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Comparator;

@RestController
@RequestMapping("/api/states")
public class StateController {

    public record StateReq(String name, String code, String countryId) {

    }

    public record CountryRes(String id, String name, String code, String flag) {

        static CountryRes from(CountryType c) {
            return c == null ? null : new CountryRes(c.getId(), c.getName(), c.getCode(), c.getFlag());
        }
    }

    public record StateRes(String id, String name, String code, String countryId, CountryRes country, Instant createdAt, Instant updatedAt) {

        static StateRes from(StateType s, CountryType c) {
            return new StateRes(
                    s.getId(),
                    s.getName(),
                    s.getCode(),
                    s.getCountryId(),
                    CountryRes.from(c),
                    s.getCreatedAt(),
                    s.getUpdatedAt()
            );
        }
    }

    public record Paginated<T>(List<T> objects, long count, boolean isLast) {

    }

    private final StateRepository repo;
    private final CountryRepository countryRepo;

    public StateController(StateRepository repo, CountryRepository countryRepo) {
        this.repo = repo;
        this.countryRepo = countryRepo;
    }

    @GetMapping
    public Paginated<StateRes> list(
            @RequestParam(defaultValue = "") String searchString,
            @RequestParam(required = false) String countryId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int limit) {
        Page<StateType> p;
        if (countryId != null && !countryId.isBlank()) {
            p = repo.findByCountryId(countryId, PageRequest.of(page, limit));
        } else if (searchString != null && !searchString.isBlank()) {
            p = repo.findByNameIgnoreCaseContaining(searchString, PageRequest.of(page, limit));
        } else {
            p = repo.findAll(PageRequest.of(page, limit));
        }
        // Fetch response: include both timestamps
        var list = p.getContent().stream().map(s -> {
            CountryType c = s.getCountryId() != null ? countryRepo.findById(s.getCountryId()).orElse(null) : null;
            return StateRes.from(s, c);
        }).toList();
        return new Paginated<>(list, p.getTotalElements(), p.isLast());
    }

    @GetMapping("/by-country/{countryId}")
    public Paginated<StateRes> getStatesByCountry(
            @PathVariable String countryId,
            @RequestParam(defaultValue = "") String searchString,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int limit) {
        CountryType c = countryRepo.findById(countryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Country not found"));
        Page<StateType> p;
        if (searchString != null && !searchString.isBlank()) {
            p = repo.findByCountryIdAndNameIgnoreCaseContaining(countryId, searchString, PageRequest.of(page, limit));
        } else {
            p = repo.findByCountryId(countryId, PageRequest.of(page, limit));
        }
        // Fetch response: include both timestamps
        var list = p.getContent().stream()
                .sorted(Comparator.comparing(StateType::getName, String.CASE_INSENSITIVE_ORDER))
                .map(s -> StateRes.from(s, c))
                .toList();
        return new Paginated<>(list, p.getTotalElements(), p.isLast());
    }

    @GetMapping("/{id}")
    public StateRes get(@PathVariable String id) {
        StateType s = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "State not found"));
        CountryType c = s.getCountryId() != null ? countryRepo.findById(s.getCountryId()).orElse(null) : null;
        // Fetch response: include both timestamps
        return StateRes.from(s, c);
    }

    @PostMapping
    public StateRes create(@RequestBody StateReq req) {
        if (req.countryId() == null || req.countryId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "countryId is required");
        }
        CountryType c = countryRepo.findById(req.countryId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Country not found"));
        StateType s = new StateType(req.name(), req.code(), req.countryId());
        // Server-managed timestamps
        Instant now = Instant.now();
        s.setCreatedAt(now);
        s.setUpdatedAt(now);
        StateType saved = repo.save(s);
        // Create response: include createdAt only
        return StateRes.from(saved, c);
    }

    @PutMapping("/{id}")
    public StateRes update(@PathVariable String id, @RequestBody StateReq req) {
        StateType s = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "State not found"));
        s.setName(req.name());
        s.setCode(req.code());
        if (req.countryId() != null && !req.countryId().isBlank()) {
            s.setCountryId(req.countryId());
        }
        // Server-managed timestamps
        s.setUpdatedAt(Instant.now());
        StateType saved = repo.save(s);
        CountryType c = saved.getCountryId() != null ? countryRepo.findById(saved.getCountryId()).orElse(null) : null;
        return StateRes.from(saved, c);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable String id) {
        repo.deleteById(id);
    }
}
