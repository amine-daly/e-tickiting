package com.eticketing.app.ticket;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface TicketRepository extends MongoRepository<TicketType, String> {
    // Custom queries if needed
}
