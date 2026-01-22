package com.eticketing.app.ticket;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;

public interface TicketRepository extends MongoRepository<TicketType, String> {

    /**
     * Find tickets by user ID.
     */
    List<TicketType> findByUserId(String userId);

    /**
     * Find tickets by trip ID.
     */
    List<TicketType> findByTripId(String tripId);

    /**
     * Find tickets by target.pos (POS ID) for terminal-scoped queries.
     */
    @Query("{ 'target.pos': ?0 }")
    Page<TicketType> findByTargetPos(String posId, Pageable pageable);

    /**
     * Find tickets by target.pos and status for terminal-scoped queries.
     */
    @Query("{ 'target.pos': ?0, 'status': ?1 }")
    Page<TicketType> findByTargetPosAndStatus(String posId, TicketType.TicketStatusEnum status, Pageable pageable);
}
