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
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import java.time.Instant;

@Document("users")
@CompoundIndexes({
    @CompoundIndex(
            name = "unique_phone",
            def = "{ 'phone.countryCode': 1, 'phone.number': 1 }",
            unique = true,
            partialFilter = "{ 'phone.countryCode': { $exists: true }, 'phone.number': { $exists: true } }"
    ),
    @CompoundIndex(
            name = "unique_email_per_app",
            def = "{ 'email': 1, 'app': 1 }",
            unique = true,
            partialFilter = "{ 'email': { $exists: true }, 'app': { $exists: true } }"
    ),
    @CompoundIndex(
            name = "target_company_idx",
            def = "{ 'target.company': 1 }",
            partialFilter = "{ 'target.company': { $exists: true } }"
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
    /**
     * Profile picture
     */
    private com.eticketing.app.common.PictureType picture;
    @NotBlank
    @JsonIgnore
    private String password;
    @NotNull
    private RoleEnum role;
    private AppEnum app;

    /**
     * Target scope (POS ID) - users can be scoped to a specific Point of Sale
     */
    private TargetType target;

    public static class TargetType {

        private String company;
        private String pos;

        public TargetType() {
        }

        public TargetType(String pos) {
            this.pos = pos;
        }

        public TargetType(String company, String pos) {
            this.company = company;
            this.pos = pos;
        }

        public String getCompany() {
            return company;
        }

        public void setCompany(String company) {
            this.company = company;
        }

        public String getPos() {
            return pos;
        }

        public void setPos(String pos) {
            this.pos = pos;
        }
    }

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    public UserType() {
    }

    public UserType(String firstName, String lastName, String email, PhoneType phone, String password, RoleEnum role) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.email = email;
        this.phone = phone;
        this.password = password;
        this.role = role;
    }

    public AppEnum getApp() {
        return app;
    }

    public void setApp(AppEnum app) {
        this.app = app;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public PhoneType getPhone() {
        return phone;
    }

    public void setPhone(PhoneType phone) {
        this.phone = phone;
    }

    public com.eticketing.app.common.PictureType getPicture() {
        return picture;
    }

    public void setPicture(com.eticketing.app.common.PictureType picture) {
        this.picture = picture;
    }

    public String getPasswordHash() {
        return password;
    }

    public void setPasswordHash(String passwordHash) {
        this.password = passwordHash;
    }

    public RoleEnum getRole() {
        return role;
    }

    public void setRole(RoleEnum role) {
        this.role = role;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public TargetType getTarget() {
        return target;
    }

    public void setTarget(TargetType target) {
        this.target = target;
    }
}
