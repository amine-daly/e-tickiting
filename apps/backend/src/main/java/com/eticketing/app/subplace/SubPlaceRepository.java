package com.eticketing.app.subplace;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;

public interface SubPlaceRepository extends MongoRepository<SubPlaceType, String> {

    List<SubPlaceType> findByParentId(String parentId);

    List<SubPlaceType> findByAddressIgnoreCaseContaining(String address);

    Page<SubPlaceType> findByAddressIgnoreCaseContaining(String address, Pageable pageable);

    @Query("{ 'target.pos': ?0 }")
    Page<SubPlaceType> findByTargetPos(String posId, Pageable pageable);

    @Query("{ 'target.pos': ?0, 'address': { $regex: ?1, $options: 'i' } }")
    Page<SubPlaceType> findByTargetPosAndAddressLike(String posId, String address, Pageable pageable);
}
