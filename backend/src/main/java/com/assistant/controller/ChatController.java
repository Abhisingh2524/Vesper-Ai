package com.assistant.controller;

import com.assistant.model.*;
import com.assistant.repository.*;
import com.assistant.service.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class ChatController {

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final DeviceRepository deviceRepository;
    private final ActionLogRepository actionLogRepository;
    
    private final AIService aiService;
    private final PermissionService permissionService;
    private final NoteService noteService;
    private final TaskService taskService;
    private final MemoryService memoryService;
    private final WebSearchService webSearchService;

    public ChatController(ConversationRepository conversationRepository, MessageRepository messageRepository,
                          UserRepository userRepository, DeviceRepository deviceRepository,
                          ActionLogRepository actionLogRepository, AIService aiService,
                          PermissionService permissionService, NoteService noteService,
                          TaskService taskService, MemoryService memoryService,
                          WebSearchService webSearchService) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.deviceRepository = deviceRepository;
        this.actionLogRepository = actionLogRepository;
        this.aiService = aiService;
        this.permissionService = permissionService;
        this.noteService = noteService;
        this.taskService = taskService;
        this.memoryService = memoryService;
        this.webSearchService = webSearchService;
    }

    private User getAuthenticatedUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Authenticated user not found"));
    }

    public static class ChatRequest {
        public Long conversationId;
        public String message;
        public String deviceId;
    }

    @GetMapping("/conversations")
    public ResponseEntity<List<Conversation>> getConversations() {
        User user = getAuthenticatedUser();
        return ResponseEntity.ok(conversationRepository.findByUserIdOrderByCreatedAtDesc(user.getId()));
    }

    @GetMapping("/conversations/{id}")
    public ResponseEntity<List<Message>> getMessages(@PathVariable Long id) {
        // Validate conversation ownership
        User user = getAuthenticatedUser();
        Conversation conv = conversationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found"));
        if (!conv.getUser().getId().equals(user.getId())) {
            throw new SecurityException("Unauthorized conversation access");
        }
        return ResponseEntity.ok(messageRepository.findByConversationIdOrderByCreatedAtAsc(id));
    }

    @DeleteMapping("/conversations/{id}")
    public ResponseEntity<?> deleteConversation(@PathVariable Long id) {
        try {
            User user = getAuthenticatedUser();
            Conversation conv = conversationRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Conversation not found"));
            if (!conv.getUser().getId().equals(user.getId())) {
                throw new SecurityException("Unauthorized conversation access");
            }
            conversationRepository.delete(conv);
            return ResponseEntity.ok(Map.of("message", "Conversation deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/chat")
    public ResponseEntity<?> processChat(@RequestBody ChatRequest request) {
        try {
            User user = getAuthenticatedUser();
            Device device = deviceRepository.findByDeviceId(request.deviceId)
                    .orElseThrow(() -> new IllegalArgumentException("Device not registered"));

            // Create conversation if not exist
            Conversation conversation;
            if (request.conversationId == null) {
                conversation = new Conversation("Chat - " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")), user);
                conversation = conversationRepository.save(conversation);
            } else {
                conversation = conversationRepository.findById(request.conversationId)
                        .orElseThrow(() -> new IllegalArgumentException("Conversation not found"));
            }

            // Save user message
            Message userMessage = new Message(conversation, "USER", request.message);
            messageRepository.save(userMessage);

            // Parse intent using AI
            AIService.AIResponse aiResponse = aiService.parseIntent(request.message);

            Map<String, Object> result = new HashMap<>();
            result.put("conversationId", conversation.getId());
            result.put("reply", aiResponse.getReply());

            // If no tool mapping, finish
            if (aiResponse.getToolName() == null) {
                Message assistantMessage = new Message(conversation, "ASSISTANT", aiResponse.getReply());
                messageRepository.save(assistantMessage);
                result.put("status", "COMPLETED");
                return ResponseEntity.ok(result);
            }

            String toolName = aiResponse.getToolName();
            Map<String, Object> params = aiResponse.getParameters();

            // Check permissions & gates
            // 1. Resolve OS Permission requirement based on tool
            String requiredPermission = getRequiredPermissionForTool(toolName, device.getPlatform());
            if (requiredPermission != null) {
                boolean hasPerm = permissionService.hasDevicePermission(device, requiredPermission);
                if (!hasPerm) {
                    result.put("status", "PERMISSION_REQUIRED");
                    result.put("permissionName", requiredPermission);
                    result.put("explanation", "I need " + requiredPermission + " permission to perform this action.");
                    result.put("toolName", toolName);
                    result.put("parameters", params);
                    
                    // Create pending action log
                    ActionLog log = new ActionLog();
                    log.setUser(user);
                    log.setDevice(device);
                    log.setToolName(toolName);
                    log.setParameters(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(params));
                    log.setRiskLevel("CONFIRM_REQUIRED");
                    log.setStatus("PENDING_PERMISSION");
                    actionLogRepository.save(log);
                    
                    Message assistantMessage = new Message(conversation, "ASSISTANT", "Permission " + requiredPermission + " is required to run this.");
                    messageRepository.save(assistantMessage);

                    return ResponseEntity.ok(result);
                }
            }

            // 2. Resolve Tool risk level
            String toolPermissionStatus = permissionService.getToolPermissionStatus(user, toolName);
            if ("DENIED".equals(toolPermissionStatus)) {
                result.put("status", "DENIED");
                result.put("reply", "This action is disabled in your permission center settings.");
                
                Message assistantMessage = new Message(conversation, "ASSISTANT", "This action is disabled in your settings.");
                messageRepository.save(assistantMessage);
                return ResponseEntity.ok(result);
            }

            if ("CONFIRM_REQUIRED".equals(toolPermissionStatus)) {
                // Log confirmation action
                ActionLog log = new ActionLog();
                log.setUser(user);
                log.setDevice(device);
                log.setToolName(toolName);
                log.setParameters(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(params));
                log.setRiskLevel("CONFIRM_REQUIRED");
                log.setStatus("PENDING_CONFIRMATION");
                log = actionLogRepository.save(log);

                result.put("status", "CONFIRMATION_REQUIRED");
                result.put("actionLogId", log.getId());
                result.put("toolName", toolName);
                result.put("parameters", params);
                result.put("reply", "This action requires confirmation: " + toolName);

                Message assistantMessage = new Message(conversation, "ASSISTANT", "I need your confirmation before performing this action.");
                messageRepository.save(assistantMessage);

                return ResponseEntity.ok(result);
            }

            // 3. Execute tool (SAFE or pre-approved)
            String executionResult = executeBackendTool(toolName, params, user, device);
            if (executionResult != null) {
                // Executed directly on backend
                result.put("status", "COMPLETED");
                result.put("reply", executionResult);

                Message assistantMessage = new Message(conversation, "ASSISTANT", executionResult);
                messageRepository.save(assistantMessage);
            } else {
                // Needs to execute on client (e.g. OPEN_APP, CALL_CONTACT, SEND_SMS)
                result.put("status", "EXECUTE_ON_CLIENT");
                result.put("toolName", toolName);
                result.put("parameters", params);
                
                // Write action log
                ActionLog log = new ActionLog();
                log.setUser(user);
                log.setDevice(device);
                log.setToolName(toolName);
                log.setParameters(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(params));
                log.setRiskLevel("SAFE");
                log.setStatus("APPROVED");
                actionLogRepository.save(log);
            }

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    private String getRequiredPermissionForTool(String tool, String platform) {
        if ("ANDROID".equalsIgnoreCase(platform)) {
            switch (tool) {
                case "CALL_CONTACT":
                case "SEND_SMS": return null; // Let the OS prompt natively
                case "NAVIGATE": return "LOCATION";
                case "OPEN_APP": return "ACCESSIBILITY";
                default: return null;
            }
        } else if ("DESKTOP".equalsIgnoreCase(platform)) {
            switch (tool) {
                case "TAKE_SCREENSHOT": return "SCREEN_CAPTURE";
                case "OPEN_FILE":
                case "SEARCH_FILE":
                case "CREATE_FILE": return "FILE_ACCESS";
                case "OPEN_APP": return "APPLICATION_LAUNCHING";
                case "CLIPBOARD_READ":
                case "CLIPBOARD_WRITE": return "CLIPBOARD";
                default: return null;
            }
        }
        return null;
    }

    private String executeBackendTool(String toolName, Map<String, Object> params, User user, Device device) {
        switch (toolName) {
            case "CREATE_NOTE":
                String title = (String) params.get("title");
                String content = (String) params.get("content");
                Note note = noteService.createNote(title, content, user);
                return "Successfully created note: \"" + note.getTitle() + "\"";
                
            case "LIST_NOTES":
                List<Note> notes = noteService.getNotesForUser(user);
                if (notes.isEmpty()) return "You have no notes saved.";
                return "Here are your notes:\n" + notes.stream()
                        .map(n -> "- " + n.getTitle() + ": " + n.getContent())
                        .collect(Collectors.joining("\n"));
                        
            case "CREATE_TASK":
                String tTitle = (String) params.get("title");
                String tPriority = (String) params.get("priority");
                Task task = taskService.createTask(tTitle, "Created from chat", tPriority, null, null, user);
                return "Successfully added task: \"" + task.getTitle() + "\"";
                
            case "LIST_TASKS":
                List<Task> tasks = taskService.getTasksForUser(user);
                List<Task> pendingTasks = tasks.stream().filter(t -> !t.isCompleted()).collect(Collectors.toList());
                if (pendingTasks.isEmpty()) return "You have no pending tasks.";
                return "Here are your pending tasks:\n" + pendingTasks.stream()
                        .map(t -> "- [ ] " + t.getTitle() + " (" + t.getPriority() + " priority)")
                        .collect(Collectors.joining("\n"));
                        
            case "COMPLETE_TASK":
                String compTitle = (String) params.get("title");
                Task compTask = taskService.completeTaskByTitle(compTitle, user);
                if (compTask != null) {
                    return "Successfully marked task as completed: \"" + compTask.getTitle() + "\"";
                } else {
                    return "Could not find any pending task matching \"" + (compTitle != null ? compTitle : "") + "\".";
                }

            case "CREATE_MEMORY":
                String mContent = (String) params.get("content");
                Memory memory = memoryService.createMemory(mContent, user);
                return "I will remember that: \"" + memory.getContent() + "\"";

            case "GET_MEMORY":
                String memQuery = (String) params.get("query");
                List<Memory> memories = (memQuery != null && !memQuery.trim().isEmpty())
                        ? memoryService.searchMemoriesForUser(memQuery, user)
                        : memoryService.getMemoriesForUser(user);
                if (memories.isEmpty()) return "I don't have any saved memories about that yet.";
                return "Here is what I remember:\n" + memories.stream()
                        .map(m -> "- " + m.getContent())
                        .collect(Collectors.joining("\n"));

            case "WEB_SEARCH":
                String query = (String) params.get("query");
                List<WebSearchService.SearchResult> searchResults = webSearchService.search(query);
                return "Here are the web search results for \"" + query + "\":\n" + searchResults.stream()
                        .map(r -> "- " + r.getTitle() + "\n  Link: " + r.getLink() + "\n  " + r.getSnippet())
                        .collect(Collectors.joining("\n\n"));
                        
            case "GET_TIME":
                return "The current time is " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("hh:mm a"));

            case "GET_DATE":
                return "Today's date is " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("EEEE, MMMM dd, yyyy"));

            default:
                // Cannot execute directly on backend
                return null;
        }
    }
}
