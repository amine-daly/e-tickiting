package com.eticketing.app.ticket;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

public interface OrderRepository extends MongoRepository<OrderType, String> {

    Optional<OrderType> findByIdempotencyKey(String idempotencyKey);

    @Query("{ 'status': 'PENDING', 'expiresAt': { $lt: ?0 } }")
    List<OrderType> findExpiredPendingOrders(Instant now);

    List<OrderType> findByTripIdAndStatus(String tripId, OrderStatusEnum status);

    @Query("{ 'target.company': ?0 }")
    List<OrderType> findByTargetCompany(String companyId);
}
