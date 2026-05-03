package com.eticketing.app.config;

import com.eticketing.app.trip.TripInventoryReconciliationService;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.ReplaceOptions;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;

@Configuration
@Order(3)
@RequiredArgsConstructor
public class StaleExpressSegmentDeactivationMigrationRunner implements ApplicationRunner {

    private static final Logger LOG = LoggerFactory.getLogger(StaleExpressSegmentDeactivationMigrationRunner.class);
    private static final String MIGRATIONS_COLLECTION = "schema_migrations";
    private static final String MIGRATION_ID = "2026-05-03-deactivate-stale-express-segments-v1";

    private final MongoTemplate mongoTemplate;
    private final TripInventoryReconciliationService tripInventoryReconciliationService;

    @Override
    public void run(ApplicationArguments args) {
        if (isAlreadyApplied()) {
            return;
        }

        int deactivatedExpressSegments = tripInventoryReconciliationService.deactivateExpiredExpressSegments();
        recordMigration(deactivatedExpressSegments);

        LOG.info("STALE_EXPRESS_SEGMENT_DEACTIVATION_MIGRATION: applied={}, deactivatedExpressSegments={}",
                MIGRATION_ID,
                deactivatedExpressSegments);
    }

    private boolean isAlreadyApplied() {
        Query query = Query.query(Criteria.where("_id").is(MIGRATION_ID));
        return mongoTemplate.exists(query, MIGRATIONS_COLLECTION);
    }

    private void recordMigration(int deactivatedExpressSegments) {
        Document migrationRecord = new Document("_id", MIGRATION_ID)
                .append("appliedAt", Instant.now())
                .append("deactivatedExpressSegments", deactivatedExpressSegments);

        MongoCollection<Document> collection = mongoTemplate.getCollection(MIGRATIONS_COLLECTION);
        collection.replaceOne(
                Filters.eq("_id", MIGRATION_ID),
                migrationRecord,
                new ReplaceOptions().upsert(true));
    }
}
