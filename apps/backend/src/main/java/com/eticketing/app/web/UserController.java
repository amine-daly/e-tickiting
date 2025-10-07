package com.eticketing.app.web;

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

@RestController
@RequestMapping("/api/users")
@Tag(name = "Users")
public class UserController {

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
