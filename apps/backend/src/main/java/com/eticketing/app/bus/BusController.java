package com.eticketing.app.bus;

import com.eticketing.app.common.MediaMapper;
import com.eticketing.app.common.MediaType;
import com.eticketing.app.common.PictureType;
import com.eticketing.app.common.TargetInput;
import com.eticketing.app.web.PaginateResponseType;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * REST controller for Bus fleet management. All list operations are scoped by
 * {@code target.pos}.
 */
@RestController
@RequestMapping("/api/buses")
@RequiredArgsConstructor
@Tag(name = "Buses", description = "Bus fleet management (scoped by target.pos)")
public class BusController {

    private final BusService busService;

    /* ═══════ Request DTOs ═══════ */
    public record TargetReq(
            @NotBlank String pos
            ) {

    }

    public record PictureReq(
            @NotBlank String baseUrl,
            @NotBlank String path
            ) {

    }

    public record MediaReq(
            List<PictureReq> pictures
            ) {

    }

    public record BusCreateReq(
            @NotBlank String name,
            @NotNull
            @Valid TargetReq target,
            @Min(1) int totalSeats,
            List<AmenityEnum> amenities,
            MediaReq media
            ) {

    }

    public record BusUpdateReq(
            String name,
            @Min(1) Integer totalSeats,
            List<AmenityEnum> amenities,
            MediaReq media
            ) {

    }

    /* ═══════ Response DTOs ═══════ */
    public record TargetRes(String pos) {

        static TargetRes from(TargetInput t) {
            return t == null ? null : new TargetRes(t.getPos());
        }
    }

    public record PictureRes(String baseUrl, String path) {

        static PictureRes from(PictureType p) {
            return new PictureRes(p.getBaseUrl(), p.getPath());
        }
    }

    public record MediaRes(List<PictureRes> pictures) {

        static MediaRes from(MediaType m) {
            return new MediaRes(MediaMapper.picturesOrEmpty(m).stream().map(PictureRes::from).toList());
        }
    }

    public record BusRes(
            String id,
            String name,
            TargetRes target,
            int totalSeats,
            List<AmenityEnum> amenities,
            MediaRes media,
            Instant createdAt,
            Instant updatedAt
            ) {

        static BusRes from(BusType bus) {
            return new BusRes(
                    bus.getId(),
                    bus.getName(),
                    TargetRes.from(bus.getTarget()),
                    bus.getTotalSeats(),
                    bus.getAmenities(),
                    MediaRes.from(bus.getMedia()),
                    bus.getCreatedAt(),
                    bus.getUpdatedAt()
            );
        }
    }

    /* ═══════ Endpoints ═══════ */
    @GetMapping
    @Operation(summary = "List buses by POS", description = "Paginated list scoped by target.pos")
    public PaginateResponseType<BusRes> list(
            @RequestParam String posId,
            @RequestParam(defaultValue = "") String searchString,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int limit) {

        var result = busService.list(posId, searchString, page, limit);
        var items = result.getContent().stream().map(BusRes::from).toList();
        return new PaginateResponseType<>(items, result.getTotalElements(), result.isLast());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get bus by ID")
    public BusRes getById(@PathVariable String id) {
        return BusRes.from(busService.getById(id));
    }

    @GetMapping("/{id}/locked")
    @Operation(summary = "Check if bus seat count is locked",
            description = "Returns true when the bus is assigned to a SCHEDULED or ACTIVE trip")
    public Map<String, Boolean> isLocked(@PathVariable String id) {
        return Map.of("locked", busService.isBusInActiveTrip(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a new bus")
    public BusRes create(@Valid @RequestBody BusCreateReq req) {
        return BusRes.from(busService.create(toEntity(req)));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update an existing bus", description = "Partial update: only provided fields are changed")
    public BusRes update(@PathVariable String id, @Valid @RequestBody BusUpdateReq req) {
        return BusRes.from(busService.update(id, req));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete a bus")
    public void delete(@PathVariable String id) {
        busService.delete(id);
    }

    /* ═══════ Mapping helpers ═══════ */
    private BusType toEntity(BusCreateReq req) {
        return BusType.builder()
                .name(req.name())
                .target(new TargetInput(req.target().pos()))
                .totalSeats(req.totalSeats())
                .amenities(req.amenities() != null ? req.amenities() : List.of())
                .media(toMedia(req.media()))
                .build();
    }

    private MediaType toMedia(MediaReq req) {
        if (req == null || req.pictures() == null) {
            return MediaMapper.fromPictures(List.of());
        }
        var pics = req.pictures().stream()
                .map(p -> new PictureType(p.baseUrl(), p.path()))
                .toList();
        return MediaMapper.fromPictures(pics);
    }
}
