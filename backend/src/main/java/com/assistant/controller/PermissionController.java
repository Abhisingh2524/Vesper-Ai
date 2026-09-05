package com.assistant.controller;

import com.assistant.model.*;
import com.assistant.repository.UserRepository;
import com.assistant.service.PermissionService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/permissions")
public class PermissionController {

    private final PermissionService permissionService;
    private final UserRepository userRepository;

    public PermissionController(PermissionService permissionService, UserRepository userRepository) {
        this.permissionService = permissionService;
        this.userRepository = userRepository;
    }

    private User getAuthenticatedUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Authenticated user not found"));
    }

    @GetMapping
    public ResponseEntity<List<Permission>> getDevicePermissions(@RequestParam Long deviceId) {
        User user = getAuthenticatedUser();
        return ResponseEntity.ok(permissionService.getDevicePermissions(deviceId, user));
    }

    @PostMapping("/request")
    public ResponseEntity<?> requestPermission(@RequestBody Map<String, Object> payload) {
        try {
            User user = getAuthenticatedUser();
            Long deviceId = Long.valueOf(payload.get("deviceId").toString());
            String permissionName = (String) payload.get("permissionName");
            String status = (String) payload.get("status"); // GRANTED or DENIED
            
            Permission perm = permissionService.updatePermission(deviceId, permissionName, status, user);
            return ResponseEntity.ok(perm);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/revoke")
    public ResponseEntity<?> revokePermission(@RequestBody Map<String, Object> payload) {
        try {
            User user = getAuthenticatedUser();
            Long deviceId = Long.valueOf(payload.get("deviceId").toString());
            String permissionName = (String) payload.get("permissionName");
            
            Permission perm = permissionService.updatePermission(deviceId, permissionName, "DENIED", user);
            return ResponseEntity.ok(perm);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/tools")
    public ResponseEntity<List<ToolPermission>> getToolPermissions() {
        User user = getAuthenticatedUser();
        return ResponseEntity.ok(permissionService.getToolPermissions(user));
    }

    @PostMapping("/tools")
    public ResponseEntity<?> updateToolPermission(@RequestBody Map<String, String> payload) {
        try {
            User user = getAuthenticatedUser();
            String toolName = payload.get("toolName");
            String status = payload.get("status"); // GRANTED, DENIED, CONFIRM_REQUIRED
            
            ToolPermission tp = permissionService.updateToolPermission(toolName, status, user);
            return ResponseEntity.ok(tp);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
