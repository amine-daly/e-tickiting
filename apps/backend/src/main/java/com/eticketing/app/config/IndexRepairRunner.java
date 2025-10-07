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
            boolean hasPartial = partial != null && !partial.toString().isEmpty();
            if (info.isUnique() && singleEmailField && !hasPartial && ("email".equals(name) || "email_1".equals(name))) {
                try { userOps.dropIndex(name); } catch (Exception ignored) {}
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
                    try { tripOps.dropIndex("search_idx"); } catch (Exception ignored) {}
                }
            }
        }

        // Proper indexes will be recreated by auto-index creation on startup.
    }
}
