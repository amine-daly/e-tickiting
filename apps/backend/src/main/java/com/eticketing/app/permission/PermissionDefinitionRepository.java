package com.eticketing.app.permission;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface PermissionDefinitionRepository extends MongoRepository<PermissionDefinitionType, String> {

    Optional<PermissionDefinitionType> findByName(String name);

    Optional<PermissionDefinitionType> findByCode(String code);

    Page<PermissionDefinitionType> findByNameIgnoreCaseContaining(String name, Pageable pageable);

    Page<PermissionDefinitionType> findByCodeIgnoreCaseContaining(String code, Pageable pageable);
}
