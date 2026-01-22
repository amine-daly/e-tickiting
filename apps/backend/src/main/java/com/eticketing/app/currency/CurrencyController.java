package com.eticketing.app.currency;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

/**
 * Currency CRUD - Common API (no target scoping). Accessible from both
 * frontoffice and terminal.
 */
@RestController
@RequestMapping("/api/currencies")
@Tag(name = "Currencies", description = "Currency management (common, no target scoping)")
public class CurrencyController {

    public record CurrencyReq(String name, String code, String iconFlag) {

    }

    public record CurrencyRes(String id, String name, String code, String iconFlag, Instant createdAt, Instant updatedAt) {

        static CurrencyRes from(CurrencyType c) {
            return new CurrencyRes(
                    c.getId(),
                    c.getName(),
                    c.getCode(),
                    c.getIconFlag(),
                    c.getCreatedAt(),
                    c.getUpdatedAt()
            );
        }
    }

    public record Paginated<T>(List<T> objects, long count, boolean isLast) {

    }

    private final CurrencyRepository repo;

    public CurrencyController(CurrencyRepository repo) {
        this.repo = repo;
    }

    @GetMapping
    @Operation(summary = "List all currencies (paginated)")
    public Paginated<CurrencyRes> list(
            @RequestParam(defaultValue = "") String searchString,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int limit) {
        Page<CurrencyType> p = (searchString == null || searchString.isBlank())
                ? repo.findAll(PageRequest.of(page, limit))
                : repo.findByNameIgnoreCaseContaining(searchString, PageRequest.of(page, limit));
        // Fetch response: include both timestamps
        var list = p.getContent().stream().map(c -> CurrencyRes.from(c)).toList();
        return new Paginated<>(list, p.getTotalElements(), p.isLast());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get currency by ID")
    public CurrencyRes get(@PathVariable String id) {
        // Fetch response: include both timestamps
        return repo.findById(id)
                .map(c -> CurrencyRes.from(c))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Currency not found"));
    }

    @PostMapping
    @Operation(summary = "Create a new currency")
    public ResponseEntity<CurrencyRes> create(@RequestBody CurrencyReq req) {
        if (req.code() == null || req.code().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "code is required");
        }
        if (repo.findByCode(req.code()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Currency code already exists");
        }
        CurrencyType c = new CurrencyType(req.name(), req.code(), req.iconFlag());
        // Server-managed timestamps
        Instant now = Instant.now();
        c.setCreatedAt(now);
        c.setUpdatedAt(now);
        // Create response: include createdAt only
        return ResponseEntity.status(HttpStatus.CREATED).body(CurrencyRes.from(repo.save(c)));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a currency")
    public CurrencyRes update(@PathVariable String id, @RequestBody CurrencyReq req) {
        CurrencyType c = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Currency not found"));
        if (req.name() != null) {
            c.setName(req.name());
        }
        if (req.code() != null) {
            c.setCode(req.code());
        }
        if (req.iconFlag() != null) {
            c.setIconFlag(req.iconFlag());
        }
        // Server-managed timestamps
        c.setUpdatedAt(Instant.now());
        return CurrencyRes.from(repo.save(c));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a currency")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
