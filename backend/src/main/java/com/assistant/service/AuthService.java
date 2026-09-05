package com.assistant.service;

import com.assistant.config.JwtTokenProvider;
import com.assistant.model.Device;
import com.assistant.model.Session;
import com.assistant.model.User;
import com.assistant.repository.DeviceRepository;
import com.assistant.repository.SessionRepository;
import com.assistant.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final DeviceRepository deviceRepository;
    private final SessionRepository sessionRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    public AuthService(UserRepository userRepository, DeviceRepository deviceRepository,
                       SessionRepository sessionRepository, PasswordEncoder passwordEncoder,
                       JwtTokenProvider tokenProvider) {
        this.userRepository = userRepository;
        this.deviceRepository = deviceRepository;
        this.sessionRepository = sessionRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
    }

    @Transactional
    public User register(String username, String password, String email) {
        if (userRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("Username already exists");
        }
        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("Email already exists");
        }
        User user = new User(username, passwordEncoder.encode(password), email);
        return userRepository.save(user);
    }

    @Transactional
    public Session login(String username, String password, String deviceId, String deviceName, String platform, String capabilities) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("Invalid username or password"));

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid username or password");
        }

        // Register/update device
        Device device = deviceRepository.findByDeviceId(deviceId)
                .orElseGet(() -> {
                    Device d = new Device();
                    d.setDeviceId(deviceId);
                    return d;
                });
        device.setDeviceName(deviceName);
        device.setPlatform(platform);
        device.setCapabilities(capabilities);
        device.setLastSeen(LocalDateTime.now());
        device.setUser(user);
        device = deviceRepository.save(device);

        // Generate JWT
        String token = tokenProvider.generateToken(username);
        String refreshToken = UUID.randomUUID().toString();

        Session session = new Session();
        session.setUser(user);
        session.setDevice(device);
        session.setToken(token);
        session.setRefreshToken(refreshToken);
        session.setExpiredAt(LocalDateTime.now().plusDays(7));
        return sessionRepository.save(session);
    }

    @Transactional
    public Session refresh(String refreshToken) {
        Session session = sessionRepository.findByRefreshToken(refreshToken)
                .orElseThrow(() -> new IllegalArgumentException("Invalid refresh token"));

        if (session.getExpiredAt().isBefore(LocalDateTime.now())) {
            sessionRepository.delete(session);
            throw new IllegalArgumentException("Expired refresh token");
        }

        String newToken = tokenProvider.generateToken(session.getUser().getUsername());
        session.setToken(newToken);
        return sessionRepository.save(session);
    }

    @Transactional
    public void logout(String token) {
        sessionRepository.deleteByToken(token);
    }
}
