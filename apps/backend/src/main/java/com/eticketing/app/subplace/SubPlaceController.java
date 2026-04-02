package com.eticketing.app.subplace;

import com.eticketing.app.place.PlaceRepository;
import com.eticketing.app.place.PlaceType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/sub-places")
public class SubPlaceController {

    private final SubPlaceRepository repo;
    private final PlaceRepository placeRepo;

    public SubPlaceController(SubPlaceRepository repo, PlaceRepository placeRepo) {
        this.repo = repo;
        this.placeRepo = placeRepo;
    }

    public record Paginated<T>(List<T> objects, long count, boolean isLast) {

    }

    @GetMapping
    public Paginated<SubPlaceRes> list(
            @RequestParam(required = false) String posId,
            @RequestParam(defaultValue = "") String searchString,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int limit) {
        Page<SubPlaceType> p;
        if (posId != null && !posId.isBlank()) {
            if (searchString != null && !searchString.isBlank()) {
                // Search by parent CITY name within the target scope
                Page<PlaceType> parents = placeRepo.findByTargetPosAndKindAndCityLike(
                        posId, PlaceType.PlaceKind.CITY, searchString, PageRequest.of(page, limit));
                var parentIds = parents.getContent().stream().map(PlaceType::getId).toList();
                if (parentIds.isEmpty()) {
                    return new Paginated<>(List.of(), 0, true);
                }
                p = repo.findByParentIdIn(parentIds, PageRequest.of(page, limit));
            } else {
                p = repo.findByTargetPos(posId, PageRequest.of(page, limit));
            }
        } else {
            p = (searchString != null && !searchString.isBlank())
                    ? repo.findByAddressIgnoreCaseContaining(searchString, PageRequest.of(page, limit))
                    : repo.findAll(PageRequest.of(page, limit));
        }

        // Fetch parent cities
        List<String> parentIds = p.getContent().stream()
                .map(SubPlaceType::getParentId)
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();

        Map<String, String> parentCityMap = placeRepo.findAllById(parentIds).stream()
                .collect(Collectors.toMap(PlaceType::getId, PlaceType::getCity));

        List<SubPlaceRes> list = p.getContent().stream()
                .map(pl -> SubPlaceRes.from(pl, parentCityMap.getOrDefault(pl.getParentId(), "Unknown")))
                .toList();

        return new Paginated<>(list, p.getTotalElements(), p.isLast());
    }

    @GetMapping("/{id}")
    public SubPlaceRes get(@PathVariable String id) {
        SubPlaceType p = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SubPlace not found"));

        String parentCity = "Unknown";
        if (p.getParentId() != null) {
            parentCity = placeRepo.findById(p.getParentId()).map(PlaceType::getCity).orElse("Unknown");
        }

        return SubPlaceRes.from(p, parentCity);
    }

    @PostMapping
    public SubPlaceRes create(@RequestBody SubPlaceReq req) {
        if (req.parentId() == null || req.parentId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Parent ID is required");
        }
        PlaceType parent = placeRepo.findById(req.parentId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Parent place not found"));

        SubPlaceType p = new SubPlaceType();
        p.setAddress(req.address());
        p.setLocation(req.location());
        p.setPickupInstructions(req.pickupInstructions());
        p.setParentId(req.parentId());
        // Prefer explicit target in request, otherwise inherit from parent
        if (req.target() != null && req.target().pos() != null && !req.target().pos().isBlank()) {
            p.setTarget(new SubPlaceType.TargetType(req.target().company(), req.target().pos()));
        } else if (parent.getTarget() != null && parent.getTarget().getPos() != null) {
            p.setTarget(new SubPlaceType.TargetType(parent.getTarget().getCompany(), parent.getTarget().getPos()));
        }
        // Server-managed timestamps
        Instant now = Instant.now();
        p.setCreatedAt(now);
        p.setUpdatedAt(now);

        SubPlaceType saved = repo.save(p);
        // Create response: include createdAt only
        return SubPlaceRes.from(saved, parent.getCity());
    }

    @PutMapping("/{id}")
    public SubPlaceRes update(@PathVariable String id, @RequestBody SubPlaceReq req) {
        SubPlaceType p = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SubPlace not found"));

        if (req.address() != null) {
            p.setAddress(req.address());
        }
        if (req.location() != null) {
            p.setLocation(req.location());
        }
        if (req.pickupInstructions() != null) {
            p.setPickupInstructions(req.pickupInstructions());
        }
        if (req.parentId() != null) {
            // Validate new parent
            if (!placeRepo.existsById(req.parentId())) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Parent place not found");
            }
            p.setParentId(req.parentId());
            // Inherit target scope from new parent
            PlaceType parent = placeRepo.findById(req.parentId()).orElse(null);
            if (parent != null && parent.getTarget() != null && parent.getTarget().getPos() != null) {
                p.setTarget(new SubPlaceType.TargetType(parent.getTarget().getCompany(), parent.getTarget().getPos()));
            }
        }
        // Allow explicit target update
        if (req.target() != null && req.target().pos() != null && !req.target().pos().isBlank()) {
            p.setTarget(new SubPlaceType.TargetType(req.target().company(), req.target().pos()));
        }
        // Server-managed timestamps
        p.setUpdatedAt(Instant.now());

        SubPlaceType saved = repo.save(p);

        String parentCity = "Unknown";
        if (saved.getParentId() != null) {
            parentCity = placeRepo.findById(saved.getParentId()).map(PlaceType::getCity).orElse("Unknown");
        }

        return SubPlaceRes.from(saved, parentCity);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable String id) {
        SubPlaceType p = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SubPlace not found"));
        repo.deleteById(id);
    }
}
