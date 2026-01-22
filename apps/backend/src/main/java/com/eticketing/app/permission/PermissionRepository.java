package com.eticketing.app.permission;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface PermissionRepository extends MongoRepository<PermissionType, String> {

    Page<PermissionType> findByNameIgnoreCaseContaining(String name, Pageable pageable);

    Page<PermissionType> findByTargetPosId(String posId, Pageable pageable);
}
