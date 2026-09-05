package com.assistant.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/status")
@CrossOrigin(origins = "*")
public class StatusController {

    @Autowired(required = false)
    private JdbcTemplate jdbcTemplate;

    @Value("${ai.api.key}")
    private String apiKey;

    @Autowired
    private com.assistant.service.AIService aiService;

    @GetMapping
    public Map<String, Object> getStatus() {
        Map<String, Object> status = new HashMap<>();
        
        // 1. Database Check
        boolean dbPass = false;
        try {
            if (jdbcTemplate != null) {
                jdbcTemplate.execute("SELECT 1");
                dbPass = true;
            }
        } catch (Exception e) {
            // failed
        }
        status.put("database", dbPass ? "PASS" : "ACTION REQUIRED");

        // 2. AI Key Check
        boolean aiPass = apiKey != null && !apiKey.trim().isEmpty() && !apiKey.contains("your_") && !apiKey.contains("API_KEY") && !apiKey.equals("ai.api.key");
        status.put("ai", aiPass ? "PASS" : "ACTION REQUIRED");

        // 3. Backend status
        status.put("backend", "PASS");

        // 4. System info
        status.put("os", System.getProperty("os.name"));
        
        // 5. AI Metrics & Quota Optimization
        if (aiService != null) {
            status.put("metrics", aiService.getMetrics());
        }

        return status;
    }
}
