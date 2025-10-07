package com.eticketing.app.user;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface UserTypeRepository extends MongoRepository<UserType, String> {
    Optional<UserType> findByEmail(String email);
    Optional<UserType> findByPhone_CountryCodeAndPhone_Number(String countryCode, String number);
}
