package com.eticketing.app.pos;

import com.eticketing.app.account.AccountTypeRepository;
import com.eticketing.app.common.AddressType;
import com.eticketing.app.common.LonLatType;
import com.eticketing.app.common.PictureType;
import com.eticketing.app.country.CountryRepository;
import com.eticketing.app.currency.CurrencyRepository;
import com.eticketing.app.state.StateRepository;
import com.eticketing.app.user.PhoneType;
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
 * Point of Sale CRUD controller.
 */
@RestController
@RequestMapping("/api/pos")
@Tag(name = "Point of Sale", description = "POS management")
public class PointOfSaleController {

    // Request/Response DTOs
    public record LonLatReq(Double lng, Double lat) {

    }

    public record AddressReq(String addressLine, String city, String stateId, String countryId, String zipCode, LonLatReq location) {

    }

    public record PictureReq(String baseUrl, String path) {

    }

    public record PosReq(
            String title,
            String subtitle,
            PictureReq picture,
            AddressReq location,
            PhoneType phone,
            String email,
            String currencyId,
            String emailTemplate
            ) {

    }

    public record CurrencyRes(String id, String name, String code, String iconFlag) {

    }

    public record CountryRes(String id, String name, String code, String flag) {

    }

    public record StateRes(String id, String name, String code) {

    }

    public record LonLatRes(Double lng, Double lat) {

    }

    public record AddressRes(String addressLine, String city, StateRes state, CountryRes country, String zipCode, LonLatRes location) {

    }

    public record PictureRes(String baseUrl, String path) {

    }

    public record PosRes(
            String id,
            String title,
            String subtitle,
            PictureRes picture,
            AddressRes location,
            PhoneType phone,
            String email,
            CurrencyRes currency,
            String emailTemplate,
            Instant createdAt,
            Instant updatedAt
            ) {

    }

    public record Paginated<T>(List<T> objects, long count, boolean isLast) {

    }

    private final PointOfSaleRepository repo;
    private final AccountTypeRepository accountRepo;
    private final CurrencyRepository currencyRepo;
    private final StateRepository stateRepo;
    private final CountryRepository countryRepo;

    public PointOfSaleController(
            PointOfSaleRepository repo,
            AccountTypeRepository accountRepo,
            CurrencyRepository currencyRepo,
            StateRepository stateRepo,
            CountryRepository countryRepo
    ) {
        this.repo = repo;
        this.accountRepo = accountRepo;
        this.currencyRepo = currencyRepo;
        this.stateRepo = stateRepo;
        this.countryRepo = countryRepo;
    }

    private AddressRes toAddressRes(AddressType addr) {
        if (addr == null) {
            return null;
        }

        StateRes stateRes = null;
        CountryRes countryRes = null;
        LonLatRes locationRes = null;

        if (addr.getStateId() != null) {
            stateRes = stateRepo.findById(addr.getStateId())
                    .map(s -> new StateRes(s.getId(), s.getName(), s.getCode()))
                    .orElse(null);
        }
        if (addr.getCountryId() != null) {
            countryRes = countryRepo.findById(addr.getCountryId())
                    .map(c -> new CountryRes(c.getId(), c.getName(), c.getCode(), c.getFlag()))
                    .orElse(null);
        }
        if (addr.getLocation() != null) {
            locationRes = new LonLatRes(addr.getLocation().getLng(), addr.getLocation().getLat());
        }

        return new AddressRes(addr.getAddressLine(), addr.getCity(), stateRes, countryRes, addr.getZipCode(), locationRes);
    }

    private PosRes toRes(PointOfSaleType pos) {
        CurrencyRes currencyRes = null;
        if (pos.getCurrencyId() != null) {
            currencyRes = currencyRepo.findById(pos.getCurrencyId())
                    .map(c -> new CurrencyRes(c.getId(), c.getName(), c.getCode(), c.getIconFlag()))
                    .orElse(null);
        }

        AddressRes locationRes = null;
        if (pos.getLocation() != null) {
            locationRes = toAddressRes(pos.getLocation());
        }

        PictureRes pictureRes = null;
        if (pos.getPicture() != null) {
            pictureRes = new PictureRes(pos.getPicture().getBaseUrl(), pos.getPicture().getPath());
        }

        return new PosRes(
                pos.getId(),
                pos.getTitle(),
                pos.getSubtitle(),
                pictureRes,
                locationRes,
                pos.getPhone(),
                pos.getEmail(),
                currencyRes,
                pos.getEmailTemplate(),
                pos.getCreatedAt(),
                pos.getUpdatedAt()
        );
    }

    private AddressType toAddressType(AddressReq req) {
        if (req == null) {
            return null;
        }

        LonLatType location = null;
        if (req.location() != null) {
            location = new LonLatType(req.location().lng(), req.location().lat());
        }

        return new AddressType(
                req.addressLine(),
                req.city(),
                req.stateId(),
                req.countryId(),
                req.zipCode(),
                location
        );
    }

    private PhoneType mergePhone(PhoneType existing, PhoneType req) {
        if (req == null) {
            return existing;
        }

        if (existing == null) {
            existing = new PhoneType();
        }

        if (req.getCountryCode() != null) {
            existing.setCountryCode(req.getCountryCode());
        }
        if (req.getNumber() != null) {
            existing.setNumber(req.getNumber());
        }

        return existing;
    }

    private PictureType mergePicture(PictureType existing, PictureReq req) {
        if (req == null) {
            return existing;
        }

        if (existing == null) {
            existing = new PictureType();
        }

        if (req.baseUrl() != null) {
            existing.setBaseUrl(req.baseUrl());
        }
        if (req.path() != null) {
            existing.setPath(req.path());
        }

        return existing;
    }

    private LonLatType mergeLonLat(LonLatType existing, LonLatReq req) {
        if (req == null) {
            return existing;
        }

        if (existing == null) {
            existing = new LonLatType();
        }

        if (req.lng() != null) {
            existing.setLng(req.lng());
        }
        if (req.lat() != null) {
            existing.setLat(req.lat());
        }

        return existing;
    }

    private AddressType mergeAddress(AddressType existing, AddressReq req) {
        if (req == null) {
            return existing;
        }

        if (existing == null) {
            existing = new AddressType();
        }

        if (req.addressLine() != null) {
            existing.setAddressLine(req.addressLine());
        }
        if (req.city() != null) {
            existing.setCity(req.city());
        }
        if (req.stateId() != null) {
            existing.setStateId(req.stateId());
        }
        if (req.countryId() != null) {
            existing.setCountryId(req.countryId());
        }
        if (req.zipCode() != null) {
            existing.setZipCode(req.zipCode());
        }

        if (req.location() != null) {
            existing.setLocation(mergeLonLat(existing.getLocation(), req.location()));
        }

        return existing;
    }

    @GetMapping
    @Operation(summary = "List all POS (paginated)")
    public Paginated<PosRes> list(
            @RequestParam(defaultValue = "") String searchString,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int limit) {
        Page<PointOfSaleType> p = (searchString == null || searchString.isBlank())
                ? repo.findAll(PageRequest.of(page, limit))
                : repo.findByTitleIgnoreCaseContaining(searchString, PageRequest.of(page, limit));
        // Fetch response: include both timestamps
        var list = p.getContent().stream().map(pos -> toRes(pos)).toList();
        return new Paginated<>(list, p.getTotalElements(), p.isLast());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get POS by ID")
    public PosRes get(@PathVariable String id) {
        // Fetch response: include both timestamps
        return repo.findById(id)
                .map(pos -> toRes(pos))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "POS not found"));
    }

    @PostMapping
    @Operation(summary = "Create a new POS")
    public ResponseEntity<PosRes> create(@RequestBody PosReq req) {
        if (req.title() == null || req.title().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "title is required");
        }

        PointOfSaleType pos = new PointOfSaleType();
        pos.setTitle(req.title());
        pos.setSubtitle(req.subtitle());
        pos.setCurrencyId(req.currencyId());
        pos.setPhone(req.phone());
        pos.setEmail(req.email());
        pos.setEmailTemplate(req.emailTemplate());
        // Server-managed timestamps
        Instant now = Instant.now();
        pos.setCreatedAt(now);
        pos.setUpdatedAt(now);

        if (req.picture() != null) {
            pos.setPicture(new PictureType(req.picture().baseUrl(), req.picture().path()));
        }
        if (req.location() != null) {
            pos.setLocation(toAddressType(req.location()));
        }

        // Create response: include createdAt only
        return ResponseEntity.status(HttpStatus.CREATED).body(toRes(repo.save(pos)));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a POS")
    public PosRes update(@PathVariable String id, @RequestBody PosReq req) {
        PointOfSaleType pos = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "POS not found"));

        if (req.title() != null) {
            pos.setTitle(req.title());
        }
        if (req.subtitle() != null) {
            pos.setSubtitle(req.subtitle());
        }
        if (req.currencyId() != null) {
            pos.setCurrencyId(req.currencyId());
        }
        if (req.phone() != null) {
            pos.setPhone(mergePhone(pos.getPhone(), req.phone()));
        }
        if (req.email() != null) {
            pos.setEmail(req.email());
        }
        if (req.emailTemplate() != null) {
            pos.setEmailTemplate(req.emailTemplate());
        }
        if (req.picture() != null) {
            pos.setPicture(mergePicture(pos.getPicture(), req.picture()));
        }
        if (req.location() != null) {
            pos.setLocation(mergeAddress(pos.getLocation(), req.location()));
        }
        // Server-managed timestamps
        pos.setUpdatedAt(Instant.now());

        return toRes(repo.save(pos));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a POS")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        // Delete related accounts first
        var accounts = accountRepo.findByTargetPosId(id);
        if (accounts != null && !accounts.isEmpty()) {
            accountRepo.deleteAll(accounts);
        }
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
