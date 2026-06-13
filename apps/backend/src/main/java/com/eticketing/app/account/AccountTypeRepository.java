package com.eticketing.app.account;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;

public interface AccountTypeRepository extends MongoRepository<AccountType, String> {

    List<AccountType> findByUserId(String userId);

    @Query("{ 'userId': ?0, 'target.company.id': { $exists: true, $ne: null } }")
    List<AccountType> findByUserIdWithCompanyTarget(String userId);

    @Query("{ 'target.company.id': ?0 }")
    List<AccountType> findByTargetCompanyId(String companyId);

    @Query("{ 'target.company.id': ?0 }")
    Page<AccountType> findByTargetCompanyId(String companyId, Pageable pageable);
}
