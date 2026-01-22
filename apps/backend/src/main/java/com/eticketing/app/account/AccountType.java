package com.eticketing.app.account;

import com.eticketing.app.pos.PointOfSaleType;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Account entity - links a user to a target (POS) with a permission set. A user
 * can have multiple accounts (one per POS they have access to).
 */
@Document("accounts")
@CompoundIndexes({
    @CompoundIndex(name = "user_pos_idx", def = "{ 'userId': 1, 'target.pos.id': 1 }", unique = true)
})
public class AccountType {

    @Id
    @JsonProperty("id")
    private String id;

    /**
     * Reference to user ID
     */
    @JsonProperty("userId")
    private String userId;

    /**
     * Reference to permission definition ID
     */
    @JsonProperty("permissionId")
    private String permissionId;

    /**
     * Embedded target with POS reference
     */
    @JsonProperty("target")
    private TargetType target;

    @CreatedDate
    @JsonProperty("createdAt")
    private Instant createdAt;

    @LastModifiedDate
    @JsonProperty("updatedAt")
    private Instant updatedAt;

    public AccountType() {
    }

    public AccountType(String userId, String permissionId, TargetType target) {
        this.userId = userId;
        this.permissionId = permissionId;
        this.target = target;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getPermissionId() {
        return permissionId;
    }

    public void setPermissionId(String permissionId) {
        this.permissionId = permissionId;
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

    /**
     * Embedded target type containing POS reference.
     */
    public static class TargetType {

        @JsonProperty("pos")
        private PointOfSaleType pos;

        public TargetType() {
        }

        public TargetType(PointOfSaleType pos) {
            this.pos = pos;
        }

        public PointOfSaleType getPos() {
            return pos;
        }

        public void setPos(PointOfSaleType pos) {
            this.pos = pos;
        }

    }
}
