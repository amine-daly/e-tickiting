package com.eticketing.app.place;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface PlaceRepository extends MongoRepository<PlaceDocument, String> {
    Page<PlaceDocument> findByCityIgnoreCaseContaining(String city, Pageable pageable);
}
