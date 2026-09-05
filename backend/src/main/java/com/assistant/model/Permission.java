package com.assistant.model;

import jakarta.persistence.*;

@Entity
@Table(name = "permissions", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"device_id", "permission_name"})
})
public class Permission {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "device_id", nullable = false)
    private Device device;

    @Column(name = "permission_name", nullable = false)
    private String permissionName; // e.g. "MICROPHONE", "CONTACTS", "SMS", "FILE_ACCESS", etc.

    @Column(nullable = false)
    private String status; // "GRANTED", "DENIED", "NOT_REQUESTED"

    public Permission() {}

    public Permission(Device device, String permissionName, String status) {
        this.device = device;
        this.permissionName = permissionName;
        this.status = status;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Device getDevice() { return device; }
    public void setDevice(Device device) { this.device = device; }
    public String getPermissionName() { return permissionName; }
    public void setPermissionName(String permissionName) { this.permissionName = permissionName; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
