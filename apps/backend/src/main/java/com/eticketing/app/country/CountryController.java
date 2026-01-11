package com.eticketing.app.country;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/countries")
public class CountryController {

    public record CountryReq(String name, String code, String flag) {

    }

    public record CountryRes(String id, String name, String code, String flag) {

        static CountryRes from(CountryType c) {
            return new CountryRes(c.getId(), c.getName(), c.getCode(), c.getFlag());
        }
    }

    public record Paginated<T>(List<T> objects, long count, boolean isLast) {

    }

    private final CountryRepository repo;

    public CountryController(CountryRepository repo) {
        this.repo = repo;
    }

    @GetMapping
    public Paginated<CountryRes> list(
            @RequestParam(defaultValue = "") String searchString,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int limit) {
        Page<CountryType> p = (searchString == null || searchString.isBlank())
                ? repo.findAll(PageRequest.of(page, limit))
                : repo.findByNameIgnoreCaseContaining(searchString, PageRequest.of(page, limit));
        var list = p.getContent().stream().map(CountryRes::from).toList();
        return new Paginated<>(list, p.getTotalElements(), p.isLast());
    }

    @GetMapping("/{id}")
    public CountryRes get(@PathVariable String id) {
        return repo.findById(id)
                .map(CountryRes::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Country not found"));
    }

    @PostMapping
    public CountryRes create(@RequestBody CountryReq req) {
        CountryType c = new CountryType(req.name(), req.code(), req.flag());
        return CountryRes.from(repo.save(c));
    }

    @PutMapping("/{id}")
    public CountryRes update(@PathVariable String id, @RequestBody CountryReq req) {
        CountryType c = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Country not found"));
        c.setName(req.name());
        c.setCode(req.code());
        c.setFlag(req.flag());
        return CountryRes.from(repo.save(c));
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable String id) {
        repo.deleteById(id);
    }
}
