package com.eticketing.app.place;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;

public interface PlaceRepository extends MongoRepository<PlaceType, String> {

    /**
     * Find places by target POS ID
     */
    @Query("{ 'target.pos': ?0 }")
    Page<PlaceType> findByTargetPos(String posId, Pageable pageable);

    /**
     * Find places by target POS ID and kind
     */
    @Query("{ 'target.pos': ?0, 'kind': ?1 }")
    Page<PlaceType> findByTargetPosAndKind(String posId, PlaceType.PlaceKind kind, Pageable pageable);

    /**
     * Find places by target POS ID, kind and city (case-insensitive)
     */
    @Query("{ 'target.pos': ?0, 'kind': ?1, 'city': { $regex: ?2, $options: 'i' } }")
    Page<PlaceType> findByTargetPosAndKindAndCityLike(String posId, PlaceType.PlaceKind kind, String city, Pageable pageable);

    Page<PlaceType> findByCityIgnoreCaseContaining(String city, Pageable pageable);

    /**
     * Find places by kind (CITY)
     */
    Page<PlaceType> findByKind(PlaceType.PlaceKind kind, Pageable pageable);

    /**
     * Find places by state
     */
    List<PlaceType> findByStateId(String stateId);

    /**
     * Find places by country
     */
    List<PlaceType> findByCountryId(String countryId);

    /**
     * Find cities by ID list OR city name
     */
    Page<PlaceType> findByKindAndIdInOrKindAndCityIgnoreCaseContaining(
            PlaceType.PlaceKind kind1, List<String> ids,
            PlaceType.PlaceKind kind2, String city,
            Pageable pageable);
}
