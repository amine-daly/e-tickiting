package com.eticketing.app.pos;

import com.eticketing.app.common.AddressType;
import com.eticketing.app.common.PictureType;
import com.eticketing.app.user.PhoneType;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Point of Sale entity. Represents a physical or virtual location where tickets
 * are sold.
 */
@Document("pointofsales")
public class PointOfSaleType {

    @Id
    @JsonProperty("id")
    private String id;

    @NotBlank
    @JsonProperty("title")
    private String title;

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

    /**
     * Reference to currency ID
     */
    @JsonProperty("currencyId")
    private String currencyId;

    /**
     * HTML email template for ticket confirmations
     */
    @JsonProperty("emailTemplate")
    private String emailTemplate;

    @CreatedDate
    @JsonProperty("createdAt")
    private Instant createdAt;

    @LastModifiedDate
    @JsonProperty("updatedAt")
    private Instant updatedAt;

    public PointOfSaleType() {
    }

    public PointOfSaleType(String title, String currencyId) {
        this.title = title;
        this.currencyId = currencyId;
    }

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
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

    public String getCurrencyId() {
        return currencyId;
    }

    public void setCurrencyId(String currencyId) {
        this.currencyId = currencyId;
    }

    public String getEmailTemplate() {
        return emailTemplate;
    }

    public void setEmailTemplate(String emailTemplate) {
        this.emailTemplate = emailTemplate;
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
