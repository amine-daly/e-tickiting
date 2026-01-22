package com.eticketing.app.account;

import com.eticketing.app.country.CountryRepository;
import com.eticketing.app.country.CountryType;
import com.eticketing.app.currency.CurrencyRepository;
import com.eticketing.app.currency.CurrencyType;
import com.eticketing.app.permission.PermissionDefinitionRepository;
import com.eticketing.app.permission.PermissionDefinitionType;
import com.eticketing.app.permission.PermissionRepository;
import com.eticketing.app.permission.PermissionType;
import com.eticketing.app.pos.PointOfSaleRepository;
import com.eticketing.app.pos.PointOfSaleType;
import com.eticketing.app.state.StateRepository;
import com.eticketing.app.state.StateType;
import com.eticketing.app.common.AddressType;
import com.eticketing.app.common.LonLatType;
import com.eticketing.app.common.PictureType;
import com.eticketing.app.user.PhoneType;
import com.eticketing.app.user.UserType;
import com.eticketing.app.user.UserTypeRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.User;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Account management controller. Provides CRUD for accounts and the critical
 * /current endpoint for terminal login flow.
 */
@RestController
@RequestMapping("/api/accounts")
@Tag(name = "Accounts", description = "Account management (user-POS-permission links)")
public class AccountsController {

    // ============ Request DTOs ============
    public record TargetReq(String posId) {

    }

    public record AccountReq(String userId, String permissionId, TargetReq target) {

    }

    // ============ Response DTOs (Full Objects) ============
    // Phone
    public record PhoneRes(String countryCode, String number) {

        static PhoneRes from(PhoneType p) {
            return p == null ? null : new PhoneRes(p.getCountryCode(), p.getNumber());
        }
    }

    // Picture
    public record PictureRes(String baseUrl, String path) {

        static PictureRes from(PictureType p) {
            return p == null ? null : new PictureRes(p.getBaseUrl(), p.getPath());
        }
    }

    // Address with expanded state and country
    public record StateRes(String id, String name, String code) {

        static StateRes from(StateType s) {
            return s == null ? null : new StateRes(s.getId(), s.getName(), s.getCode());
        }
    }

    public record CountryRes(String id, String name, String code, String flag) {

        static CountryRes from(CountryType c) {
            return c == null ? null : new CountryRes(c.getId(), c.getName(), c.getCode(), c.getFlag());
        }
    }

    public record CurrencyRes(String id, String name, String code, String iconFlag) {

        static CurrencyRes from(CurrencyType c) {
            return c == null ? null : new CurrencyRes(c.getId(), c.getName(), c.getCode(), c.getIconFlag());
        }
    }

    public record LonLatRes(Double lng, Double lat) {

        static LonLatRes from(LonLatType l) {
            return l == null ? null : new LonLatRes(l.getLng(), l.getLat());
        }
    }

    public record AddressRes(String addressLine, String city, StateRes state, CountryRes country, String zipCode, LonLatRes location) {

        static AddressRes from(AddressType a, StateType state, CountryType country) {
            if (a == null) {
                return null;
            }
            return new AddressRes(a.getAddressLine(), a.getCity(), StateRes.from(state), CountryRes.from(country), a.getZipCode(), LonLatRes.from(a.getLocation()));
        }
    }

    // Permission Definition
    public record PermissionDefinitionRes(String id, String name, String code) {

        static PermissionDefinitionRes from(PermissionDefinitionType d) {
            return d == null ? null : new PermissionDefinitionRes(d.getId(), d.getName(), d.getCode());
        }
    }

    // Permission Grant (with expanded definition)
    public record PermissionGrantRes(PermissionDefinitionRes permission, Boolean read, Boolean create, Boolean update) {

    }

    // Permission (full object with grants)
    public record PermissionRes(String id, String name, List<PermissionGrantRes> permissions) {

    }

    // POS (full object with expanded state/country/currency)
    public record PosRes(
            String id,
            String title,
            PictureRes picture,
            AddressRes location,
            PhoneRes phone,
            String email,
            String emailTemplate,
            CurrencyRes currency,
            Instant createdAt,
            Instant updatedAt
            ) {

    }

    public record TargetRes(PosRes pos) {

    }

    // User (full object with phone and picture)
    public record UserRes(
            String id,
            String email,
            String firstName,
            String lastName,
            String role,
            PhoneRes phone,
            PictureRes picture
            ) {

    }

    public record AccountRes(String id, TargetRes target, PermissionRes permission, UserRes user, Instant createdAt, Instant updatedAt) {

        static AccountRes from(AccountRes base) {
            return new AccountRes(
                    base.id(),
                    base.target(),
                    base.permission(),
                    base.user(),
                    base.createdAt(),
                    base.updatedAt()
            );
        }
    }

    public record Paginated<T>(List<T> objects, long count, boolean isLast) {

    }

    private final AccountTypeRepository accountRepo;
    private final UserTypeRepository userRepo;
    private final PointOfSaleRepository posRepo;
    private final PermissionRepository permissionRepo;
    private final PermissionDefinitionRepository permissionDefRepo;
    private final StateRepository stateRepo;
    private final CountryRepository countryRepo;
    private final CurrencyRepository currencyRepo;

    public AccountsController(
            AccountTypeRepository accountRepo,
            UserTypeRepository userRepo,
            PointOfSaleRepository posRepo,
            PermissionRepository permissionRepo,
            PermissionDefinitionRepository permissionDefRepo,
            StateRepository stateRepo,
            CountryRepository countryRepo,
            CurrencyRepository currencyRepo
    ) {
        this.accountRepo = accountRepo;
        this.userRepo = userRepo;
        this.posRepo = posRepo;
        this.permissionRepo = permissionRepo;
        this.permissionDefRepo = permissionDefRepo;
        this.stateRepo = stateRepo;
        this.countryRepo = countryRepo;
        this.currencyRepo = currencyRepo;
    }

    private AccountRes toRes(AccountType acc) {
        // Build target response (full POS object with expanded state/country/currency)
        TargetRes targetRes = null;
        if (acc.getTarget() != null && acc.getTarget().getPos() != null) {
            var embeddedPos = acc.getTarget().getPos();
            // Prefer authoritative POS from DB if available
            PointOfSaleType fullPos = embeddedPos.getId() != null ? posRepo.findById(embeddedPos.getId()).orElse(null) : null;
            PointOfSaleType posToUse = fullPos != null ? fullPos : embeddedPos;
            if (posToUse != null) {
                AddressRes locationRes = null;
                if (posToUse.getLocation() != null) {
                    AddressType loc = posToUse.getLocation();
                    StateType state = loc.getStateId() != null ? stateRepo.findById(loc.getStateId()).orElse(null) : null;
                    CountryType country = loc.getCountryId() != null ? countryRepo.findById(loc.getCountryId()).orElse(null) : null;
                    locationRes = AddressRes.from(loc, state, country);
                }
                CurrencyType currency = posToUse.getCurrencyId() != null ? currencyRepo.findById(posToUse.getCurrencyId()).orElse(null) : null;

                targetRes = new TargetRes(new PosRes(
                        posToUse.getId(),
                        posToUse.getTitle(),
                        PictureRes.from(posToUse.getPicture()),
                        locationRes,
                        PhoneRes.from(posToUse.getPhone()),
                        posToUse.getEmail(),
                        posToUse.getEmailTemplate(),
                        CurrencyRes.from(currency),
                        posToUse.getCreatedAt(),
                        posToUse.getUpdatedAt()
                ));
            }
        }

        // Build permission response (full object with grants)
        PermissionRes permRes = null;
        if (acc.getPermissionId() != null) {
            permRes = permissionRepo.findById(acc.getPermissionId())
                    .map(p -> {
                        List<PermissionGrantRes> grants = new ArrayList<>();
                        if (p.getPermissions() != null) {
                            for (PermissionType.PermissionGrant g : p.getPermissions()) {
                                PermissionDefinitionRes defRes = null;
                                if (g.getPermission() != null) {
                                    defRes = permissionDefRepo.findById(g.getPermission())
                                            .map(PermissionDefinitionRes::from)
                                            .orElse(new PermissionDefinitionRes(g.getPermission(), null, null));
                                }
                                grants.add(new PermissionGrantRes(defRes, g.getRead(), g.getCreate(), g.getUpdate()));
                            }
                        }
                        return new PermissionRes(p.getId(), p.getName(), grants);
                    })
                    .orElse(new PermissionRes(acc.getPermissionId(), null, List.of()));
        }

        // Build user response (full object with phone and picture)
        UserRes userRes = null;
        if (acc.getUserId() != null) {
            userRes = userRepo.findById(acc.getUserId())
                    .map(u -> new UserRes(
                    u.getId(),
                    u.getEmail(),
                    u.getFirstName(),
                    u.getLastName(),
                    u.getRole() != null ? u.getRole().name() : null,
                    PhoneRes.from(u.getPhone()),
                    PictureRes.from(u.getPicture())
            ))
                    .orElse(null);
        }

        return new AccountRes(
                acc.getId(),
                targetRes,
                permRes,
                userRes,
                acc.getCreatedAt(),
                acc.getUpdatedAt()
        );
    }

    /**
     * GET /api/accounts/current Returns all accounts for the authenticated
     * user. Used by terminal after login to get user's POS list and set active
     * posId.
     */
    @GetMapping("/current")
    @Operation(summary = "Get current user's accounts (for terminal login flow)")
    public List<AccountRes> current(@AuthenticationPrincipal User principal) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        String userId = principal.getUsername();
        List<AccountType> accounts = accountRepo.findByUserId(userId);
        // Fetch response: include both timestamps
        return accounts.stream().map(acc -> toRes(acc)).toList();
    }

    /**
     * GET /api/accounts/by-target?posId=xxx Returns all accounts for a specific
     * POS (for admin/management views).
     */
    @GetMapping("/by-target")
    @Operation(summary = "Get accounts by POS ID (admin view)")
    public Paginated<AccountRes> byTarget(
            @RequestParam String posId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int limit) {
        Page<AccountType> p = accountRepo.findByTargetPosId(posId, PageRequest.of(page, limit));
        // Fetch response: include both timestamps
        var list = p.getContent().stream().map(acc -> toRes(acc)).toList();
        return new Paginated<>(list, p.getTotalElements(), p.isLast());
    }

    @GetMapping
    @Operation(summary = "List all accounts (admin)")
    public Paginated<AccountRes> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int limit) {
        Page<AccountType> p = accountRepo.findAll(PageRequest.of(page, limit));
        // Fetch response: include both timestamps
        var list = p.getContent().stream().map(acc -> toRes(acc)).toList();
        return new Paginated<>(list, p.getTotalElements(), p.isLast());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get account by ID")
    public AccountRes get(@PathVariable String id) {
        // Fetch response: include both timestamps
        return accountRepo.findById(id)
                .map(acc -> toRes(acc))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));
    }

    @PostMapping
    @Operation(summary = "Create a new account (link user to POS with permission)")
    public ResponseEntity<AccountRes> create(@RequestBody AccountReq req) {
        if (req.userId() == null || req.userId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId is required");
        }
        if (req.target() == null || req.target().posId() == null || req.target().posId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "target.posId is required");
        }

        // Verify user exists
        UserType user = userRepo.findById(req.userId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        // Verify POS exists and build embedded ref
        PointOfSaleType pos = posRepo.findById(req.target().posId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "POS not found"));

        // Verify permission exists (optional)
        if (req.permissionId() != null && !req.permissionId().isBlank()) {
            permissionRepo.findById(req.permissionId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Permission not found"));
        }

        // Embed full POS object into account target
        AccountType account = new AccountType();
        account.setUserId(req.userId());
        account.setPermissionId(req.permissionId());
        account.setTarget(new AccountType.TargetType(pos));
        // Server-managed timestamps
        Instant now = Instant.now();
        account.setCreatedAt(now);
        account.setUpdatedAt(now);

        // Create response: include createdAt only
        return ResponseEntity.status(HttpStatus.CREATED).body(toRes(accountRepo.save(account)));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update an account")
    public AccountRes update(@PathVariable String id, @RequestBody AccountReq req) {
        AccountType account = accountRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));

        if (req.permissionId() != null) {
            account.setPermissionId(req.permissionId());
        }

        // If target.posId changed, update the embedded POS ref
        if (req.target() != null && req.target().posId() != null) {
            PointOfSaleType pos = posRepo.findById(req.target().posId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "POS not found"));
            account.setTarget(new AccountType.TargetType(pos));
        }

        // Server-managed timestamps
        account.setUpdatedAt(Instant.now());

        return toRes(accountRepo.save(account));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete an account")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        accountRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
