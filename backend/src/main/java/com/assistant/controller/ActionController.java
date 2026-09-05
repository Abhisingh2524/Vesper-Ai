package com.assistant.controller;

import com.assistant.model.ActionLog;
import com.assistant.model.User;
import com.assistant.repository.ActionLogRepository;
import com.assistant.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RestController
@RequestMapping("/api/actions")
public class ActionController {

    private final ActionLogRepository actionLogRepository;
    private final UserRepository userRepository;

    public ActionController(ActionLogRepository actionLogRepository, UserRepository userRepository) {
        this.actionLogRepository = actionLogRepository;
        this.userRepository = userRepository;
    }

    private User getAuthenticatedUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Authenticated user not found"));
    }

    @GetMapping
    public ResponseEntity<List<ActionLog>> getActions() {
        User user = getAuthenticatedUser();
        return ResponseEntity.ok(actionLogRepository.findByUserIdOrderByCreatedAtDesc(user.getId()));
    }
}
