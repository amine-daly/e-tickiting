package com.eticketing.app.place;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Place document representing a managed city.
 */
@Document("places")
public class PlaceType {

    public enum PlaceKind {
        CITY
    }

    @Id
    @JsonProperty("id")
    private String id;

    @JsonProperty("city")
    private String city;

    /**
     * Optional ordering rank when a place is used as a stop inside a trip
     */
    @JsonProperty("rank")
    private Integer rank;

    /**
     * Kind of place. New records are stored as CITY.
     */
    @JsonProperty("kind")
    private PlaceKind kind = PlaceKind.CITY;

    /**
     * State (governorate) ID
     */
    @Indexed
    @JsonProperty("stateId")
    private String stateId;

    /**
     * Country ID
     */
    @Indexed
    @JsonProperty("countryId")
    private String countryId;

    /**
     * Target scope (POS ID) - places can be scoped to a specific Point of Sale
     */
    @JsonProperty("target")
    private TargetType target;

    @CreatedDate
    @JsonProperty("createdAt")
    private Instant createdAt;

    @LastModifiedDate
    @JsonProperty("updatedAt")
    private Instant updatedAt;

    public static class TargetType {

        @JsonProperty("company")
        private String company;

        @JsonProperty("pos")
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

    public PlaceType() {
    }

    public PlaceType(String city) {
        this.city = city;
        this.kind = PlaceKind.CITY;
    }

    // ========== Getters and Setters ==========
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public Integer getRank() {
        return rank;
    }

    public void setRank(Integer rank) {
        this.rank = rank;
    }

    public PlaceKind getKind() {
        return kind == null ? PlaceKind.CITY : kind;
    }

    public void setKind(PlaceKind kind) {
        this.kind = kind;
    }

    public String getStateId() {
        return stateId;
    }

    public void setStateId(String stateId) {
        this.stateId = stateId;
    }

    public String getCountryId() {
        return countryId;
    }

    public void setCountryId(String countryId) {
        this.countryId = countryId;
    }

    public TargetType getTarget() {
        return target;
    }

    public void setTarget(TargetType target) {
        this.target = target;
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
