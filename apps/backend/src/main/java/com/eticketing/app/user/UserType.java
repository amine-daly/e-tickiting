package com.eticketing.app.user;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.Valid;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("users")
@CompoundIndexes({
    @CompoundIndex(
        name = "unique_phone",
        def = "{ 'phone.countryCode': 1, 'phone.number': 1 }",
        unique = true,
        partialFilter = "{ 'phone.countryCode': { $exists: true }, 'phone.number': { $exists: true } }"
    ),
    @CompoundIndex(
        name = "unique_email",
        def = "{ 'email': 1 }",
        unique = true,
        partialFilter = "{ 'email': { $exists: true } }"
    )
})
public class UserType {
    @Id
    private String id;
    @NotBlank
    private String firstName;
    @NotBlank
    private String lastName;
    @Email
    private String email;
    @Valid
    private PhoneType phone;
    @NotBlank
    @JsonIgnore
    private String passwordHash;
    @NotNull
    private RoleType role;

    public UserType() {}

    public UserType(String firstName, String lastName, String email, PhoneType phone, String passwordHash, RoleType role) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.email = email;
        this.phone = phone;
        this.passwordHash = passwordHash;
        this.role = role;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }
    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public PhoneType getPhone() { return phone; }
    public void setPhone(PhoneType phone) { this.phone = phone; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public RoleType getRole() { return role; }
    public void setRole(RoleType role) { this.role = role; }
}
