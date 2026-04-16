package com.eticketing.app.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexField;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.data.mongodb.core.index.IndexOperations;

import java.util.List;

@Configuration
public class IndexRepairRunner implements ApplicationRunner {

    private final MongoTemplate mongoTemplate;

    public IndexRepairRunner(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        // Repair users collection (legacy unique email index without partial filter)
        IndexOperations userOps = mongoTemplate.indexOps("users");
        List<IndexInfo> userIndexes = userOps.getIndexInfo();
        for (IndexInfo info : userIndexes) {
            String name = info.getName();
            List<IndexField> fields = info.getIndexFields();
            boolean singleEmailField = fields.size() == 1
                    && "email".equals(fields.get(0).getKey())
                    && fields.get(0).getDirection() == Sort.Direction.ASC;
            var partial = info.getPartialFilterExpression();
            boolean hasPartial = partial != null && !partial.isEmpty();
            if (info.isUnique() && singleEmailField && !hasPartial && ("email".equals(name) || "email_1".equals(name))) {
                try {
                    userOps.dropIndex(name);
                } catch (Exception ignored) {
                }
            }
        }

        // Repair trips collection: drop legacy search_idx on flat keys {source:1,destination:1,departureDate:1}
        IndexOperations tripOps = mongoTemplate.indexOps("trips");
        List<IndexInfo> tripIndexes = tripOps.getIndexInfo();
        for (IndexInfo info : tripIndexes) {
            if ("search_idx".equals(info.getName())) {
                // If it's built on flat fields (source, destination), drop it so nested index can be created
                List<IndexField> fields = info.getIndexFields();
                boolean flatKeys = fields.stream().map(IndexField::getKey).toList().containsAll(List.of("source", "destination", "departureDate"));
                if (flatKeys) {
                    try {
                        tripOps.dropIndex("search_idx");
                    } catch (Exception ignored) {
                    }
                }
            }
        }

        // Repair accounts collection:
        // - drop legacy POS-based unique index user_pos_idx ({userId, target.pos.id})
        // - drop malformed user_company_idx if it points to wrong keys
        IndexOperations accountOps = mongoTemplate.indexOps("accounts");
        List<IndexInfo> accountIndexes = accountOps.getIndexInfo();
        for (IndexInfo info : accountIndexes) {
            String name = info.getName();
            List<IndexField> fields = info.getIndexFields();
            List<String> keys = fields.stream().map(IndexField::getKey).toList();

            boolean legacyUserPosByName = "user_pos_idx".equals(name);
            boolean legacyUserPosByKeys = keys.size() == 2
                    && keys.contains("userId")
                    && (keys.contains("target.pos.id") || keys.contains("target.pos._id"));
            if (legacyUserPosByName || legacyUserPosByKeys) {
                try {
                    accountOps.dropIndex(name);
                } catch (Exception ignored) {
                }
                continue;
            }

            boolean malformedUserCompany = "user_company_idx".equals(name)
                    && !(keys.size() == 2
                    && keys.contains("userId")
                    && (keys.contains("target.company.id") || keys.contains("target.company._id")));
            if (malformedUserCompany) {
                try {
                    accountOps.dropIndex(name);
                } catch (Exception ignored) {
                }
                continue;
            }

            boolean leakedEmbeddedCompanyUnique = info.isUnique()
                    && keys.stream().anyMatch(key -> key.startsWith("target.company."))
                    && !(keys.size() == 2
                    && keys.contains("userId")
                    && keys.contains("target.company.id"));
            if (leakedEmbeddedCompanyUnique) {
                try {
                    accountOps.dropIndex(name);
                } catch (Exception ignored) {
                }
            }
        }

        // Repair permissions collection: drop legacy POS-based role index
        // ({name, target.pos.id}) so company-based index can be used.
        IndexOperations permissionOps = mongoTemplate.indexOps("permissions");
        List<IndexInfo> permissionIndexes = permissionOps.getIndexInfo();
        for (IndexInfo info : permissionIndexes) {
            String name = info.getName();
            List<String> keys = info.getIndexFields().stream().map(IndexField::getKey).toList();

            boolean legacyPermissionPosByName = "name_pos_idx".equals(name);
            boolean legacyPermissionPosByKeys = keys.size() == 2
                    && keys.contains("name")
                    && keys.contains("target.pos.id");
            if (legacyPermissionPosByName || legacyPermissionPosByKeys) {
                try {
                    permissionOps.dropIndex(name);
                } catch (Exception ignored) {
                }
            }
        }

        // Proper indexes will be recreated by auto-index creation on startup.
    }
}
