package com.eticketing.app.trip;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.time.OffsetDateTime;

public interface TripTypeRepository extends MongoRepository<TripType, String> {

    /**
     * Find trips by originId, destinationId and date range.
     */
    @Query("{ 'originId': ?0, 'destinationId': ?1, 'departureDate': { $gte: ?2, $lt: ?3 } }")
    Page<TripType> findByOriginAndDestinationAndDateRange(
            String originId,
            String destinationId,
            OffsetDateTime startOfDay,
            OffsetDateTime endOfDay,
            Pageable pageable
    );

    /**
     * Find trips by target.pos (POS ID) for terminal-scoped queries.
     */
    @Query("{ 'target.pos': ?0 }")
    Page<TripType> findByTargetPos(String posId, Pageable pageable);

    /**
     * Find trips by target.pos (POS ID) and date range for terminal-scoped
     * queries.
     */
    @Query("{ 'target.pos': ?0, 'departureDate': { $gte: ?1, $lt: ?2 } }")
    Page<TripType> findByTargetPosAndDateRange(
            String posId,
            OffsetDateTime startOfDay,
            OffsetDateTime endOfDay,
            Pageable pageable
    );
}
