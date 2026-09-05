package com.assistant.model;

import jakarta.persistence.*;

@Entity
@Table(name = "tool_permissions", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"user_id", "tool_name"})
})
public class ToolPermission {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "tool_name", nullable = false)
    private String toolName;

    @Column(nullable = false)
    private String status; // "GRANTED", "DENIED", "CONFIRM_REQUIRED"

    public ToolPermission() {}

    public ToolPermission(User user, String toolName, String status) {
        this.user = user;
        this.toolName = toolName;
        this.status = status;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public String getToolName() { return toolName; }
    public void setToolName(String toolName) { this.toolName = toolName; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
