package com.assistant.service;

import com.assistant.model.*;
import com.assistant.repository.DeviceRepository;
import com.assistant.repository.PermissionRepository;
import com.assistant.repository.ToolPermissionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
public class PermissionService {

    private final PermissionRepository permissionRepository;
    private final ToolPermissionRepository toolPermissionRepository;
    private final DeviceRepository deviceRepository;

    public PermissionService(PermissionRepository permissionRepository,
                             ToolPermissionRepository toolPermissionRepository,
                             DeviceRepository deviceRepository) {
        this.permissionRepository = permissionRepository;
        this.toolPermissionRepository = toolPermissionRepository;
        this.deviceRepository = deviceRepository;
    }

    public List<Permission> getDevicePermissions(Long deviceId, User user) {
        Device device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new IllegalArgumentException("Device not found"));

        if (!device.getUser().getId().equals(user.getId())) {
            throw new SecurityException("Unauthorized device access");
        }

        initializeDefaultPermissions(device);
        return permissionRepository.findByDeviceId(device.getId());
    }

    @Transactional
    public Permission updatePermission(Long deviceId, String permissionName, String status, User user) {
        Device device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new IllegalArgumentException("Device not found"));

        if (!device.getUser().getId().equals(user.getId())) {
            throw new SecurityException("Unauthorized device access");
        }

        Permission permission = permissionRepository.findByDeviceIdAndPermissionName(device.getId(), permissionName)
                .orElseGet(() -> new Permission(device, permissionName, "NOT_REQUESTED"));

        permission.setStatus(status);
        return permissionRepository.save(permission);
    }

    @Transactional
    public List<ToolPermission> getToolPermissions(User user) {
        initializeDefaultToolPermissions(user);
        return toolPermissionRepository.findByUserId(user.getId());
    }

    @Transactional
    public ToolPermission updateToolPermission(String toolName, String status, User user) {
        ToolPermission toolPermission = toolPermissionRepository.findByUserIdAndToolName(user.getId(), toolName)
                .orElseGet(() -> new ToolPermission(user, toolName, "CONFIRM_REQUIRED"));

        toolPermission.setStatus(status);
        return toolPermissionRepository.save(toolPermission);
    }

    public boolean hasDevicePermission(Device device, String permissionName) {
        Optional<Permission> perm = permissionRepository.findByDeviceIdAndPermissionName(device.getId(), permissionName);
        return perm.isPresent() && "GRANTED".equals(perm.get().getStatus());
    }

    public String getToolPermissionStatus(User user, String toolName) {
        if ("CREATE_MEMORY".equals(toolName) || "GET_MEMORY".equals(toolName) 
            || "OPEN_CAMERA".equals(toolName) || "PLAY_SONG".equals(toolName)
            || "CALL_CONTACT".equals(toolName) || "SEND_SMS".equals(toolName)
            || "CREATE_NOTE".equals(toolName) || "LIST_NOTES".equals(toolName)
            || "CREATE_TASK".equals(toolName) || "LIST_TASKS".equals(toolName)
            || "COMPLETE_TASK".equals(toolName) || "OPEN_WEBSITE".equals(toolName)
            || "GET_TIME".equals(toolName) || "GET_DATE".equals(toolName)) {
            return "GRANTED";
        }
        Optional<ToolPermission> tp = toolPermissionRepository.findByUserIdAndToolName(user.getId(), toolName);
        return tp.map(ToolPermission::getStatus).orElse("CONFIRM_REQUIRED"); // Default to confirm required for security
    }

    private void initializeDefaultPermissions(Device device) {
        List<String> requiredPermissions = new ArrayList<>();
        if ("ANDROID".equalsIgnoreCase(device.getPlatform())) {
            requiredPermissions.addAll(Arrays.asList("MICROPHONE", "CONTACTS", "PHONE", "SMS", "NOTIFICATIONS", "LOCATION", "FILES_MEDIA", "CAMERA", "ACCESSIBILITY", "BLUETOOTH"));
        } else if ("DESKTOP".equalsIgnoreCase(device.getPlatform())) {
            requiredPermissions.addAll(Arrays.asList("MICROPHONE", "CAMERA", "NOTIFICATIONS", "FILE_ACCESS", "BROWSER_ACCESS", "APPLICATION_LAUNCHING", "SCREEN_CAPTURE", "CLIPBOARD", "LOCATION", "ACCESSIBILITY"));
        }

        for (String permName : requiredPermissions) {
            if (permissionRepository.findByDeviceIdAndPermissionName(device.getId(), permName).isEmpty()) {
                Permission perm = new Permission(device, permName, "NOT_REQUESTED");
                permissionRepository.save(perm);
            }
        }
    }

    private void initializeDefaultToolPermissions(User user) {
        Map<String, String> defaultTools = new HashMap<>();
        // SAFE tools
        defaultTools.put("OPEN_WEBSITE", "GRANTED");
        defaultTools.put("WEB_SEARCH", "GRANTED");
        defaultTools.put("LIST_NOTES", "GRANTED");
        defaultTools.put("LIST_TASKS", "GRANTED");
        defaultTools.put("GET_TIME", "GRANTED");
        defaultTools.put("GET_DATE", "GRANTED");
        defaultTools.put("GET_DEVICE_INFO", "GRANTED");
        defaultTools.put("CREATE_MEMORY", "GRANTED");
        defaultTools.put("GET_MEMORY", "GRANTED");

        // LOW_RISK tools
        defaultTools.put("CREATE_NOTE", "GRANTED");
        defaultTools.put("CREATE_TASK", "GRANTED");
        defaultTools.put("CREATE_REMINDER", "GRANTED");
        defaultTools.put("COMPLETE_TASK", "GRANTED");
        defaultTools.put("CLIPBOARD_READ", "GRANTED");
        defaultTools.put("CLIPBOARD_WRITE", "GRANTED");
        defaultTools.put("SEARCH_FILE", "GRANTED");
        defaultTools.put("READ_APPROVED_FILE", "GRANTED");

        // CONFIRM_REQUIRED tools
        defaultTools.put("OPEN_APP", "CONFIRM_REQUIRED");
        defaultTools.put("CALL_CONTACT", "CONFIRM_REQUIRED");
        defaultTools.put("SEND_SMS", "CONFIRM_REQUIRED");
        defaultTools.put("OPEN_FILE", "CONFIRM_REQUIRED");
        defaultTools.put("CREATE_FILE", "CONFIRM_REQUIRED");
        defaultTools.put("DELETE_NOTE", "CONFIRM_REQUIRED");
        defaultTools.put("TAKE_SCREENSHOT", "CONFIRM_REQUIRED");
        defaultTools.put("NAVIGATE", "CONFIRM_REQUIRED");

        for (Map.Entry<String, String> entry : defaultTools.entrySet()) {
            if (toolPermissionRepository.findByUserIdAndToolName(user.getId(), entry.getKey()).isEmpty()) {
                ToolPermission tp = new ToolPermission(user, entry.getKey(), entry.getValue());
                toolPermissionRepository.save(tp);
            }
        }
    }
}
