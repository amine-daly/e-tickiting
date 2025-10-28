package com.eticketing.app.trip;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDate;

public interface TripTypeRepository extends MongoRepository<TripType, String> {
    Page<TripType> findByOriginIdAndDestinationIdAndDepartureDate(String originId, String destinationId, LocalDate departureDate, Pageable pageable);
}
