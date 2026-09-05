package com.assistant.repository;

import com.assistant.model.ActionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ActionLogRepository extends JpaRepository<ActionLog, Long> {
    List<ActionLog> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<ActionLog> findByDeviceIdOrderByCreatedAtDesc(Long deviceId);
}
