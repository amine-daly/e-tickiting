package com.eticketing.app.pos;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface PointOfSaleRepository extends MongoRepository<PointOfSaleType, String> {

    Page<PointOfSaleType> findByTitleIgnoreCaseContaining(String title, Pageable pageable);
}
