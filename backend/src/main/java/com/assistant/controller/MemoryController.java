package com.assistant.controller;

import com.assistant.model.Memory;
import com.assistant.model.User;
import com.assistant.repository.UserRepository;
import com.assistant.service.MemoryService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/memory")
public class MemoryController {

    private final MemoryService memoryService;
    private final UserRepository userRepository;

    public MemoryController(MemoryService memoryService, UserRepository userRepository) {
        this.memoryService = memoryService;
        this.userRepository = userRepository;
    }

    private User getAuthenticatedUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Authenticated user not found"));
    }

    @GetMapping
    public ResponseEntity<List<Memory>> getMemories() {
        User user = getAuthenticatedUser();
        return ResponseEntity.ok(memoryService.getMemoriesForUser(user));
    }

    @PostMapping
    public ResponseEntity<?> createMemory(@RequestBody Map<String, String> payload) {
        try {
            User user = getAuthenticatedUser();
            String content = payload.get("content");
            Memory memory = memoryService.createMemory(content, user);
            return ResponseEntity.ok(memory);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateMemory(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        try {
            User user = getAuthenticatedUser();
            String content = payload.get("content");
            Memory memory = memoryService.updateMemory(id, content, user);
            return ResponseEntity.ok(memory);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteMemory(@PathVariable Long id) {
        try {
            User user = getAuthenticatedUser();
            memoryService.deleteMemory(id, user);
            return ResponseEntity.ok(Map.of("message", "Memory deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
