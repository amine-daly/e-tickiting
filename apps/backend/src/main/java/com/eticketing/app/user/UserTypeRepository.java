package com.eticketing.app.user;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.Optional;

public interface UserTypeRepository extends MongoRepository<UserType, String> {

    Optional<UserType> findByEmail(String email);

    Optional<UserType> findByPhone_CountryCodeAndPhone_Number(String countryCode, String number);

    Optional<UserType> findByEmailAndApp(String email, AppEnum app);

    /**
     * Find users by target POS ID
     */
    @Query("{ 'target.pos': ?0 }")
    Page<UserType> findByTargetPos(String posId, Pageable pageable);

    /**
     * Find users by target Company ID
     */
    @Query("{ 'target.company': ?0 }")
    Page<UserType> findByTargetCompany(String companyId, Pageable pageable);
}
