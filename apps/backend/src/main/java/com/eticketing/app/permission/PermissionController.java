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
import java.util.ArrayList;
import java.util.List;

/**
 * Permission roles CRUD.
 *
 * Project scope: ONLY POS target is supported (no wholesaler/manufacturer).
 *
 * Input: { "name": "POS Manager", "permissions": [ { "permission":
 * "<permissionDefinitionId>", "read": true, "create": true, "update": true } ],
 * "target": { "pos": "<posId>" } }
 *
 * Output expands permission definition to {id,name,code} and omits timestamps.
 */
@RestController
@RequestMapping("/api/permissions")
@Tag(name = "Permissions", description = "Permission roles (name + grants + POS target)")
public class PermissionController {

    // ===== Request DTOs =====
    public record PermissionPermissionsInput(String permission, Boolean read, Boolean create, Boolean update) {

    }

    public record TargetInput(String pos) {

    }

    public record PermissionInput(String name, List<PermissionPermissionsInput> permissions, TargetInput target) {

    }

    // ===== Response DTOs =====
    public record PermissionDefinitionRes(String id, String name, String code) {

        static PermissionDefinitionRes from(PermissionDefinitionType p) {
            return new PermissionDefinitionRes(p.getId(), p.getName(), p.getCode());
        }
    }

    public record PermissionPermissionsRes(PermissionDefinitionRes permission, Boolean read, Boolean create, Boolean update) {

    }

    public record IdRefRes(String id) {

    }

    public record TargetRes(IdRefRes pos) {

    }

    public record PermissionRes(String id, String name, List<PermissionPermissionsRes> permissions, TargetRes target, Instant createdAt, Instant updatedAt) {

    }

    public record Paginated<T>(List<T> objects, long count, boolean isLast) {

    }

    private final PermissionRepository permissionRepo;
    private final PermissionDefinitionRepository definitionRepo;

    public PermissionController(PermissionRepository permissionRepo, PermissionDefinitionRepository definitionRepo) {
        this.permissionRepo = permissionRepo;
        this.definitionRepo = definitionRepo;
    }

    private PermissionRes toRes(PermissionType role) {
        List<PermissionPermissionsRes> grants = new ArrayList<>();
        if (role.getPermissions() != null) {
            for (PermissionType.PermissionGrant g : role.getPermissions()) {
                PermissionDefinitionRes def = null;
                if (g.getPermission() != null) {
                    def = definitionRepo.findById(g.getPermission()).map(PermissionDefinitionRes::from).orElse(null);
                    if (def == null) {
                        // help debugging if a referenced definition is missing
                        def = new PermissionDefinitionRes(g.getPermission(), null, null);
                    }
                }
                grants.add(new PermissionPermissionsRes(def, g.getRead(), g.getCreate(), g.getUpdate()));
            }
        }

        TargetRes targetRes = null;
        if (role.getTarget() != null && role.getTarget().getPos() != null) {
            targetRes = new TargetRes(new IdRefRes(role.getTarget().getPos().getId()));
        }

        return new PermissionRes(
                role.getId(),
                role.getName(),
                grants,
                targetRes,
                role.getCreatedAt(),
                role.getUpdatedAt()
        );
    }

    private PermissionType.TargetType toTarget(TargetInput input) {
        if (input == null) {
            return null;
        }
        PermissionType.TargetType t = new PermissionType.TargetType();
        if (input.pos() != null && !input.pos().isBlank()) {
            t.setPos(new PermissionType.TargetType.IdRef(input.pos()));
        }
        return t;
    }

    @GetMapping
    @Operation(summary = "List permission roles (paginated)")
    public Paginated<PermissionRes> list(
            @RequestParam(defaultValue = "") String searchString,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int limit) {
        Page<PermissionType> p = (searchString == null || searchString.isBlank())
                ? permissionRepo.findAll(PageRequest.of(page, limit))
                : permissionRepo.findByNameIgnoreCaseContaining(searchString, PageRequest.of(page, limit));
        // Fetch response: include both timestamps
        var list = p.getContent().stream().map(role -> toRes(role)).toList();
        return new Paginated<>(list, p.getTotalElements(), p.isLast());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get permission role by ID")
    public PermissionRes get(@PathVariable String id) {
        // Fetch response: include both timestamps
        return permissionRepo.findById(id)
                .map(role -> toRes(role))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Permission not found"));
    }

    @GetMapping("/by-target")
    @Operation(summary = "Get permission roles by POS target")
    public Paginated<PermissionRes> byTarget(
            @RequestParam String posId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int limit) {
        if (posId == null || posId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "posId is required");
        }
        Page<PermissionType> p = permissionRepo.findByTargetPosId(posId, PageRequest.of(page, limit));
        // Fetch response: include both timestamps
        var list = p.getContent().stream().map(role -> toRes(role)).toList();
        return new Paginated<>(list, p.getTotalElements(), p.isLast());
    }

    @PostMapping
    @Operation(summary = "Create a permission role")
    public ResponseEntity<PermissionRes> create(@RequestBody PermissionInput req) {
        if (req.name() == null || req.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "name is required");
        }

        PermissionType role = new PermissionType();
        role.setName(req.name());
        role.setTarget(toTarget(req.target()));

        List<PermissionType.PermissionGrant> grants = new ArrayList<>();
        if (req.permissions() != null) {
            for (PermissionPermissionsInput g : req.permissions()) {
                if (g == null || g.permission() == null || g.permission().isBlank()) {
                    continue;
                }
                definitionRepo.findById(g.permission()).orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Permission definition not found: " + g.permission()
                ));
                grants.add(new PermissionType.PermissionGrant(g.permission(), g.read(), g.create(), g.update()));
            }
        }
        role.setPermissions(grants);

        // Server-managed timestamps
        Instant now = Instant.now();
        role.setCreatedAt(now);
        role.setUpdatedAt(now);

        PermissionType saved = permissionRepo.save(role);
        // Create response: include createdAt only
        return ResponseEntity.status(HttpStatus.CREATED).body(toRes(saved));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a permission role")
    public PermissionRes update(@PathVariable String id, @RequestBody PermissionInput req) {
        PermissionType role = permissionRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Permission not found"));

        if (req.name() != null) {
            role.setName(req.name());
        }
        if (req.target() != null) {
            role.setTarget(toTarget(req.target()));
        }
        if (req.permissions() != null) {
            List<PermissionType.PermissionGrant> grants = new ArrayList<>();
            for (PermissionPermissionsInput g : req.permissions()) {
                if (g == null || g.permission() == null || g.permission().isBlank()) {
                    continue;
                }
                definitionRepo.findById(g.permission()).orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Permission definition not found: " + g.permission()
                ));
                grants.add(new PermissionType.PermissionGrant(g.permission(), g.read(), g.create(), g.update()));
            }
            role.setPermissions(grants);
        }

        // Server-managed timestamps
        role.setUpdatedAt(Instant.now());

        return toRes(permissionRepo.save(role));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a permission role")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        permissionRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
