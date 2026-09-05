package com.assistant.controller;

import com.assistant.model.*;
import com.assistant.repository.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/tools")
public class ToolController {

    private final ActionLogRepository actionLogRepository;
    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;
    private final UserRepository userRepository;

    public ToolController(ActionLogRepository actionLogRepository, MessageRepository messageRepository,
                          ConversationRepository conversationRepository, UserRepository userRepository) {
        this.actionLogRepository = actionLogRepository;
        this.messageRepository = messageRepository;
        this.conversationRepository = conversationRepository;
        this.userRepository = userRepository;
    }

    private User getAuthenticatedUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Authenticated user not found"));
    }

    @PostMapping("/execute")
    public ResponseEntity<?> reportExecution(@RequestBody Map<String, Object> payload) {
        try {
            User user = getAuthenticatedUser();
            String toolName = (String) payload.get("toolName");
            String status = (String) payload.get("status"); // "EXECUTED" or "FAILED"
            String resultText = (String) payload.get("result");
            Long conversationId = payload.get("conversationId") != null ? Long.valueOf(payload.get("conversationId").toString()) : null;

            // Log action execution status
            ActionLog log = new ActionLog();
            log.setUser(user);
            log.setToolName(toolName);
            log.setStatus(status);
            log.setParameters(resultText);
            log.setRiskLevel("SAFE");
            actionLogRepository.save(log);

            // Add confirmation or execution message to the chat
            if (conversationId != null) {
                Conversation conv = conversationRepository.findById(conversationId)
                        .orElseThrow(() -> new IllegalArgumentException("Conversation not found"));
                Message assistantMsg = new Message(conv, "ASSISTANT", "Tool execution output [" + toolName + "]: " + resultText);
                messageRepository.save(assistantMsg);
            }

            return ResponseEntity.ok(Map.of("message", "Tool execution logged."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/confirm")
    public ResponseEntity<?> confirmAction(@RequestBody Map<String, Object> payload) {
        try {
            User user = getAuthenticatedUser();
            Long actionLogId = Long.valueOf(payload.get("actionLogId").toString());
            boolean approve = (Boolean) payload.get("approve");
            Long conversationId = payload.get("conversationId") != null ? Long.valueOf(payload.get("conversationId").toString()) : null;

            ActionLog log = actionLogRepository.findById(actionLogId)
                    .orElseThrow(() -> new IllegalArgumentException("Action log not found"));

            if (!log.getUser().getId().equals(user.getId())) {
                throw new SecurityException("Unauthorized action log modification");
            }

            if (approve) {
                log.setStatus("APPROVED");
                actionLogRepository.save(log);

                if (conversationId != null) {
                    Conversation conv = conversationRepository.findById(conversationId)
                            .orElseThrow(() -> new IllegalArgumentException("Conversation not found"));
                    Message assistantMsg = new Message(conv, "ASSISTANT", "Approved action: " + log.getToolName() + ". Proceeding with execution.");
                    messageRepository.save(assistantMsg);
                }

                // Instruct the client to run this now since it is approved
                return ResponseEntity.ok(Map.of(
                        "status", "EXECUTE_ON_CLIENT",
                        "toolName", log.getToolName(),
                        "parameters", new com.fasterxml.jackson.databind.ObjectMapper().readValue(log.getParameters(), Map.class)
                ));
            } else {
                log.setStatus("DENIED");
                actionLogRepository.save(log);

                if (conversationId != null) {
                    Conversation conv = conversationRepository.findById(conversationId)
                            .orElseThrow(() -> new IllegalArgumentException("Conversation not found"));
                    Message assistantMsg = new Message(conv, "ASSISTANT", "Cancelled action: " + log.getToolName());
                    messageRepository.save(assistantMsg);
                }

                return ResponseEntity.ok(Map.of("status", "DENIED", "message", "Action was cancelled by user."));
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
