package com.eticketing.app.ticket;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

public interface TicketRepository extends MongoRepository<TicketType, String> {

    List<TicketType> findByTripId(String tripId);

    Optional<TicketType> findByReference(String reference);

    Optional<TicketType> findByIdempotencyKey(String idempotencyKey);

    @Query("{ 'target.pos': ?0 }")
    Page<TicketType> findByTargetPos(String posId, Pageable pageable);

    @Query("{ 'target.pos': ?0, 'status': ?1 }")
    Page<TicketType> findByTargetPosAndStatus(String posId, TicketStatusEnum status, Pageable pageable);

    @Query("{ 'target.company': ?0 }")
    Page<TicketType> findByTargetCompany(String companyId, Pageable pageable);

    @Query("{ 'target.company': ?0, 'status': ?1 }")
    Page<TicketType> findByTargetCompanyAndStatus(String companyId, TicketStatusEnum status, Pageable pageable);

    List<TicketType> findByTripIdAndStatus(String tripId, TicketStatusEnum status);

    List<TicketType> findByTripIdAndStatusIn(String tripId, List<TicketStatusEnum> statuses);

    List<TicketType> findByTripIdAndSeatNoAndStatusIn(String tripId, String seatNo, List<TicketStatusEnum> statuses);

    List<TicketType> findByTripIdInAndStatusIn(List<String> tripIds, List<TicketStatusEnum> statuses);

    @Query(value = "{ 'tripId': ?0, 'status': { $in: ['PENDING', 'CONFIRMED', 'BOARDED'] }, 'seatNo': { $ne: null } }", fields = "{ 'seatNo': 1 }")
    List<TicketType> findOccupiedSeatsByTripId(String tripId);

    @Query("{ 'status': 'PENDING', 'expiresAt': { $lt: ?0 } }")
    List<TicketType> findExpiredPendingTickets(Instant now);

    List<TicketType> findByOrderId(String orderId);
}
