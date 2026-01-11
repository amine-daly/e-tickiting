package com.eticketing.app.place;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface PlaceRepository extends MongoRepository<PlaceType, String> {

    Page<PlaceType> findByCityIgnoreCaseContaining(String city, Pageable pageable);

    /**
     * Find all sub-places (POINT) for a given parent (CITY)
     */
    List<PlaceType> findByParentId(String parentId);

    /**
     * Find places by kind (CITY or POINT)
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
     * Find places by kind and search string (city or address contains)
     */
    Page<PlaceType> findByKindAndCityIgnoreCaseContainingOrKindAndAddressIgnoreCaseContaining(
            PlaceType.PlaceKind kind1, String city,
            PlaceType.PlaceKind kind2, String address,
            Pageable pageable);

    /**
     * Find subplaces matching address
     */
    List<PlaceType> findByKindAndAddressIgnoreCaseContaining(PlaceType.PlaceKind kind, String address);

    /**
     * Find cities by ID list OR city name
     */
    Page<PlaceType> findByKindAndIdInOrKindAndCityIgnoreCaseContaining(
            PlaceType.PlaceKind kind1, List<String> ids,
            PlaceType.PlaceKind kind2, String city,
            Pageable pageable);
}
