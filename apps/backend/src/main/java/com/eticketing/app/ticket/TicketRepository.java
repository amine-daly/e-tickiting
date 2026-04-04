package com.eticketing.app.ticket;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface TicketRepository extends MongoRepository<TicketType, String> {

    List<TicketType> findByTripId(String tripId);

    Optional<TicketType> findByIdempotencyKey(String idempotencyKey);

    @Query("{ 'target.pos': ?0 }")
    Page<TicketType> findByTargetPos(String posId, Pageable pageable);

    @Query("{ 'target.pos': ?0, 'status': ?1 }")
    Page<TicketType> findByTargetPosAndStatus(String posId, TicketStatusEnum status, Pageable pageable);

    @Query("{ 'target.company': ?0 }")
    Page<TicketType> findByTargetCompany(String companyId, Pageable pageable);

    List<TicketType> findByTripIdAndStatus(String tripId, TicketStatusEnum status);

    @Query("{ 'status': 'PENDING', 'expiresAt': { $lt: ?0 } }")
    List<TicketType> findExpiredPendingTickets(Instant now);
}
