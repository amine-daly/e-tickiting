package com.eticketing.app.subplace;

import com.eticketing.app.place.LonLatType;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * SubPlace document (pickup/dropoff point) that belongs to a parent CITY Place.
 * Stores the location; cities no longer carry a location.
 */
@Document("sub_places")
public class SubPlaceType {

    @Id
    @JsonProperty("id")
    private String id;

    /**
     * Parent CITY place ID.
     */
    @Indexed
    @JsonProperty("parentId")
    private String parentId;

    /**
     * Full address (pickup/dropoff address).
     */
    @JsonProperty("address")
    private String address;

    @JsonProperty("location")
    private LonLatType location;

    @JsonProperty("pickupInstructions")
    private String pickupInstructions;

    @JsonProperty("isDefault")
    private Boolean isDefault;

    /**
     * Optional POS scope; typically inherited from parent city place.
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

        @JsonProperty("pos")
        private String pos;

        public TargetType() {
        }

        public TargetType(String pos) {
            this.pos = pos;
        }

        public String getPos() {
            return pos;
        }

        public void setPos(String pos) {
            this.pos = pos;
        }
    }

    public SubPlaceType() {
    }

    // ===== Getters/Setters =====
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getParentId() {
        return parentId;
    }

    public void setParentId(String parentId) {
        this.parentId = parentId;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public LonLatType getLocation() {
        return location;
    }

    public void setLocation(LonLatType location) {
        this.location = location;
    }

    public String getPickupInstructions() {
        return pickupInstructions;
    }

    public void setPickupInstructions(String pickupInstructions) {
        this.pickupInstructions = pickupInstructions;
    }

    public Boolean getIsDefault() {
        return isDefault;
    }

    public void setIsDefault(Boolean isDefault) {
        this.isDefault = isDefault;
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
