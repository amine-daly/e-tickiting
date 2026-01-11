package com.eticketing.app.subplace;

import com.eticketing.app.place.PlaceRepository;
import com.eticketing.app.place.PlaceType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/sub-places")
public class SubPlaceController {

    private final PlaceRepository repo;

    public SubPlaceController(PlaceRepository repo) {
        this.repo = repo;
    }

    public record Paginated<T>(List<T> objects, long count, boolean isLast) {

    }

    @GetMapping
    public Paginated<SubPlaceRes> list(
            @RequestParam(defaultValue = "") String searchString,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int limit) {

        Page<PlaceType> p;
        if (searchString != null && !searchString.isBlank()) {
            p = repo.findByKindAndCityIgnoreCaseContainingOrKindAndAddressIgnoreCaseContaining(
                    PlaceType.PlaceKind.POINT, searchString,
                    PlaceType.PlaceKind.POINT, searchString,
                    PageRequest.of(page, limit));
        } else {
            p = repo.findByKind(PlaceType.PlaceKind.POINT, PageRequest.of(page, limit));
        }

        // Fetch parent cities
        List<String> parentIds = p.getContent().stream()
                .map(PlaceType::getParentId)
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();

        Map<String, String> parentCityMap = repo.findAllById(parentIds).stream()
                .collect(Collectors.toMap(PlaceType::getId, PlaceType::getCity));

        List<SubPlaceRes> list = p.getContent().stream()
                .map(pl -> SubPlaceRes.from(pl, parentCityMap.getOrDefault(pl.getParentId(), "Unknown")))
                .toList();

        return new Paginated<>(list, p.getTotalElements(), p.isLast());
    }

    @GetMapping("/{id}")
    public SubPlaceRes get(@PathVariable String id) {
        PlaceType p = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SubPlace not found"));

        if (p.getKind() != PlaceType.PlaceKind.POINT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Requested place is not a SubPlace (POINT)");
        }

        String parentCity = "Unknown";
        if (p.getParentId() != null) {
            parentCity = repo.findById(p.getParentId()).map(PlaceType::getCity).orElse("Unknown");
        }

        return SubPlaceRes.from(p, parentCity);
    }

    @PostMapping
    public SubPlaceRes create(@RequestBody SubPlaceReq req) {
        if (req.parentId() == null || req.parentId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Parent ID is required");
        }
        PlaceType parent = repo.findById(req.parentId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Parent place not found"));

        PlaceType p = new PlaceType();
        p.setKind(PlaceType.PlaceKind.POINT);
        p.setAddress(req.address());
        p.setLocation(req.location());
        p.setPickupInstructions(req.pickupInstructions());
        p.setIsDefault(req.isDefault());
        p.setParentId(req.parentId());
        // Do not set City/State/Country on POINT, they inherit or are irrelevant.

        PlaceType saved = repo.save(p);
        return SubPlaceRes.from(saved, parent.getCity());
    }

    @PutMapping("/{id}")
    public SubPlaceRes update(@PathVariable String id, @RequestBody SubPlaceReq req) {
        PlaceType p = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SubPlace not found"));

        if (p.getKind() != PlaceType.PlaceKind.POINT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Requested place is not a SubPlace");
        }

        if (req.address() != null) {
            p.setAddress(req.address());
        }
        if (req.location() != null) {
            p.setLocation(req.location());
        }
        if (req.pickupInstructions() != null) {
            p.setPickupInstructions(req.pickupInstructions());
        }
        if (req.isDefault() != null) {
            p.setIsDefault(req.isDefault());
        }
        if (req.parentId() != null) {
            // Validate new parent
            if (!repo.existsById(req.parentId())) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Parent place not found");
            }
            p.setParentId(req.parentId());
        }

        PlaceType saved = repo.save(p);

        String parentCity = "Unknown";
        if (saved.getParentId() != null) {
            parentCity = repo.findById(saved.getParentId()).map(PlaceType::getCity).orElse("Unknown");
        }

        return SubPlaceRes.from(saved, parentCity);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable String id) {
        PlaceType p = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SubPlace not found"));
        if (p.getKind() != PlaceType.PlaceKind.POINT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Requested place is not a SubPlace");
        }
        repo.deleteById(id);
    }
}
