package com.eticketing.app.country;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface CountryRepository extends MongoRepository<CountryType, String> {

    Page<CountryType> findByNameIgnoreCaseContaining(String name, Pageable pageable);

    Optional<CountryType> findByCode(String code);
}
