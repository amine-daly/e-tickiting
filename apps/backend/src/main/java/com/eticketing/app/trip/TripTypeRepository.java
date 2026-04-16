package com.eticketing.app.trip;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;

public interface TripTypeRepository extends MongoRepository<TripType, String> {

    /**
     * Paginated list scoped by company.
     */
    @Query("{ 'target.company': ?0 }")
    Page<TripType> findByTargetCompany(String companyId, Pageable pageable);

    /**
     * By company + status.
     */
    @Query("{ 'target.company': ?0, 'status': ?1 }")
    Page<TripType> findByTargetCompanyAndStatus(
            String companyId, TripStatusEnum status, Pageable pageable);

    /**
     * Bus lock check — finds trips with a given busId in specified statuses.
     */
    List<TripType> findByBusBusIdAndStatusIn(String busId, List<TripStatusEnum> statuses);
}
