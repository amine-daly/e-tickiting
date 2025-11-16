package com.eticketing.app.agency;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface AgencyRepository extends MongoRepository<AgencyType, String> {
    // custom methods if any
}
