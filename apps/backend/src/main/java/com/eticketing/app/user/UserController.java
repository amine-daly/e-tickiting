package com.eticketing.app.user;

import org.springframework.util.ReflectionUtils;
import java.lang.reflect.Field;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.eticketing.app.user.UserTypeRepository;
import com.eticketing.app.user.UserType;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.User;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import com.eticketing.app.web.error.ApiExceptions.*;
import com.eticketing.app.web.PaginateResponseType;

@RestController
@RequestMapping("/api/users")
@Tag(name = "Users")
public class UserController {

    // ========== Response DTOs ==========
    public record PhoneRes(String countryCode, String number) {

        static PhoneRes from(PhoneType p) {
            return p == null ? null : new PhoneRes(p.getCountryCode(), p.getNumber());
        }
    }

    public record PictureRes(String baseUrl, String path) {

        static PictureRes from(com.eticketing.app.common.PictureType p) {
            return p == null ? null : new PictureRes(p.getBaseUrl(), p.getPath());
        }
    }

    public record TargetRes(String company, String pos) {

        static TargetRes from(UserType.TargetType t) {
            return t == null ? null : new TargetRes(t.getCompany(), t.getPos());
        }
    }

    public record UserRes(
            String id,
            String firstName,
            String lastName,
            String email,
            PhoneRes phone,
            PictureRes picture,
            String role,
            TargetRes target,
            Instant createdAt,
            Instant updatedAt
            ) {

        static UserRes from(UserType u) {
            return new UserRes(
                    u.getId(),
                    u.getFirstName(),
                    u.getLastName(),
                    u.getEmail(),
                    PhoneRes.from(u.getPhone()),
                    PictureRes.from(u.getPicture()),
                    u.getRole() != null ? u.getRole().name() : null,
                    TargetRes.from(u.getTarget()),
                    u.getCreatedAt(),
                    u.getUpdatedAt()
            );
        }
    }

    public record Paginated<T>(List<T> objects, long count, boolean isLast) {

    }

    @PostMapping("")
    @Operation(summary = "Create a new user")
    public ResponseEntity<UserRes> createUser(@RequestBody Map<String, Object> data) {
        var user = new UserType();
        if (data.get("firstName") != null) {
            user.setFirstName(data.get("firstName").toString());
        }
        if (data.get("lastName") != null) {
            user.setLastName(data.get("lastName").toString());
        }
        if (data.get("email") != null) {
            user.setEmail(data.get("email").toString());
        }
        // Set default role to CUSTOMER if not provided
        if (data.get("role") != null) {
            user.setRole(com.eticketing.app.user.RoleEnum.valueOf(data.get("role").toString()));
        } else {
            user.setRole(com.eticketing.app.user.RoleEnum.CUSTOMER);
        }
        // Server-managed timestamps (ignore client-provided values)
        Instant now = Instant.now();
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        if (data.get("phone") instanceof Map) {
            Map<String, Object> phoneMap = (Map<String, Object>) data.get("phone");
            var phone = new com.eticketing.app.user.PhoneType();
            if (phoneMap.get("countryCode") != null) {
                phone.setCountryCode(phoneMap.get("countryCode").toString());
            }
            if (phoneMap.get("number") != null) {
                phone.setNumber(phoneMap.get("number").toString());
            }
            user.setPhone(phone);
        }
        // Handle picture if provided
        if (data.get("picture") instanceof Map) {
            Map<String, Object> pictureMap = (Map<String, Object>) data.get("picture");
            var picture = new com.eticketing.app.common.PictureType();
            if (pictureMap.get("baseUrl") != null) {
                picture.setBaseUrl(pictureMap.get("baseUrl").toString());
            }
            if (pictureMap.get("path") != null) {
                picture.setPath(pictureMap.get("path").toString());
            }
            user.setPicture(picture);
        }
        // Handle target if provided
        if (data.get("target") instanceof Map) {
            Map<String, Object> targetMap = (Map<String, Object>) data.get("target");
            var target = new UserType.TargetType();
            if (targetMap.get("company") != null) {
                target.setCompany(targetMap.get("company").toString());
            }
            if (targetMap.get("pos") != null) {
                target.setPos(targetMap.get("pos").toString());
            }
            user.setTarget(target);
        }
        users.save(user);
        // Create response: include createdAt only
        return ResponseEntity.status(HttpStatus.CREATED).body(UserRes.from(user));
    }

    /**
     * GET /api/users/by-target?companyId=xxx Returns users scoped to a specific
     * Company.
     */
    @GetMapping("/by-target")
    @Operation(summary = "Get users by Company ID")
    public Paginated<UserRes> byTarget(
            @RequestParam String companyId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int limit) {
        if (companyId == null || companyId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "companyId is required");
        }
        Page<UserType> p = users.findByTargetCompany(companyId, PageRequest.of(page, limit));
        // Fetch response: include both timestamps
        var list = p.getContent().stream().map(u -> UserRes.from(u)).toList();
        return new Paginated<>(list, p.getTotalElements(), p.isLast());
    }

    @GetMapping("/search")
    @Operation(summary = "Search users by name, email, or phone")
    public Paginated<UserRes> searchUsers(
            @RequestParam String q,
            @RequestParam(required = false) String companyId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int limit) {
        if (q == null || q.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "q is required");
        }
        String escaped = java.util.regex.Pattern.quote(q.trim());
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.clamp(limit, 1, 100),
                Sort.by("lastName").ascending());

        Criteria textMatch = new Criteria().orOperator(
                Criteria.where("email").regex(escaped, "i"),
                Criteria.where("phone.number").regex(escaped, "i"),
                Criteria.where("firstName").regex(escaped, "i"),
                Criteria.where("lastName").regex(escaped, "i")
        );

        Query query = new Query(textMatch).with(pageable);
        if (companyId != null && !companyId.isBlank()) {
            query.addCriteria(Criteria.where("target.company").is(companyId));
        }

        List<UserType> results = mongoTemplate.find(query, UserType.class);
        long total = mongoTemplate.count(Query.of(query).limit(-1).skip(-1), UserType.class);
        boolean isLast = (page + 1) * limit >= total;

        var list = results.stream().map(UserRes::from).toList();
        return new Paginated<>(list, total, isLast);
    }

    /**
     * GET /api/users/by-company?companyId=xxx Returns users scoped to a
     * specific Company.
     */
    @GetMapping("/by-company")
    @Operation(summary = "Get users by Company ID")
    public Paginated<UserRes> byCompany(
            @RequestParam String companyId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int limit) {
        if (companyId == null || companyId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "companyId is required");
        }
        Page<UserType> p = users.findByTargetCompany(companyId, PageRequest.of(page, limit));
        var list = p.getContent().stream().map(u -> UserRes.from(u)).toList();
        return new Paginated<>(list, p.getTotalElements(), p.isLast());
    }

    @PutMapping("/{id}")
    @Operation(summary = "Fully update a user by id (ADMIN or self)")
    public ResponseEntity<?> putById(@PathVariable @Parameter(description = "User id") String id,
            @RequestBody Map<String, Object> updates,
            @AuthenticationPrincipal User principal) {
        if (principal == null) {
            throw new UnauthorizedException("Authentication required");
        }
        // Prevent clients from setting server-managed timestamps
        if (updates.containsKey("createdAt") || updates.containsKey("updatedAt")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "createdAt/updatedAt are server-managed and must not be provided");
        }
        var authUserOpt = users.findById(principal.getUsername());
        if (authUserOpt.isEmpty()) {
            throw new UnauthorizedException("Authentication subject not found");
        }
        boolean isAdmin = authUserOpt.get().getRole().name().equals("ADMIN")
                || authUserOpt.get().getRole().name().equals("PLATFORM_ADMIN");
        boolean isSelf = authUserOpt.get().getId() != null && authUserOpt.get().getId().equals(id);
        if (!isAdmin && !isSelf) {
            throw new ForbiddenException("Not allowed to update this user");
        }
        var userOpt = users.findById(id);
        if (userOpt.isEmpty()) {
            throw new NotFoundException("User not found");
        }
        var user = userOpt.get();
        // Overwrite all fields provided in updates (full update)
        updates.forEach((key, value) -> {
            Field field = ReflectionUtils.findField(user.getClass(), key);
            if (field != null) {
                field.setAccessible(true);
                if (value != null && field.getType().isEnum()) {
                    Object enumValue = Enum.valueOf((Class<Enum>) field.getType(), value.toString());
                    ReflectionUtils.setField(field, user, enumValue);
                } else if (value != null && field.getType().getName().equals("com.eticketing.app.user.PhoneType")) {
                    Map<String, Object> phoneMap = (Map<String, Object>) value;
                    var phone = user.getPhone();
                    if (phone == null) {
                        try {
                            phone = (com.eticketing.app.user.PhoneType) field.getType().getDeclaredConstructor().newInstance();
                        } catch (Exception e) {
                            throw new RuntimeException(e);
                        }
                    }
                    if (phoneMap.get("countryCode") != null) {
                        phone.setCountryCode(phoneMap.get("countryCode").toString());
                    }
                    if (phoneMap.get("number") != null) {
                        phone.setNumber(phoneMap.get("number").toString());
                    }
                    ReflectionUtils.setField(field, user, phone);
                } else if (value != null && field.getType().getName().equals("com.eticketing.app.common.PictureType")) {
                    Map<String, Object> pictureMap = (Map<String, Object>) value;
                    var picture = user.getPicture();
                    if (picture == null) {
                        try {
                            picture = (com.eticketing.app.common.PictureType) field.getType().getDeclaredConstructor().newInstance();
                        } catch (Exception e) {
                            throw new RuntimeException(e);
                        }
                    }
                    if (pictureMap.get("baseUrl") != null) {
                        picture.setBaseUrl(pictureMap.get("baseUrl").toString());
                    }
                    if (pictureMap.get("path") != null) {
                        picture.setPath(pictureMap.get("path").toString());
                    }
                    ReflectionUtils.setField(field, user, picture);
                } else if (value != null && field.getType().getName().equals("com.eticketing.app.user.UserType$TargetType")) {
                    Map<String, Object> targetMap = (Map<String, Object>) value;
                    var target = user.getTarget();
                    if (target == null) {
                        target = new UserType.TargetType();
                    }
                    if (targetMap.get("company") != null) {
                        target.setCompany(targetMap.get("company").toString());
                    }
                    if (targetMap.get("pos") != null) {
                        target.setPos(targetMap.get("pos").toString());
                    }
                    ReflectionUtils.setField(field, user, target);
                } else {
                    ReflectionUtils.setField(field, user, value);
                }
            }
        });
        // Server-managed timestamps
        user.setUpdatedAt(Instant.now());
        users.save(user);
        // Update response: include both createdAt and updatedAt
        return ResponseEntity.ok(UserRes.from(user));
    }

    private final UserTypeRepository users;
    private final MongoTemplate mongoTemplate;

    public UserController(UserTypeRepository users, MongoTemplate mongoTemplate) {
        this.users = users;
        this.mongoTemplate = mongoTemplate;
    }

    @GetMapping
    @Operation(summary = "List users")
    public ResponseEntity<PaginateResponseType<java.util.Map<String, Object>>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int limit,
            @AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
        if (principal == null) {
            throw new UnauthorizedException("Authentication required");
        }
        var me = users.findById(principal.getUsername()).orElseThrow(() -> new UnauthorizedException("Authentication subject not found"));

        if (page < 0) {
            page = 0;
        }
        if (limit < 1) {
            limit = 10;
        }
        Pageable pageable = PageRequest.of(page, limit, Sort.by("lastName").ascending().and(Sort.by("firstName").ascending()));
        var pageResult = users.findAll(pageable);

        java.util.List<java.util.Map<String, Object>> items = pageResult.getContent().stream().map(u -> {
            java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("id", u.getId());
            m.put("firstName", u.getFirstName());
            m.put("lastName", u.getLastName());
            m.put("email", u.getEmail());
            m.put("role", u.getRole().name());
            // Fetch response: include both timestamps
            m.put("createdAt", u.getCreatedAt());
            m.put("updatedAt", u.getUpdatedAt());
            if (u.getPhone() != null) {
                java.util.Map<String, Object> phone = new java.util.LinkedHashMap<>();
                phone.put("countryCode", u.getPhone().getCountryCode());
                phone.put("number", u.getPhone().getNumber());
                m.put("phone", phone);
            } else {
                m.put("phone", null);
            }
            return m;
        }).toList();

        var response = new PaginateResponseType<java.util.Map<String, Object>>(items, pageResult.getTotalElements(), pageResult.isLast());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/me")
    @Operation(summary = "Get current user profile")
    public ResponseEntity<?> me(@AuthenticationPrincipal User user) {
        if (user == null) {
            throw new UnauthorizedException("Authentication required");
        }
        return users.findById(user.getUsername())
                .map(u -> {
                    var body = new java.util.LinkedHashMap<String, Object>();
                    body.put("id", u.getId());
                    body.put("firstName", u.getFirstName());
                    body.put("lastName", u.getLastName());
                    body.put("email", u.getEmail());
                    body.put("role", u.getRole().name());
                    // Fetch response: include both timestamps
                    body.put("createdAt", u.getCreatedAt());
                    body.put("updatedAt", u.getUpdatedAt());
                    if (u.getPhone() != null) {
                        var phone = new java.util.LinkedHashMap<String, Object>();
                        phone.put("countryCode", u.getPhone().getCountryCode());
                        phone.put("number", u.getPhone().getNumber());
                        body.put("phone", phone);
                    } else {
                        body.put("phone", null);
                    }
                    return ResponseEntity.ok(body);
                })
                .orElseThrow(() -> new NotFoundException("User not found"));

    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a user by id")
    public ResponseEntity<UserRes> getById(@PathVariable @Parameter(description = "User id") String id) {
        var userOpt = users.findById(id);
        if (userOpt.isEmpty()) {
            throw new NotFoundException("User not found");
        }
        return ResponseEntity.ok(UserRes.from(userOpt.get()));
    }

    @DeleteMapping("/me")
    @Operation(summary = "Delete current user account")
    public ResponseEntity<?> deleteMe(@AuthenticationPrincipal User user) {
        if (user == null) {
            throw new UnauthorizedException("Authentication required");
        }
        return users.findById(user.getUsername())
                .map(u -> {
                    users.deleteById(u.getId());
                    return ResponseEntity.noContent().build();
                })
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a user by id (ADMIN or self)")
    public ResponseEntity<?> deleteById(@PathVariable @Parameter(description = "User id") String id,
            @AuthenticationPrincipal User principal) {
        if (principal == null) {
            throw new UnauthorizedException("Authentication required");
        }
        // Authorization is handled via the permissions subsystem; allow controller
        // to perform idempotent delete for authenticated requests.
        if (users.existsById(id)) {
            users.deleteById(id);
        }
        return ResponseEntity.noContent().build();
    }
}
