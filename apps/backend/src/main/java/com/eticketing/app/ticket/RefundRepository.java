package com.eticketing.app.ticket;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface RefundRepository extends MongoRepository<RefundType, String> {

    List<RefundType> findByTicketId(String ticketId);

    List<RefundType> findByStatus(RefundStatusEnum status);
}
