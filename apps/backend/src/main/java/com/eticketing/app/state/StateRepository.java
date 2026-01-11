package com.eticketing.app.state;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface StateRepository extends MongoRepository<StateType, String> {

    Page<StateType> findByNameIgnoreCaseContaining(String name, Pageable pageable);

    List<StateType> findByCountryId(String countryId);

    Page<StateType> findByCountryId(String countryId, Pageable pageable);

    Page<StateType> findByCountryIdAndNameIgnoreCaseContaining(String countryId, String name, Pageable pageable);
}
