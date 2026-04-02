package com.eticketing.app.pos;

import com.eticketing.app.common.AddressType;
import com.eticketing.app.common.PictureType;
import com.eticketing.app.user.PhoneType;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Point of Sale entity. Represents a physical or virtual location where tickets
 * are sold.
 */
@Document("pointofsales")
@CompoundIndex(name = "companyId_idx", def = "{ 'companyId': 1 }")
public class PointOfSaleType {

    @Id
    @JsonProperty("id")
    private String id;

    /**
     * Reference to the owning Company.
     */
    @JsonProperty("companyId")
    private String companyId;

    @JsonProperty("active")
    private boolean active = true;

    @NotBlank
    @JsonProperty("title")
    private String title;

    @JsonProperty("subtitle")
    private String subtitle;

    @JsonProperty("picture")
    private PictureType picture;

    /**
     * Single location/address for this POS
     */
    @JsonProperty("location")
    private AddressType location;

    @JsonProperty("phone")
    private PhoneType phone;

    @JsonProperty("email")
    private String email;

    @CreatedDate
    @JsonProperty("createdAt")
    private Instant createdAt;

    @LastModifiedDate
    @JsonProperty("updatedAt")
    private Instant updatedAt;

    public PointOfSaleType() {
    }

    public PointOfSaleType(String title) {
        this.title = title;
    }

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getCompanyId() {
        return companyId;
    }

    public void setCompanyId(String companyId) {
        this.companyId = companyId;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getSubtitle() {
        return subtitle;
    }

    public void setSubtitle(String subtitle) {
        this.subtitle = subtitle;
    }

    public PictureType getPicture() {
        return picture;
    }

    public void setPicture(PictureType picture) {
        this.picture = picture;
    }

    public AddressType getLocation() {
        return location;
    }

    public void setLocation(AddressType location) {
        this.location = location;
    }

    public PhoneType getPhone() {
        return phone;
    }

    public void setPhone(PhoneType phone) {
        this.phone = phone;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
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
}
