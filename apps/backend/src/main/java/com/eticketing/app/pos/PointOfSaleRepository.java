package com.eticketing.app.pos;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;

public interface PointOfSaleRepository extends MongoRepository<PointOfSaleType, String> {

    Page<PointOfSaleType> findByTitleIgnoreCaseContaining(String title, Pageable pageable);

    Page<PointOfSaleType> findByCompanyId(String companyId, Pageable pageable);

    @Query("{ 'companyId': ?0, 'title': { $regex: ?1, $options: 'i' } }")
    Page<PointOfSaleType> findByCompanyIdAndTitleLike(String companyId, String title, Pageable pageable);

    List<PointOfSaleType> findAllByCompanyId(String companyId);

    boolean existsByCompanyId(String companyId);
}
