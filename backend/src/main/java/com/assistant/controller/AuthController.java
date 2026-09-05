package com.assistant.controller;

import com.assistant.model.Session;
import com.assistant.model.User;
import com.assistant.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    public static class RegisterRequest {
        public String username;
        public String password;
        public String email;
    }

    public static class LoginRequest {
        public String username;
        public String password;
        public String deviceId;
        public String deviceName;
        public String platform;
        public String capabilities;
    }

    public static class RefreshRequest {
        public String refreshToken;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        try {
            User user = authService.register(request.username, request.password, request.email);
            Map<String, Object> response = new HashMap<>();
            response.put("id", user.getId());
            response.put("username", user.getUsername());
            response.put("email", user.getEmail());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
            Session session = authService.login(
                    request.username, request.password,
                    request.deviceId, request.deviceName,
                    request.platform, request.capabilities
            );
            Map<String, Object> response = new HashMap<>();
            response.put("token", session.getToken());
            response.put("refreshToken", session.getRefreshToken());
            response.put("username", session.getUser().getUsername());
            response.put("deviceId", session.getDevice().getDeviceId());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestBody RefreshRequest request) {
        try {
            Session session = authService.refresh(request.refreshToken);
            Map<String, Object> response = new HashMap<>();
            response.put("token", session.getToken());
            response.put("refreshToken", session.getRefreshToken());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestHeader("Authorization") String authHeader) {
        try {
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                authService.logout(authHeader.substring(7));
            }
            return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
