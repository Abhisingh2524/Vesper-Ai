package com.assistant.repository;

import com.assistant.model.ToolPermission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ToolPermissionRepository extends JpaRepository<ToolPermission, Long> {
    List<ToolPermission> findByUserId(Long userId);
    Optional<ToolPermission> findByUserIdAndToolName(Long userId, String toolName);
}
