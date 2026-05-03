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
@Order(2)
@RequiredArgsConstructor
public class ExpressSegmentFieldRenameMigrationRunner implements ApplicationRunner {

    private static final Logger LOG = LoggerFactory.getLogger(ExpressSegmentFieldRenameMigrationRunner.class);
    private static final String MIGRATIONS_COLLECTION = "schema_migrations";
    private static final String TRIPS_COLLECTION = "trips";
    private static final String TICKETS_COLLECTION = "tickets";
    private static final String MIGRATION_ID = "2026-05-03-express-segment-rename-v1";

    private final MongoTemplate mongoTemplate;

    @Override
    public void run(ApplicationArguments args) {
        if (isAlreadyApplied()) {
            return;
        }

        MongoCollection<Document> tripsCollection = mongoTemplate.getCollection(TRIPS_COLLECTION);
        MongoCollection<Document> ticketsCollection = mongoTemplate.getCollection(TICKETS_COLLECTION);

        long inspectedTrips = 0;
        long migratedTrips = 0;
        for (Document tripDocument : tripsCollection.find()) {
            inspectedTrips++;
            if (!renameTripExpressSegmentFields(tripDocument)) {
                continue;
            }

            tripsCollection.replaceOne(
                    Filters.eq("_id", tripDocument.get("_id")),
                    tripDocument);
            migratedTrips++;
        }

        long inspectedTickets = 0;
        long migratedTickets = 0;
        for (Document ticketDocument : ticketsCollection.find()) {
            inspectedTickets++;
            if (!renameTicketExpressSegmentFields(ticketDocument)) {
                continue;
            }

            ticketsCollection.replaceOne(
                    Filters.eq("_id", ticketDocument.get("_id")),
                    ticketDocument);
            migratedTickets++;
        }

        recordMigration(inspectedTrips, migratedTrips, inspectedTickets, migratedTickets);
        LOG.info(
                "EXPRESS_SEGMENT_FIELD_RENAME_MIGRATION: applied={}, inspectedTrips={}, migratedTrips={}, inspectedTickets={}, migratedTickets={}",
                MIGRATION_ID,
                inspectedTrips,
                migratedTrips,
                inspectedTickets,
                migratedTickets);
    }

    private boolean isAlreadyApplied() {
        Query query = Query.query(Criteria.where("_id").is(MIGRATION_ID));
        return mongoTemplate.exists(query, MIGRATIONS_COLLECTION);
    }

    private void recordMigration(long inspectedTrips, long migratedTrips, long inspectedTickets, long migratedTickets) {
        Document migrationRecord = new Document("_id", MIGRATION_ID)
                .append("appliedAt", Instant.now())
                .append("inspectedTrips", inspectedTrips)
                .append("migratedTrips", migratedTrips)
                .append("inspectedTickets", inspectedTickets)
                .append("migratedTickets", migratedTickets);

        mongoTemplate.getCollection(MIGRATIONS_COLLECTION).replaceOne(
                Filters.eq("_id", MIGRATION_ID),
                migrationRecord,
                new ReplaceOptions().upsert(true));
    }

    private boolean renameTripExpressSegmentFields(Document tripDocument) {
        boolean changed = false;

        Object legacyExpressFaresValue = tripDocument.get("expressFares");
        Object expressSegmentsValue = tripDocument.get("expressSegments");

        if (!(expressSegmentsValue instanceof java.util.List<?>) && legacyExpressFaresValue instanceof java.util.List<?> legacyExpressFares) {
            tripDocument.put("expressSegments", legacyExpressFares);
            tripDocument.remove("expressFares");
            expressSegmentsValue = legacyExpressFares;
            changed = true;
        } else if (legacyExpressFaresValue != null) {
            tripDocument.remove("expressFares");
            changed = true;
        }

        if (expressSegmentsValue instanceof java.util.List<?> expressSegments) {
            for (Object item : expressSegments) {
                if (item instanceof Document expressSegment) {
                    changed |= migrateField(expressSegment, "expressId", "expressSegmentId");
                }
            }
        }

        return changed;
    }

    private boolean renameTicketExpressSegmentFields(Document ticketDocument) {
        return migrateField(ticketDocument, "expressId", "expressSegmentId");
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
