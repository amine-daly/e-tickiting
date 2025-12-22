package com.eticketing.app.route;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface RouteCoefficientRepository extends MongoRepository<RouteCoefficient, String> {

    /**
     * Find all active coefficients for a specific route.
     */
    List<RouteCoefficient> findByRouteIdAndActiveTrue(String routeId);

    /**
     * Find all global coefficients (routeId is null) that are active.
     */
    List<RouteCoefficient> findByRouteIdIsNullAndActiveTrue();

    /**
     * Find coefficients applicable to a route on a specific date. Returns
     * coefficients where: startDate <= date <= endDate and active = true
     */
    @Query("{ 'routeId': ?0, 'active': true, 'startDate': { $lte: ?1 }, 'endDate': { $gte: ?1 } }")
    List<RouteCoefficient> findApplicableCoefficients(String routeId, LocalDate date);

    /**
     * Find global coefficients applicable on a specific date.
     */
    @Query("{ 'routeId': null, 'active': true, 'startDate': { $lte: ?0 }, 'endDate': { $gte: ?0 } }")
    List<RouteCoefficient> findGlobalApplicableCoefficients(LocalDate date);

    /**
     * Find all coefficients for a route (for admin management).
     */
    List<RouteCoefficient> findByRouteIdOrderByStartDateDesc(String routeId);
}
