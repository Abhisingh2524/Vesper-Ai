package com.assistant.service;

import com.assistant.model.Device;
import com.assistant.model.User;
import com.assistant.repository.DeviceRepository;
import com.assistant.repository.SessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class DeviceService {

    private final DeviceRepository deviceRepository;
    private final SessionRepository sessionRepository;

    public DeviceService(DeviceRepository deviceRepository, SessionRepository sessionRepository) {
        this.deviceRepository = deviceRepository;
        this.sessionRepository = sessionRepository;
    }

    public List<Device> getDevicesForUser(User user) {
        return deviceRepository.findByUserId(user.getId());
    }

    @Transactional
    public void revokeDevice(Long deviceId, User user) {
        Device device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new IllegalArgumentException("Device not found"));

        if (!device.getUser().getId().equals(user.getId())) {
            throw new SecurityException("Unauthorized device revocation");
        }

        // Remove active sessions first
        sessionRepository.deleteByDeviceId(device.getId());
        deviceRepository.delete(device);
    }
}
