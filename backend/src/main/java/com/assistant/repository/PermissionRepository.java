package com.assistant.repository;

import com.assistant.model.Permission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface PermissionRepository extends JpaRepository<Permission, Long> {
    List<Permission> findByDeviceId(Long deviceId);
    Optional<Permission> findByDeviceIdAndPermissionName(Long deviceId, String permissionName);
}
