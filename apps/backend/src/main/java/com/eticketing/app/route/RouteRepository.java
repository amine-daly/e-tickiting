package com.eticketing.app.route;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RouteRepository extends MongoRepository<RouteType, String> {

    /**
     * Find a route by origin and destination place IDs.
     */
    Optional<RouteType> findByOriginIdAndDestinationId(String originId, String destinationId);

    /**
     * Find all routes originating from a place.
     */
    List<RouteType> findByOriginId(String originId);

    /**
     * Find all routes ending at a place.
     */
    List<RouteType> findByDestinationId(String destinationId);

    /**
     * Find all active routes.
     */
    List<RouteType> findByActiveTrue();

    /**
     * Check if a route exists for a given pair.
     */
    boolean existsByOriginIdAndDestinationId(String originId, String destinationId);
}
