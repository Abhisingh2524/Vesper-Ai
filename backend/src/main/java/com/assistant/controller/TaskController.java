package com.assistant.controller;

import com.assistant.model.Task;
import com.assistant.model.User;
import com.assistant.repository.UserRepository;
import com.assistant.service.TaskService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;
    private final UserRepository userRepository;

    public TaskController(TaskService taskService, UserRepository userRepository) {
        this.taskService = taskService;
        this.userRepository = userRepository;
    }

    private User getAuthenticatedUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Authenticated user not found"));
    }

    @GetMapping
    public ResponseEntity<List<Task>> getTasks() {
        User user = getAuthenticatedUser();
        return ResponseEntity.ok(taskService.getTasksForUser(user));
    }

    @PostMapping
    public ResponseEntity<?> createTask(@RequestBody Map<String, Object> payload) {
        try {
            User user = getAuthenticatedUser();
            String title = (String) payload.get("title");
            String description = (String) payload.get("description");
            String priority = (String) payload.get("priority");
            LocalDateTime dueDate = payload.get("dueDate") != null ? LocalDateTime.parse((String) payload.get("dueDate")) : null;
            LocalDateTime reminderTime = payload.get("reminderTime") != null ? LocalDateTime.parse((String) payload.get("reminderTime")) : null;

            Task task = taskService.createTask(title, description, priority, dueDate, reminderTime, user);
            return ResponseEntity.ok(task);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateTask(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        try {
            User user = getAuthenticatedUser();
            String title = (String) payload.get("title");
            String description = (String) payload.get("description");
            boolean completed = (Boolean) payload.get("completed");
            String priority = (String) payload.get("priority");
            LocalDateTime dueDate = payload.get("dueDate") != null ? LocalDateTime.parse((String) payload.get("dueDate")) : null;
            LocalDateTime reminderTime = payload.get("reminderTime") != null ? LocalDateTime.parse((String) payload.get("reminderTime")) : null;

            Task task = taskService.updateTask(id, title, description, completed, priority, dueDate, reminderTime, user);
            return ResponseEntity.ok(task);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTask(@PathVariable Long id) {
        try {
            User user = getAuthenticatedUser();
            taskService.deleteTask(id, user);
            return ResponseEntity.ok(Map.of("message", "Task deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
