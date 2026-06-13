package com.eticketing.app.account;

import com.eticketing.app.company.CompanyRepository;
import com.eticketing.app.company.CompanyType;
import com.eticketing.app.company.BankAccountType;
import com.eticketing.app.company.ContactType;
import com.eticketing.app.company.CompanyStatus;
import com.eticketing.app.permission.PermissionDefinitionRepository;
import com.eticketing.app.permission.PermissionDefinitionType;
import com.eticketing.app.permission.PermissionRepository;
import com.eticketing.app.permission.PermissionType;
import com.eticketing.app.common.PictureType;
import com.eticketing.app.user.PhoneType;
import com.eticketing.app.user.UserType;
import com.eticketing.app.user.UserTypeRepository;
import com.eticketing.app.user.RoleEnum;
import com.eticketing.app.user.AppEnum;
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
import java.util.Optional;

import org.springframework.dao.IncorrectResultSizeDataAccessException;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Account management controller. Provides CRUD for accounts and the critical
 * /current endpoint for terminal login flow.
 */
@RestController
@RequestMapping("/api/accounts")
@Tag(name = "Accounts", description = "Account management (user-company-permission links)")
public class AccountsController {

    // ============ Request DTOs ============
    public record TargetReq(String companyId) {

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

    public record ContactRes(String email, PhoneRes phone) {

        static ContactRes from(ContactType c) {
            return c == null ? null : new ContactRes(c.getEmail(), PhoneRes.from(c.getPhone()));
        }
    }

    public record BankAccountRes(String iban, String bankName, String accountHolder) {

        static BankAccountRes from(BankAccountType b) {
            return b == null ? null : new BankAccountRes(b.getIban(), b.getBankName(), b.getAccountHolder());
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

    public record CompanyRes(
            String id,
            String name,
            String legalName,
            String taxId,
            CompanyStatus status,
            java.math.BigDecimal platformFeePercentage,
            String currencyId,
            String emailTemplate,
            PictureRes picture,
            BankAccountRes bankAccount,
            ContactRes contact,
            Instant createdAt,
            Instant updatedAt
            ) {

    }

    public record TargetRes(CompanyRes company) {

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
    private final PermissionRepository permissionRepo;
    private final PermissionDefinitionRepository permissionDefRepo;
    private final CompanyRepository companyRepo;
    private final PasswordEncoder passwordEncoder;

    public AccountsController(
            AccountTypeRepository accountRepo,
            UserTypeRepository userRepo,
            PermissionRepository permissionRepo,
            PermissionDefinitionRepository permissionDefRepo,
            CompanyRepository companyRepo,
            PasswordEncoder passwordEncoder
    ) {
        this.accountRepo = accountRepo;
        this.userRepo = userRepo;
        this.permissionRepo = permissionRepo;
        this.permissionDefRepo = permissionDefRepo;
        this.companyRepo = companyRepo;
        this.passwordEncoder = passwordEncoder;
    }

    private AccountRes toRes(AccountType acc) {
        // Build target response (full Company object)
        TargetRes targetRes = null;
        if (acc.getTarget() != null && acc.getTarget().getCompany() != null) {
            var companyRef = acc.getTarget().getCompany();
            CompanyType company = companyRef.getId() != null
                    ? companyRepo.findById(companyRef.getId()).orElse(null)
                    : null;

            if (company != null) {
                targetRes = new TargetRes(new CompanyRes(
                        company.getId(),
                        company.getName(),
                        company.getLegalName(),
                        company.getTaxId(),
                        company.getStatus(),
                        company.getPlatformFeePercentage(),
                        company.getCurrencyId(),
                        company.getEmailTemplate(),
                        PictureRes.from(company.getPicture()),
                        BankAccountRes.from(company.getBankAccount()),
                        ContactRes.from(company.getContact()),
                        company.getCreatedAt(),
                        company.getUpdatedAt()
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
     * GET /api/accounts/current Returns company-linked accounts for the
     * authenticated user. Used by terminal after login to get user's company
     * list and set active companyId.
     */
    @GetMapping("/current")
    @Operation(summary = "Get current user's company accounts (for terminal login flow)")
    public List<AccountRes> current(@AuthenticationPrincipal User principal) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        String userId = principal.getUsername();
        List<AccountType> accounts = accountRepo.findByUserIdWithCompanyTarget(userId);
        return accounts.stream()
                .filter(AccountsController::hasCompanyTarget)
                .map(this::toRes)
                .toList();
    }

    private static boolean hasCompanyTarget(AccountType account) {
        return account != null
                && account.getTarget() != null
                && account.getTarget().getCompany() != null
                && account.getTarget().getCompany().getId() != null
                && !account.getTarget().getCompany().getId().isBlank();
    }

    /**
     * GET /api/accounts/by-target?companyId=xxx Returns all accounts for a
     * specific company (for admin/management views).
     */
    @GetMapping("/by-target")
    @Operation(summary = "Get accounts by Company ID (admin view)")
    public Paginated<AccountRes> byTarget(
            @RequestParam String companyId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int limit) {
        Page<AccountType> p = accountRepo.findByTargetCompanyId(companyId, PageRequest.of(page, limit));
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
    @Operation(summary = "Create a new account (link user to company with permission)")
    public ResponseEntity<AccountRes> create(@RequestBody AccountReq req) {
        if (req.userId() == null || req.userId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId is required");
        }
        if (req.target() == null || req.target().companyId() == null || req.target().companyId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "target.companyId is required");
        }

        // Verify user exists
        UserType user = userRepo.findById(req.userId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        // Verify company exists and build embedded ref
        CompanyType company = companyRepo.findById(req.target().companyId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Company not found"));

        boolean alreadyAssigned = accountRepo.findByUserId(user.getId()).stream()
                .anyMatch(acc -> acc.getTarget() != null
                && acc.getTarget().getCompany() != null
                && req.target().companyId().equals(acc.getTarget().getCompany().getId()));
        if (alreadyAssigned) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User already has an account with this company");
        }

        // Verify permission exists (optional)
        if (req.permissionId() != null && !req.permissionId().isBlank()) {
            permissionRepo.findById(req.permissionId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Permission not found"));
        }

        // Store only the company reference in account target
        AccountType account = new AccountType();
        account.setUserId(req.userId());
        account.setPermissionId(req.permissionId());
        account.setTarget(new AccountType.TargetType(company));
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

        // If target.companyId changed, update the embedded company ref
        if (req.target() != null && req.target().companyId() != null) {
            CompanyType company = companyRepo.findById(req.target().companyId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Company not found"));
            account.setTarget(new AccountType.TargetType(company));
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

    // ============ Add Target to Account ============
    public record AddTargetReq(String companyId, String permissionId) {

    }

    @PostMapping("/{id}/target")
    @Operation(summary = "Create a new account for the same user with the specified company and permission")
    public ResponseEntity<AccountRes> addTargetToAccount(@PathVariable String id, @RequestBody AddTargetReq req) {
        // Find the source account to get the userId
        AccountType sourceAccount = accountRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));

        if (req.companyId() == null || req.companyId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "companyId is required");
        }

        // Verify company exists
        CompanyType company = companyRepo.findById(req.companyId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Company not found"));

        // Check if user already has an account with this company
        String userId = sourceAccount.getUserId();
        List<AccountType> existingAccounts = accountRepo.findByUserId(userId);
        boolean alreadyAssigned = existingAccounts.stream()
                .anyMatch(acc -> acc.getTarget() != null
                && acc.getTarget().getCompany() != null
                && req.companyId().equals(acc.getTarget().getCompany().getId()));
        if (alreadyAssigned) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User already has an account with this company");
        }

        // Verify permission if provided
        String permissionId = null;
        if (req.permissionId() != null && !req.permissionId().isBlank()) {
            permissionRepo.findById(req.permissionId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Permission not found"));
            permissionId = req.permissionId();
        }

        // Create a NEW account for the same user with the new company
        AccountType newAccount = new AccountType();
        newAccount.setUserId(userId);
        newAccount.setPermissionId(permissionId);
        newAccount.setTarget(new AccountType.TargetType(company));
        Instant now = Instant.now();
        newAccount.setCreatedAt(now);
        newAccount.setUpdatedAt(now);

        return ResponseEntity.status(HttpStatus.CREATED).body(toRes(accountRepo.save(newAccount)));
    }

    // ============ Register Account For Target (Create User + Account in one call) ============
    public record PhoneReq(String countryCode, String number) {

    }

    public record PictureReq(String baseUrl, String path) {

    }

    public record RegisterAccountForTargetReq(
            String firstName,
            String lastName,
            String email,
            PhoneReq phone,
            String password,
            String role,
            String companyId,
            String permissionId,
            PictureReq picture
            ) {

    }

    @PostMapping("/register-for-target")
    @Operation(summary = "Create a new user and account for the specified company in one call")
    public ResponseEntity<AccountRes> registerAccountForTarget(@RequestBody RegisterAccountForTargetReq req) {
        // Validate required fields
        if (req.firstName() == null || req.firstName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "firstName is required");
        }
        if (req.lastName() == null || req.lastName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "lastName is required");
        }
        if (req.email() == null || req.email().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "email is required");
        }
        if (req.password() == null || req.password().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "password is required");
        }
        if (req.companyId() == null || req.companyId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "companyId is required");
        }
        if (req.phone() == null
                || req.phone().countryCode() == null || req.phone().countryCode().isBlank()
                || req.phone().number() == null || req.phone().number().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "phone is required");
        }

        // Verify company exists
        CompanyType company = companyRepo.findById(req.companyId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Company not found"));

        // Verify permission if provided
        String permissionId = null;
        if (req.permissionId() != null && !req.permissionId().isBlank()) {
            permissionRepo.findById(req.permissionId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Permission not found"));
            permissionId = req.permissionId();
        }

        RoleEnum targetRole;
        try {
            targetRole = req.role() != null ? RoleEnum.valueOf(req.role()) : RoleEnum.MANAGER;
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "role is invalid");
        }

        Optional<UserType> existingByEmail;
        try {
            existingByEmail = userRepo.findByEmailAndApp(req.email().trim(), AppEnum.TERMINAL);
        } catch (IncorrectResultSizeDataAccessException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
        }

        Optional<UserType> existingByPhone = userRepo.findByPhone_CountryCodeAndPhone_Number(
                req.phone().countryCode(),
                req.phone().number()
        );

        if (existingByEmail.isPresent() && existingByPhone.isPresent()
                && !existingByEmail.get().getId().equals(existingByPhone.get().getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email and phone belong to different users");
        }

        UserType existingUser = existingByEmail.orElseGet(() -> existingByPhone.orElse(null));

        if (existingUser != null) {
            if (existingUser.getRole() != targetRole) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "A user with this contact already exists with a different role");
            }

            boolean alreadyAssigned = accountRepo.findByUserId(existingUser.getId()).stream()
                    .anyMatch(acc -> acc.getTarget() != null
                    && acc.getTarget().getCompany() != null
                    && req.companyId().equals(acc.getTarget().getCompany().getId()));
            if (alreadyAssigned) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "User already has an account with this company");
            }

            if (req.picture() != null) {
                existingUser.setPicture(new PictureType(req.picture().baseUrl(), req.picture().path()));
                existingUser.setUpdatedAt(Instant.now());
                existingUser = userRepo.save(existingUser);
            }

            Instant now = Instant.now();
            AccountType account = new AccountType();
            account.setUserId(existingUser.getId());
            account.setPermissionId(permissionId);
            account.setTarget(new AccountType.TargetType(company));
            account.setCreatedAt(now);
            account.setUpdatedAt(now);

            return ResponseEntity.status(HttpStatus.CREATED).body(toRes(accountRepo.save(account)));
        }

        // Step 1: Create the user
        UserType user = new UserType();
        user.setFirstName(req.firstName());
        user.setLastName(req.lastName());
        user.setEmail(req.email().trim());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setRole(targetRole);
        user.setApp(AppEnum.TERMINAL);
        user.setTarget(new UserType.TargetType(req.companyId(), null));
        user.setPhone(new PhoneType(req.phone().countryCode(), req.phone().number()));
        if (req.picture() != null) {
            user.setPicture(new PictureType(req.picture().baseUrl(), req.picture().path()));
        }
        Instant now = Instant.now();
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        UserType savedUser = userRepo.save(user);

        // Step 2: Create account linking user to company
        AccountType account = new AccountType();
        account.setUserId(savedUser.getId());
        account.setPermissionId(permissionId);
        account.setTarget(new AccountType.TargetType(company));
        account.setCreatedAt(now);
        account.setUpdatedAt(now);

        return ResponseEntity.status(HttpStatus.CREATED).body(toRes(accountRepo.save(account)));
    }
}
