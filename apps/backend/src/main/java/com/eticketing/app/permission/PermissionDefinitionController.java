package com.eticketing.app.permission;

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
 * Permission Definition (catalog) CRUD.
 *
 * This is the atomic permission list (id, name, code).
 */
@RestController
@RequestMapping("/api/permission-definitions")
@Tag(name = "Permission Definitions", description = "Permission definitions catalog (id, name, code)")
public class PermissionDefinitionController {

    public record PermissionDefinitionReq(String name, String code) {

    }

    public record PermissionDefinitionRes(String id, String name, String code, Instant createdAt, Instant updatedAt) {

        static PermissionDefinitionRes from(PermissionDefinitionType p) {
            return new PermissionDefinitionRes(
                    p.getId(),
                    p.getName(),
                    p.getCode(),
                    p.getCreatedAt(),
                    p.getUpdatedAt()
            );
        }
    }

    public record Paginated<T>(List<T> objects, long count, boolean isLast) {

    }

    private final PermissionDefinitionRepository repo;

    public PermissionDefinitionController(PermissionDefinitionRepository repo) {
        this.repo = repo;
    }

    @GetMapping
    @Operation(summary = "List permission definitions (paginated)")
    public Paginated<PermissionDefinitionRes> list(
            @RequestParam(defaultValue = "") String searchString,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int limit) {
        Page<PermissionDefinitionType> p;
        if (searchString == null || searchString.isBlank()) {
            p = repo.findAll(PageRequest.of(page, limit));
        } else {
            // Search on name OR code (simple heuristic: if looks like code, search code)
            boolean looksLikeCode = searchString.trim().toUpperCase().equals(searchString.trim()) && !searchString.contains(" ");
            p = looksLikeCode
                    ? repo.findByCodeIgnoreCaseContaining(searchString, PageRequest.of(page, limit))
                    : repo.findByNameIgnoreCaseContaining(searchString, PageRequest.of(page, limit));
        }
        // Fetch response: include both timestamps
        var list = p.getContent().stream().map(def -> PermissionDefinitionRes.from(def)).toList();
        return new Paginated<>(list, p.getTotalElements(), p.isLast());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get permission definition by ID")
    public PermissionDefinitionRes get(@PathVariable String id) {
        // Fetch response: include both timestamps
        return repo.findById(id)
                .map(def -> PermissionDefinitionRes.from(def))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Permission definition not found"));
    }

    @PostMapping
    @Operation(summary = "Create a new permission definition")
    public ResponseEntity<PermissionDefinitionRes> create(@RequestBody PermissionDefinitionReq req) {
        if (req.name() == null || req.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "name is required");
        }
        if (req.code() == null || req.code().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "code is required");
        }
        if (repo.findByName(req.name()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Permission name already exists");
        }
        if (repo.findByCode(req.code()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Permission code already exists");
        }
        PermissionDefinitionType p = new PermissionDefinitionType(req.name(), req.code());
        // Server-managed timestamps
        Instant now = Instant.now();
        p.setCreatedAt(now);
        p.setUpdatedAt(now);
        // Create response: include createdAt only
        return ResponseEntity.status(HttpStatus.CREATED).body(PermissionDefinitionRes.from(repo.save(p)));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a permission definition")
    public PermissionDefinitionRes update(@PathVariable String id, @RequestBody PermissionDefinitionReq req) {
        PermissionDefinitionType p = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Permission definition not found"));
        if (req.name() != null) {
            p.setName(req.name());
        }
        if (req.code() != null) {
            p.setCode(req.code());
        }
        // Server-managed timestamps
        p.setUpdatedAt(Instant.now());
        return PermissionDefinitionRes.from(repo.save(p));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a permission definition")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
