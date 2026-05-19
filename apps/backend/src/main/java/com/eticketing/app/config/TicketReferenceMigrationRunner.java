package com.eticketing.app.config;

import com.eticketing.app.ticket.TicketReferenceGenerator;
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
import java.util.HashSet;
import java.util.Set;

@Configuration
@Order(3)
@RequiredArgsConstructor
public class TicketReferenceMigrationRunner implements ApplicationRunner {

    private static final Logger LOG = LoggerFactory.getLogger(TicketReferenceMigrationRunner.class);
    private static final String MIGRATIONS_COLLECTION = "schema_migrations";
    private static final String TICKETS_COLLECTION = "tickets";
    private static final String MIGRATION_ID = "2026-05-18-ticket-reference-v1";

    private final MongoTemplate mongoTemplate;

    @Override
    public void run(ApplicationArguments args) {
        if (isAlreadyApplied()) {
            return;
        }

        MongoCollection<Document> ticketsCollection = mongoTemplate.getCollection(TICKETS_COLLECTION);
        Set<String> knownReferences = new HashSet<>();

        long inspectedTickets = 0;
        long migratedTickets = 0;
        for (Document ticketDocument : ticketsCollection.find()) {
            inspectedTickets++;

            String reference = normalizeReference(ticketDocument.getString("reference"));
            if (!reference.isBlank() && knownReferences.add(reference)) {
                continue;
            }

            String migratedReference = generateUniqueReference(knownReferences);
            ticketDocument.put("reference", migratedReference);
            ticketsCollection.replaceOne(
                    Filters.eq("_id", ticketDocument.get("_id")),
                    ticketDocument);
            knownReferences.add(migratedReference);
            migratedTickets++;
        }

        recordMigration(inspectedTickets, migratedTickets);
        LOG.info(
                "TICKET_REFERENCE_MIGRATION: applied={}, inspectedTickets={}, migratedTickets={}",
                MIGRATION_ID,
                inspectedTickets,
                migratedTickets);
    }

    private boolean isAlreadyApplied() {
        Query query = Query.query(Criteria.where("_id").is(MIGRATION_ID));
        return mongoTemplate.exists(query, MIGRATIONS_COLLECTION);
    }

    private void recordMigration(long inspectedTickets, long migratedTickets) {
        Document migrationRecord = new Document("_id", MIGRATION_ID)
                .append("appliedAt", Instant.now())
                .append("inspectedTickets", inspectedTickets)
                .append("migratedTickets", migratedTickets);

        mongoTemplate.getCollection(MIGRATIONS_COLLECTION).replaceOne(
                Filters.eq("_id", MIGRATION_ID),
                migrationRecord,
                new ReplaceOptions().upsert(true));
    }

    private String generateUniqueReference(Set<String> knownReferences) {
        String reference;
        do {
            reference = TicketReferenceGenerator.generate();
        } while (knownReferences.contains(reference));
        return reference;
    }

    private String normalizeReference(String reference) {
        return reference != null ? reference.trim() : "";
    }
}
