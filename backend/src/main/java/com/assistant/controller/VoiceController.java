package com.assistant.controller;

import com.assistant.service.AIService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.Map;

@RestController
@RequestMapping("/api/voice")
public class VoiceController {

    private final AIService aiService;

    public VoiceController(AIService aiService) {
        this.aiService = aiService;
    }

    @PostMapping("/transcribe")
    public ResponseEntity<?> transcribe(@RequestParam("file") MultipartFile file) {
        try {
            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Uploaded file is empty"));
            }
            byte[] bytes = file.getBytes();
            String contentType = file.getContentType();
            if (contentType == null || contentType.isEmpty()) {
                contentType = "audio/mp4";
            }
            String transcript = aiService.transcribeAudio(bytes, contentType);
            return ResponseEntity.ok(Map.of("transcript", transcript));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
