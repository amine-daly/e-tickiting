package com.eticketing.app.account;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;

public interface AccountTypeRepository extends MongoRepository<AccountType, String> {

    List<AccountType> findByUserId(String userId);

    @Query("{ 'target.pos.id': ?0 }")
    List<AccountType> findByTargetPosId(String posId);

    @Query("{ 'target.pos.id': ?0 }")
    Page<AccountType> findByTargetPosId(String posId, Pageable pageable);
}
