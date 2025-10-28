package com.eticketing.app.web;

import com.eticketing.app.security.JwtService;
import com.eticketing.app.user.UserType;
import com.eticketing.app.user.UserTypeRepository;
import com.eticketing.app.user.RoleType;
import com.eticketing.app.web.error.ApiExceptions.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;

@Schema(name = "PhonePayload", description = "Phone number payload")
record PhonePayload(@NotBlank String countryCode, @NotBlank String number) {}
@Schema(name = "RegisterRequest")
record RegisterRequest(@NotBlank String firstName, @NotBlank String lastName,
                       @Email String email,
                       @Valid PhonePayload phone,
                       @NotBlank String password,
                       @NotNull RoleType role) {}
@Schema(name = "LoginRequest")
record LoginRequest(String email, @Valid PhonePayload phone, @NotBlank String password) {}
@Schema(name = "UserView")
record UserView(String id, String firstName, String lastName, String email, String role, PhonePayload phone) {}
@Schema(name = "AuthResponse")
record AuthResponse(String token, UserView user) {}

@RestController
@RequestMapping("/api/auth")
@Validated
@CrossOrigin(origins = {"http://localhost:4200"}, allowCredentials = "true")
public class AuthController {

    private final UserTypeRepository users;
    private final JwtService jwt;
    private final PasswordEncoder encoder = new BCryptPasswordEncoder();

    public AuthController(UserTypeRepository users, JwtService jwt) {
        this.users = users;
        this.jwt = jwt;
    }

    @PostMapping("/register")
    @Operation(
        summary = "Register a new user (email OR phone)",
        requestBody = @RequestBody(
            required = true,
            content = @Content(mediaType = "application/json",
                examples = {
                    @ExampleObject(name = "register_with_email", value = "{\n  \"firstName\": \"Amine\",\n  \"lastName\": \"Dali\",\n  \"email\": \"amine@example.com\",\n  \"password\": \"YourPass123!\",\n  \"role\": \"CUSTOMER\"\n}"),
                    @ExampleObject(name = "register_with_phone", value = "{\n  \"firstName\": \"Amine\",\n  \"lastName\": \"Dali\",\n  \"password\": \"YourPass123!\",\n  \"phone\": { \"countryCode\": \"216\", \"number\": \"12345678\" },\n  \"role\": \"CUSTOMER\"\n}")
                }
            )
        ),
        responses = {
            @ApiResponse(responseCode = "201", description = "Created", content = @Content(schema = @Schema(implementation = AuthResponse.class))),
            @ApiResponse(responseCode = "400", description = "Bad Request"),
            @ApiResponse(responseCode = "409", description = "Conflict (email/phone exists)")
        }
    )
    public ResponseEntity<AuthResponse> register(@Valid @org.springframework.web.bind.annotation.RequestBody RegisterRequest request) {
        boolean hasEmail = request.email() != null && !request.email().isBlank();
        boolean hasPhone = request.phone() != null
            && request.phone().countryCode() != null && !request.phone().countryCode().isBlank()
            && request.phone().number() != null && !request.phone().number().isBlank();
        if (hasEmail == hasPhone) {
            throw new BadRequestException("Provide either email or phone (countryCode + number), not both");
        }

        if (hasEmail && users.findByEmail(request.email()).isPresent()) {
            throw new ConflictException("Email already exists");
        }
        if (hasPhone && users.findByPhone_CountryCodeAndPhone_Number(request.phone().countryCode(), request.phone().number()).isPresent()) {
            throw new ConflictException("Phone number already exists");
        }

        com.eticketing.app.user.PhoneType phone = hasPhone ? new com.eticketing.app.user.PhoneType(request.phone().countryCode(), request.phone().number()) : null;
        String email = hasEmail ? request.email() : null;
    // If role is ADMIN, save as ADMIN; else default to CUSTOMER
    RoleType role = (request.role() == RoleType.ADMIN) ? RoleType.ADMIN : RoleType.CUSTOMER;
    UserType u = new UserType(request.firstName(), request.lastName(), email, phone, encoder.encode(request.password()), role);
        users.save(u);
        String token = jwt.generateToken(u.getId(), u.getRole().name(), 3600 * 24);
        UserView userView = new UserView(
            u.getId(), u.getFirstName(), u.getLastName(), u.getEmail(), u.getRole().name(),
            u.getPhone() != null ? new PhonePayload(u.getPhone().getCountryCode(), u.getPhone().getNumber()) : null
        );
        return ResponseEntity.created(URI.create("/api/users/me")).body(new AuthResponse(token, userView));
    }

    @PostMapping("/login")
    @Operation(
        summary = "Login with email OR phone",
        requestBody = @RequestBody(
            required = true,
            content = @Content(mediaType = "application/json",
                examples = {
                    @ExampleObject(name = "login_with_email", value = "{\n  \"email\": \"amine@example.com\",\n  \"password\": \"YourPass123!\"\n}"),
                    @ExampleObject(name = "login_with_phone", value = "{\n  \"phone\": { \"countryCode\": \"216\", \"number\": \"12345678\" },\n  \"password\": \"YourPass123!\"\n}")
                }
            )
        ),
        responses = {
            @ApiResponse(responseCode = "200", description = "OK", content = @Content(schema = @Schema(implementation = AuthResponse.class))),
            @ApiResponse(responseCode = "401", description = "Unauthorized")
        }
    )
    public ResponseEntity<AuthResponse> login(@Valid @org.springframework.web.bind.annotation.RequestBody LoginRequest request) {
    boolean hasEmail = request.email() != null && !request.email().isBlank();
    boolean hasPhone = request.phone() != null
        && request.phone().countryCode() != null && !request.phone().countryCode().isBlank()
        && request.phone().number() != null && !request.phone().number().isBlank();
    if (hasEmail == hasPhone) {
        throw new BadRequestException("Provide either email or phone (countryCode + number), not both");
    }

    var userOpt = hasEmail
        ? users.findByEmail(request.email())
        : users.findByPhone_CountryCodeAndPhone_Number(request.phone().countryCode(), request.phone().number());

        if (userOpt.isEmpty()) {
            throw new UnauthorizedException("No user with this login");
        }
        var u = userOpt.get();
        if (!encoder.matches(request.password(), u.getPasswordHash())) {
            throw new UnauthorizedException("Invalid credentials");
        }
        String token = jwt.generateToken(u.getId(), u.getRole().name(), 3600 * 24);
    UserView userView = new UserView(
        u.getId(), u.getFirstName(), u.getLastName(), u.getEmail(), u.getRole().name(),
        u.getPhone() != null ? new PhonePayload(u.getPhone().getCountryCode(), u.getPhone().getNumber()) : null
    );
        return ResponseEntity.ok(new AuthResponse(token, userView));
    }
}
