package com.eticketing.app.user;

import org.springframework.util.ReflectionUtils;
import java.lang.reflect.Field;
import java.util.Map;

import com.eticketing.app.user.UserTypeRepository;
import com.eticketing.app.user.UserType;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.User;
import org.springframework.web.bind.annotation.*;
import com.eticketing.app.web.error.ApiExceptions.*;
import com.eticketing.app.web.PaginateResponseType;

@RestController
@RequestMapping("/api/users")
@Tag(name = "Users")
public class UserController {
    @PostMapping("")
    @Operation(summary = "Create a new user")
    public ResponseEntity<?> createUser(@RequestBody Map<String, Object> data) {
        var user = new UserType();
        if (data.get("firstName") != null) user.setFirstName(data.get("firstName").toString());
        if (data.get("lastName") != null) user.setLastName(data.get("lastName").toString());
        if (data.get("email") != null) user.setEmail(data.get("email").toString());
        // Set default role to CUSTOMER if not provided
        if (data.get("role") != null) {
            user.setRole(com.eticketing.app.user.RoleType.valueOf(data.get("role").toString()));
        } else {
            user.setRole(com.eticketing.app.user.RoleType.CUSTOMER);
        }
        // Set createdAt to now if not provided
        if (data.get("createdAt") != null) {
            if (data.get("createdAt") instanceof java.time.Instant) {
                user.setCreatedAt((java.time.Instant) data.get("createdAt"));
            } else {
                user.setCreatedAt(java.time.Instant.parse(data.get("createdAt").toString()));
            }
        } else {
            user.setCreatedAt(java.time.Instant.now());
        }
        if (data.get("phone") instanceof Map) {
            Map<String, Object> phoneMap = (Map<String, Object>) data.get("phone");
            var phone = new com.eticketing.app.user.PhoneType();
            if (phoneMap.get("countryCode") != null) phone.setCountryCode(phoneMap.get("countryCode").toString());
            if (phoneMap.get("number") != null) phone.setNumber(phoneMap.get("number").toString());
            user.setPhone(phone);
        }
        users.save(user);
        return ResponseEntity.ok(user);
    }
    @PutMapping("/{id}")
    @Operation(summary = "Fully update a user by id (ADMIN or self)")
    public ResponseEntity<?> putById(@PathVariable @Parameter(description = "User id") String id,
                                     @RequestBody Map<String, Object> updates,
                                     @AuthenticationPrincipal User principal) {
        if (principal == null) throw new UnauthorizedException("Authentication required");
        var authUserOpt = users.findById(principal.getUsername());
        if (authUserOpt.isEmpty()) throw new UnauthorizedException("Authentication subject not found");
        boolean isAdmin = authUserOpt.get().getRole().name().equals("ADMIN");
        boolean isSelf = authUserOpt.get().getId() != null && authUserOpt.get().getId().equals(id);
        if (!isAdmin && !isSelf) throw new ForbiddenException("Not allowed to update this user");
        var userOpt = users.findById(id);
        if (userOpt.isEmpty()) throw new NotFoundException("User not found");
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
                        } catch (Exception e) { throw new RuntimeException(e); }
                    }
                    if (phoneMap.get("countryCode") != null) phone.setCountryCode(phoneMap.get("countryCode").toString());
                    if (phoneMap.get("number") != null) phone.setNumber(phoneMap.get("number").toString());
                    ReflectionUtils.setField(field, user, phone);
                } else {
                    ReflectionUtils.setField(field, user, value);
                }
            }
        });
    users.save(user);
    return ResponseEntity.ok(user);
    }

    private final UserTypeRepository users;

    public UserController(UserTypeRepository users) {
        this.users = users;
    }


    @GetMapping
    @Operation(summary = "List users (ADMIN)")
    public ResponseEntity<PaginateResponseType<java.util.Map<String, Object>>> list(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int limit,
        @AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
        if (principal == null) throw new UnauthorizedException("Authentication required");
        var me = users.findById(principal.getUsername()).orElseThrow(() -> new UnauthorizedException("Authentication subject not found"));
        if (me.getRole() != com.eticketing.app.user.RoleType.ADMIN) throw new ForbiddenException("ADMIN only");

    if (page < 0) page = 0;
        if (limit < 1) limit = 10;
    Pageable pageable = PageRequest.of(page, limit, Sort.by("lastName").ascending().and(Sort.by("firstName").ascending()));
        var pageResult = users.findAll(pageable);

        java.util.List<java.util.Map<String, Object>> items = pageResult.getContent().stream().map(u -> {
            java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("id", u.getId());
            m.put("firstName", u.getFirstName());
            m.put("lastName", u.getLastName());
            m.put("email", u.getEmail());
            m.put("role", u.getRole().name());
            m.put("createdAt", u.getCreatedAt());
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
    if (user == null) throw new UnauthorizedException("Authentication required");
        return users.findById(user.getUsername())
                .map(u -> {
                    var body = new java.util.LinkedHashMap<String, Object>();
                    body.put("id", u.getId());
                    body.put("firstName", u.getFirstName());
                    body.put("lastName", u.getLastName());
                    body.put("email", u.getEmail());
                    body.put("role", u.getRole().name());
                    body.put("createdAt", u.getCreatedAt());
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

    @DeleteMapping("/me")
    @Operation(summary = "Delete current user account")
    public ResponseEntity<?> deleteMe(@AuthenticationPrincipal User user) {
    if (user == null) throw new UnauthorizedException("Authentication required");
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
    if (principal == null) throw new UnauthorizedException("Authentication required");

    var authUserOpt = users.findById(principal.getUsername());
    if (authUserOpt.isEmpty()) throw new UnauthorizedException("Authentication subject not found");

        boolean isAdmin = authUserOpt.get().getRole().name().equals("ADMIN");
        boolean isSelf = authUserOpt.get().getId() != null && authUserOpt.get().getId().equals(id);

    if (!isAdmin && !isSelf) throw new ForbiddenException("Not allowed to delete this user");

        // Idempotent delete: return 204 even if user does not exist
        if (users.existsById(id)) {
            users.deleteById(id);
        }
        return ResponseEntity.noContent().build();
    }
}
