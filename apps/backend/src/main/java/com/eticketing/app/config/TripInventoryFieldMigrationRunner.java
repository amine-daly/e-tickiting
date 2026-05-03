package com.eticketing.app.config;

import com.eticketing.app.trip.TripInventoryReconciliationService;
import com.eticketing.app.trip.TripType;
import com.eticketing.app.trip.TripTypeRepository;
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
import java.util.List;

@Configuration
@Order(1)
@RequiredArgsConstructor
public class TripInventoryFieldMigrationRunner implements ApplicationRunner {

    private static final Logger LOG = LoggerFactory.getLogger(TripInventoryFieldMigrationRunner.class);
    private static final String MIGRATIONS_COLLECTION = "schema_migrations";
    private static final String TRIPS_COLLECTION = "trips";
    private static final String MIGRATION_ID = "2026-05-02-trip-inventory-fields-v1";

    private final MongoTemplate mongoTemplate;
    private final TripTypeRepository tripRepository;
    private final TripInventoryReconciliationService tripInventoryReconciliationService;

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
            if (!normalizeTripInventoryFields(tripDocument)) {
                continue;
            }

            tripsCollection.replaceOne(
                    Filters.eq("_id", tripDocument.get("_id")),
                    tripDocument);
            migratedTrips++;
        }

        if (migratedTrips > 0) {
            List<TripType> trips = tripRepository.findAll();
            if (!trips.isEmpty()) {
                tripInventoryReconciliationService.reconcile(trips);
            }
        }

        recordMigration(migratedTrips, inspectedTrips);
        LOG.info("TRIP_INVENTORY_FIELD_MIGRATION: applied={}, inspectedTrips={}, migratedTrips={}",
                MIGRATION_ID, inspectedTrips, migratedTrips);
    }

    private boolean isAlreadyApplied() {
        Query query = Query.query(Criteria.where("_id").is(MIGRATION_ID));
        return mongoTemplate.exists(query, MIGRATIONS_COLLECTION);
    }

    private void recordMigration(long migratedTrips, long inspectedTrips) {
        Document migrationRecord = new Document("_id", MIGRATION_ID)
                .append("appliedAt", Instant.now())
                .append("inspectedTrips", inspectedTrips)
                .append("migratedTrips", migratedTrips);

        mongoTemplate.getCollection(MIGRATIONS_COLLECTION).replaceOne(
                Filters.eq("_id", MIGRATION_ID),
                migrationRecord,
                new ReplaceOptions().upsert(true));
    }

    private boolean normalizeTripInventoryFields(Document tripDocument) {
        boolean changed = false;

        Object segmentsValue = tripDocument.get("segments");
        if (segmentsValue instanceof List<?> segments) {
            for (Object item : segments) {
                if (item instanceof Document segment) {
                    changed |= migrateField(segment, "maxSeats", "maxBooking");
                    changed |= migrateField(segment, "bookedSeats", "bookedCount");
                }
            }
        }

        Object expressFaresValue = tripDocument.get("expressFares");
        if (expressFaresValue instanceof List<?> expressFares) {
            for (Object item : expressFares) {
                if (item instanceof Document expressFare) {
                    changed |= migrateField(expressFare, "bookedSeats", "bookedCount");
                    if (!expressFare.containsKey("bookedCount")) {
                        expressFare.put("bookedCount", 0);
                        changed = true;
                    }
                }
            }
        }

        return changed;
    }

    private boolean migrateField(Document document, String legacyField, String targetField) {
        if (!document.containsKey(legacyField)) {
            return false;
        }

        Object legacyValue = document.remove(legacyField);
        if (!document.containsKey(targetField)) {
            document.put(targetField, legacyValue);
        }
        return true;
    }
}
