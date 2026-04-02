package com.eticketing.app.company;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.Optional;

public interface CompanyRepository extends MongoRepository<CompanyType, String> {

    Optional<CompanyType> findByTaxId(String taxId);

    boolean existsByTaxId(String taxId);

    Page<CompanyType> findByStatus(CompanyStatus status, Pageable pageable);

    @Query("{ 'name': { $regex: ?0, $options: 'i' } }")
    Page<CompanyType> findByNameLike(String name, Pageable pageable);

    @Query("{ 'status': ?0, 'name': { $regex: ?1, $options: 'i' } }")
    Page<CompanyType> findByStatusAndNameLike(CompanyStatus status, String name, Pageable pageable);
}
