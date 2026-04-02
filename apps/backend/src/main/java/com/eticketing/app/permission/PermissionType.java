package com.eticketing.app.permission;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Permission (role) that groups permission definitions with CRUD flags and a
 * target scope.
 *
 * Matches the structure from the attached GraphQL types: - PermissionType: {
 * id, name, permissions[], target } - PermissionPermissionsType: { permission:
 * PermissionDefinitionType, read, create, update }
 */
@Document("permissions")
@CompoundIndexes({
    @CompoundIndex(name = "name_company_idx", def = "{ 'name': 1, 'target.company.id': 1 }", unique = false)
})
public class PermissionType {

    @Id
    @JsonProperty("id")
    private String id;

    @JsonProperty("name")
    private String name;

    /**
     * Grants: each item references a permission definition by id and carries
     * CRUD flags.
     */
    @JsonProperty("permissions")
    private List<PermissionGrant> permissions = new ArrayList<>();

    @JsonProperty("target")
    private TargetType target;

    @CreatedDate
    @JsonProperty("createdAt")
    private Instant createdAt;

    @LastModifiedDate
    @JsonProperty("updatedAt")
    private Instant updatedAt;

    public PermissionType() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public List<PermissionGrant> getPermissions() {
        return permissions;
    }

    public void setPermissions(List<PermissionGrant> permissions) {
        this.permissions = permissions != null ? permissions : new ArrayList<>();
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

    public static class PermissionGrant {

        /**
         * Permission definition ID
         */
        @JsonProperty("permission")
        private String permission;

        @JsonProperty("read")
        private Boolean read;

        @JsonProperty("create")
        private Boolean create;

        @JsonProperty("update")
        private Boolean update;

        public PermissionGrant() {
        }

        public PermissionGrant(String permission, Boolean read, Boolean create, Boolean update) {
            this.permission = permission;
            this.read = read;
            this.create = create;
            this.update = update;
        }

        public String getPermission() {
            return permission;
        }

        public void setPermission(String permission) {
            this.permission = permission;
        }

        public Boolean getRead() {
            return read;
        }

        public void setRead(Boolean read) {
            this.read = read;
        }

        public Boolean getCreate() {
            return create;
        }

        public void setCreate(Boolean create) {
            this.create = create;
        }

        public Boolean getUpdate() {
            return update;
        }

        public void setUpdate(Boolean update) {
            this.update = update;
        }
    }

    public static class TargetType {

        @JsonProperty("company")
        private IdRef company;

        public TargetType() {
        }

        public IdRef getCompany() {
            return company;
        }

        public void setCompany(IdRef company) {
            this.company = company;
        }

        public static class IdRef {

            @JsonProperty("id")
            private String id;

            public IdRef() {
            }

            public IdRef(String id) {
                this.id = id;
            }

            public String getId() {
                return id;
            }

            public void setId(String id) {
                this.id = id;
            }
        }
    }
}
