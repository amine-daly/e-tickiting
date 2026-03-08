package com.eticketing.app.bus;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

public interface BusRepository extends MongoRepository<BusType, String> {

    /**
     * Find buses scoped to a specific POS.
     */
    @Query("{ 'target.pos': ?0 }")
    Page<BusType> findByTargetPos(String pos, Pageable pageable);

    /**
     * Find buses scoped to a POS with case-insensitive name search.
     */
    @Query("{ 'target.pos': ?0, 'name': { $regex: ?1, $options: 'i' } }")
    Page<BusType> findByTargetPosAndNameLike(String pos, String name, Pageable pageable);

    /**
     * Check if any bus exists for the given POS.
     */
    boolean existsByTargetPos(String pos);
}
