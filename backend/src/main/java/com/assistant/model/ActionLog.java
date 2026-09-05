package com.assistant.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "action_logs")
public class ActionLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "device_id")
    private Device device;

    @Column(name = "tool_name", nullable = false)
    private String toolName;

    @Column(columnDefinition = "TEXT")
    private String parameters; // JSON representation of arguments

    @Column(name = "risk_level", nullable = false)
    private String riskLevel; // SAFE, LOW_RISK, CONFIRM_REQUIRED, HIGH_RISK

    @Column(nullable = false)
    private String status; // "PENDING_CONFIRMATION", "APPROVED", "DENIED", "EXECUTED", "FAILED"

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public ActionLog() {}

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public Device getDevice() { return device; }
    public void setDevice(Device device) { this.device = device; }
    public String getToolName() { return toolName; }
    public void setToolName(String toolName) { this.toolName = toolName; }
    public String getParameters() { return parameters; }
    public void setParameters(String parameters) { this.parameters = parameters; }
    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
