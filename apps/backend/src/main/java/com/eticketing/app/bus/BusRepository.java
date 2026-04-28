package com.eticketing.app.bus;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

public interface BusRepository extends MongoRepository<BusType, String> {

    /**
     * Find buses scoped to a specific company.
     */
    @Query("{ 'target.company': ?0 }")
    Page<BusType> findByTargetCompany(String companyId, Pageable pageable);

    /**
     * Find buses scoped to a company with case-insensitive name search.
     */
    @Query("{ 'target.company': ?0, 'name': { $regex: ?1, $options: 'i' } }")
    Page<BusType> findByTargetCompanyAndNameLike(String companyId, String name, Pageable pageable);

    /**
     * Find buses across all companies with case-insensitive name search.
     */
    @Query("{ 'name': { $regex: ?0, $options: 'i' } }")
    Page<BusType> findByNameLike(String name, Pageable pageable);

    /**
     * Check if any bus exists for the given company.
     */
    boolean existsByTargetCompany(String companyId);
}
