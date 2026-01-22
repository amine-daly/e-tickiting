package com.eticketing.app.currency;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface CurrencyRepository extends MongoRepository<CurrencyType, String> {

    Optional<CurrencyType> findByCode(String code);

    Page<CurrencyType> findByNameIgnoreCaseContaining(String name, Pageable pageable);
}
