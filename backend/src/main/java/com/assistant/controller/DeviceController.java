package com.assistant.controller;

import com.assistant.model.Device;
import com.assistant.model.User;
import com.assistant.repository.UserRepository;
import com.assistant.service.DeviceService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/devices")
public class DeviceController {

    private final DeviceService deviceService;
    private final UserRepository userRepository;

    public DeviceController(DeviceService deviceService, UserRepository userRepository) {
        this.deviceService = deviceService;
        this.userRepository = userRepository;
    }

    private User getAuthenticatedUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Authenticated user not found"));
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getDevices() {
        User user = getAuthenticatedUser();
        List<Device> devices = deviceService.getDevicesForUser(user);
        List<Map<String, Object>> response = devices.stream().map(d -> {
            Map<String, Object> map = new java.util.HashMap<>();
            map.put("id", d.getId());
            map.put("deviceId", d.getDeviceId());
            map.put("deviceName", d.getDeviceName());
            map.put("platform", d.getPlatform());
            map.put("lastSeen", d.getLastSeen());
            map.put("capabilities", d.getCapabilities());
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> revokeDevice(@PathVariable Long id) {
        try {
            User user = getAuthenticatedUser();
            deviceService.revokeDevice(id, user);
            return ResponseEntity.ok(Map.of("message", "Device revoked successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
