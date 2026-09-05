package com.assistant.repository;

import com.assistant.model.Session;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface SessionRepository extends JpaRepository<Session, Long> {
    Optional<Session> findByToken(String token);
    Optional<Session> findByRefreshToken(String refreshToken);
    void deleteByToken(String token);
    void deleteByUserId(Long userId);
    void deleteByDeviceId(Long deviceId);
}
