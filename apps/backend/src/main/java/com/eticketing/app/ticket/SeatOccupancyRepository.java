package com.eticketing.app.ticket;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;

public interface SeatOccupancyRepository extends MongoRepository<SeatOccupancyType, String> {

    @Query(value = "{ 'tripId': ?0, 'segmentId': { $in: ?1 } }", fields = "{ 'seatNo': 1, 'ticketId': 1 }")
    List<SeatOccupancyType> findByTripIdAndSegmentIdIn(String tripId, List<String> segmentIds);

    void deleteByTicketId(String ticketId);

    void deleteByTicketIdIn(List<String> ticketIds);
}
