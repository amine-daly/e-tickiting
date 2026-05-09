package com.eticketing.app.config;

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
@Order(4)
@RequiredArgsConstructor
public class TripSegmentPlaceRefMigrationRunner implements ApplicationRunner {

    private static final Logger LOG = LoggerFactory.getLogger(TripSegmentPlaceRefMigrationRunner.class);
    private static final String MIGRATIONS_COLLECTION = "schema_migrations";
    private static final String TRIPS_COLLECTION = "trips";
    private static final String MIGRATION_ID = "2026-05-09-trip-segment-place-ref-v1";

    private final MongoTemplate mongoTemplate;

    @Override
    public void run(ApplicationArguments args) {
        if (isAlreadyApplied()) {
            return;
        }

        MongoCollection<Document> tripsCollection = mongoTemplate.getCollection(TRIPS_COLLECTION);

        long inspectedTrips = 0;
        long migratedTrips = 0;
        for (Document tripDocument : tripsCollection.find()) {
            inspectedTrips++;
            if (!migrateTripDocument(tripDocument)) {
                continue;
            }

            tripsCollection.replaceOne(
                    Filters.eq("_id", tripDocument.get("_id")),
                    tripDocument);
            migratedTrips++;
        }

        recordMigration(inspectedTrips, migratedTrips);
        LOG.info(
                "TRIP_SEGMENT_PLACE_REF_MIGRATION: applied={}, inspectedTrips={}, migratedTrips={}",
                MIGRATION_ID,
                inspectedTrips,
                migratedTrips);
    }

    private boolean isAlreadyApplied() {
        Query query = Query.query(Criteria.where("_id").is(MIGRATION_ID));
        return mongoTemplate.exists(query, MIGRATIONS_COLLECTION);
    }

    private void recordMigration(long inspectedTrips, long migratedTrips) {
        Document migrationRecord = new Document("_id", MIGRATION_ID)
                .append("appliedAt", Instant.now())
                .append("inspectedTrips", inspectedTrips)
                .append("migratedTrips", migratedTrips);

        mongoTemplate.getCollection(MIGRATIONS_COLLECTION).replaceOne(
                Filters.eq("_id", MIGRATION_ID),
                migrationRecord,
                new ReplaceOptions().upsert(true));
    }

    private boolean migrateTripDocument(Document tripDocument) {
        boolean changed = false;
        changed |= migratePlaceRefs(tripDocument.get("segments"));
        changed |= migratePlaceRefs(tripDocument.get("expressSegments"));
        return changed;
    }

    private boolean migratePlaceRefs(Object value) {
        if (!(value instanceof java.util.List<?> items)) {
            return false;
        }

        boolean changed = false;
        for (Object item : items) {
            if (!(item instanceof Document document)) {
                continue;
            }
            changed |= migratePlaceRef(document, "fromPlaceId", "fromPlace");
            changed |= migratePlaceRef(document, "toPlaceId", "toPlace");
        }
        return changed;
    }

    private boolean migratePlaceRef(Document document, String legacyField, String targetField) {
        if (!document.containsKey(legacyField)) {
            return false;
        }

        Object legacyValue = document.remove(legacyField);
        if (!document.containsKey(targetField) && legacyValue instanceof String legacyPlaceId && !legacyPlaceId.isBlank()) {
            document.put(targetField, new Document("id", legacyPlaceId));
        }
        return true;
    }
}
