package com.eticketing.app.trip;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDate;

public interface TripTypeRepository extends MongoRepository<TripType, String> {
    Page<TripType> findBySource_CityIgnoreCaseAndDestination_CityIgnoreCaseAndDepartureDate(String sourceCity, String destinationCity, LocalDate departureDate, Pageable pageable);
}
