package com.assistant.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.*;

@Service
public class AIService {

    @Value("${ai.api.key}")
    private String apiKey;

    @Value("${ai.model:gemini-flash-lite-latest}")
    private String aiModel;

    // Metrics tracking
    private final AtomicLong totalRequests = new AtomicLong(0);
    private final AtomicLong deterministicRequests = new AtomicLong(0);
    private final AtomicLong geminiChatRequests = new AtomicLong(0);
    private final AtomicLong geminiTranscriptionRequests = new AtomicLong(0);
    private final AtomicLong geminiSuccessRequests = new AtomicLong(0);
    private final AtomicLong geminiFailedRequests = new AtomicLong(0);
    private final AtomicLong geminiRateLimitRequests = new AtomicLong(0);

    private final RestTemplate restTemplate;

    public AIService() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(8000); // 8s
        factory.setReadTimeout(12000);   // 12s
        this.restTemplate = new RestTemplate(factory);
    }

    // Deduplication cache (5s window to prevent accidental double-clicks / repeated submits)
    private static class CacheEntry {
        final String reply;
        final long timestamp;
        CacheEntry(String reply) {
            this.reply = reply;
            this.timestamp = System.currentTimeMillis();
        }
    }
    private final Map<String, CacheEntry> deduplicationCache = new ConcurrentHashMap<>();
    private static final long DEDUP_WINDOW_MS = 5000;

    public static class AIResponse {
        private String reply;
        private String toolName;
        private Map<String, Object> parameters;

        public AIResponse(String reply, String toolName, Map<String, Object> parameters) {
            this.reply = reply;
            this.toolName = toolName;
            this.parameters = parameters;
        }

        public String getReply() { return reply; }
        public String getToolName() { return toolName; }
        public Map<String, Object> getParameters() { return parameters; }
    }

    /**
     * Normalizes user input by trimming, stripping leading assistant wake words,
     * stripping polite prefixes/suffixes, and cleaning punctuation.
     */
    public String normalizeInput(String raw) {
        if (raw == null) return "";
        String text = raw.trim();
        // Remove leading assistant wake words
        text = text.replaceAll("(?i)^(\\b(hey|ok|hi|hello)?\\s*(vesper|assistant|bot)\\b[,:]?\\s*)+", "");
        // Remove leading polite words
        text = text.replaceAll("(?i)^(\\b(please|kripya|zara|bhai|can you|could you|would you)\\b\\s*)+", "");
        // Remove trailing punctuation
        text = text.replaceAll("[.?!,;]+$", "").trim();
        // Remove trailing polite words
        text = text.replaceAll("(?i)\\s+\\b(please|kripya|zara|bhai)\\b$", "").trim();
        // Normalize whitespace
        text = text.replaceAll("\\s+", " ").trim();
        return text;
    }

    public AIResponse parseIntent(String command) {
        if (command == null || command.trim().isEmpty()) {
            return new AIResponse("Please provide a command.", null, null);
        }

        totalRequests.incrementAndGet();
        String original = command.trim();
        String norm = normalizeInput(original);
        String normLower = norm.toLowerCase();
        Map<String, Object> params = new HashMap<>();

        // -------------------------------------------------------------
        // ZERO-GEMINI DETERMINISTIC ROUTING
        // -------------------------------------------------------------

        // 1. Phone Camera Intent (English & Hindi)
        if (isCameraCommand(normLower)) {
            deterministicRequests.incrementAndGet();
            return new AIResponse("Opening camera...", "OPEN_CAMERA", params);
        }

        // 2. Phone Call Intent (English & Hindi)
        String callTarget = extractCallTarget(norm, normLower);
        if (callTarget != null) {
            deterministicRequests.incrementAndGet();
            params.put("name", callTarget);
            return new AIResponse("Preparing to call " + callTarget, "CALL_CONTACT", params);
        }

        // 3. YouTube & Music / Video Intent
        if (normLower.equals("open youtube") || normLower.equals("youtube open karo") || normLower.equals("youtube kholo")) {
            deterministicRequests.incrementAndGet();
            params.put("url", "https://youtube.com");
            return new AIResponse("Opening YouTube in browser.", "OPEN_WEBSITE", params);
        }
        String songQuery = extractSongQuery(norm, normLower);
        if (songQuery != null) {
            deterministicRequests.incrementAndGet();
            params.put("query", songQuery);
            return new AIResponse("Playing: " + songQuery, "PLAY_SONG", params);
        }

        // 4. Notes Intents
        // 4a. Show / List Notes
        if (isListNotesCommand(normLower)) {
            deterministicRequests.incrementAndGet();
            return new AIResponse("Fetching your notes.", "LIST_NOTES", params);
        }
        // 4b. Create Note
        String noteTitle = extractNoteTitle(norm, normLower);
        if (noteTitle != null) {
            deterministicRequests.incrementAndGet();
            params.put("title", noteTitle);
            params.put("content", "Saved via voice/text command.");
            return new AIResponse("Creating note: " + noteTitle, "CREATE_NOTE", params);
        }

        // 5. Tasks Intents
        // 5a. Show / List Tasks
        if (isListTasksCommand(normLower)) {
            deterministicRequests.incrementAndGet();
            return new AIResponse("Fetching pending tasks.", "LIST_TASKS", params);
        }
        // 5b. Complete Task
        String completeTaskTitle = extractCompleteTaskTitle(norm, normLower);
        if (completeTaskTitle != null) {
            deterministicRequests.incrementAndGet();
            params.put("title", completeTaskTitle);
            return new AIResponse("Completing task: " + completeTaskTitle, "COMPLETE_TASK", params);
        }
        // 5c. Create Task
        String taskTitle = extractCreateTaskTitle(norm, normLower);
        if (taskTitle != null) {
            deterministicRequests.incrementAndGet();
            params.put("title", taskTitle);
            params.put("priority", "MEDIUM");
            return new AIResponse("Adding task: " + taskTitle, "CREATE_TASK", params);
        }

        // 6. Memory Intents
        // 6a. Remember Memory (Store)
        String memoryFact = extractMemoryFact(norm, normLower);
        if (memoryFact != null) {
            deterministicRequests.incrementAndGet();
            params.put("content", memoryFact);
            return new AIResponse("Saving to long-term memory: " + memoryFact, "CREATE_MEMORY", params);
        }
        // 6b. Query Memory (Direct database retrieval)
        String memoryQuery = extractMemoryQuery(norm, normLower);
        if (memoryQuery != null) {
            deterministicRequests.incrementAndGet();
            params.put("query", memoryQuery);
            return new AIResponse("Checking my memory core...", "GET_MEMORY", params);
        }

        // 7. Time & Date
        if (isTimeCommand(normLower)) {
            deterministicRequests.incrementAndGet();
            return new AIResponse("Fetching current time.", "GET_TIME", params);
        }
        if (isDateCommand(normLower)) {
            deterministicRequests.incrementAndGet();
            return new AIResponse("Fetching current date.", "GET_DATE", params);
        }

        // 8. SMS Intent
        Pattern smsPattern = Pattern.compile("(?i)^send\\s+(?:sms\\s+to\\s+|sms\\s+|to\\s+)?([a-zA-Z0-9\\s]+):\\s*(.+)$");
        Matcher smsMatcher = smsPattern.matcher(norm);
        if (smsMatcher.matches()) {
            deterministicRequests.incrementAndGet();
            params.put("recipient", smsMatcher.group(1).trim());
            params.put("message", smsMatcher.group(2).trim());
            return new AIResponse("Preparing to send SMS to " + smsMatcher.group(1), "SEND_SMS", params);
        }

        // 9. Web Search Intent
        Pattern searchPattern = Pattern.compile("(?i)^search\\s+the\\s+web\\s+for\\s+(.+)$");
        Matcher searchMatcher = searchPattern.matcher(norm);
        if (searchMatcher.matches()) {
            deterministicRequests.incrementAndGet();
            params.put("query", searchMatcher.group(1).trim());
            return new AIResponse("Searching the web for: " + searchMatcher.group(1), "WEB_SEARCH", params);
        }

        // 10. Local App & File Launchers
        if (normLower.equals("open chrome") || normLower.equals("chrome kholo") || normLower.equals("chrome open karo")) {
            deterministicRequests.incrementAndGet();
            params.put("name", "Chrome");
            return new AIResponse("Opening Chrome browser.", "OPEN_APP", params);
        }
        if (normLower.equals("open my java project")) {
            deterministicRequests.incrementAndGet();
            params.put("path", "C:/Users/Abhishek Singh/.gemini/antigravity/scratch/personal-ai-assistant");
            return new AIResponse("Opening Java project folder.", "OPEN_FILE", params);
        }
        Pattern openFilePattern = Pattern.compile("(?i)^open\\s+file\\s+(.+)$");
        Matcher openFileMatcher = openFilePattern.matcher(norm);
        if (openFileMatcher.matches()) {
            deterministicRequests.incrementAndGet();
            params.put("path", openFileMatcher.group(1).trim());
            return new AIResponse("Opening file: " + openFileMatcher.group(1), "OPEN_FILE", params);
        }
        Pattern searchFilePattern = Pattern.compile("(?i)^search\\s+my\\s+laptop\\s+for\\s+(.+)$");
        Matcher searchFileMatcher = searchFilePattern.matcher(norm);
        if (searchFileMatcher.matches()) {
            deterministicRequests.incrementAndGet();
            params.put("query", searchFileMatcher.group(1).trim());
            return new AIResponse("Searching laptop for file matching: " + searchFileMatcher.group(1), "SEARCH_FILE", params);
        }

        // 11. Reminder Intent
        Pattern reminderPattern = Pattern.compile("(?i)^set\\s+a\\s+reminder\\s+for\\s+(.+)$");
        Matcher reminderMatcher = reminderPattern.matcher(norm);
        if (reminderMatcher.matches()) {
            deterministicRequests.incrementAndGet();
            params.put("time", reminderMatcher.group(1).trim());
            params.put("message", "Assistant Reminder");
            return new AIResponse("Setting reminder for " + reminderMatcher.group(1), "CREATE_REMINDER", params);
        }

        // -------------------------------------------------------------
        // FALLBACK: ONLY NOW DO WE CALL GEMINI FOR REASONING / CHAT
        // -------------------------------------------------------------
        geminiChatRequests.incrementAndGet();
        String aiReply = callGemini(original);
        return new AIResponse(aiReply, null, null);
    }

    private boolean isCameraCommand(String s) {
        if (s.contains("camera") || s.contains("photo") || s.contains("picture") || s.contains("tasveer") || s.contains("selfie")) {
            return true;
        }
        return s.equals("open camera") || s.equals("camera open") || s.equals("camera kholo")
                || s.equals("camera open karo") || s.equals("camera on karo") || s.equals("camera chalao")
                || s.equals("take a photo") || s.equals("take a picture") || s.equals("take photo")
                || s.equals("take picture") || s.equals("click a photo") || s.equals("click a picture")
                || s.equals("photo khincho") || s.equals("photo lena hai") || s.equals("tasveer lo")
                || s.equals("launch camera") || s.equals("start camera");
    }

    private String extractCallTarget(String norm, String normLower) {
        // Pattern 1: call [target]
        Pattern p1 = Pattern.compile("(?i)^call\\s+(?:to\\s+|contact\\s+)?([a-zA-Z0-9+\\s-]+)$");
        Matcher m1 = p1.matcher(norm);
        if (m1.matches()) {
            return m1.group(1).trim();
        }
        // Pattern 2: [number/target] par call karo / phone lagao / call lagao
        Pattern p2 = Pattern.compile("(?i)^([a-zA-Z0-9+\\s-]+?)\\s*(?:par|pe|ko)?\\s*(?:call|phone)\\s*(?:karo|lagao|milao)$");
        Matcher m2 = p2.matcher(norm);
        if (m2.matches()) {
            return m2.group(1).trim();
        }
        // Pattern 3: phone lagao [target] / isko call karo [target]
        Pattern p3 = Pattern.compile("(?i)^(?:phone\\s+lagao|isko\\s+call\\s+karo)\\s*([a-zA-Z0-9+\\s-]+)$");
        Matcher m3 = p3.matcher(norm);
        if (m3.matches()) {
            return m3.group(1).trim();
        }
        return null;
    }

    private String extractSongQuery(String norm, String normLower) {
        // Pattern 1: play [song/video/music] [title]
        Pattern p1 = Pattern.compile("(?i)^(?:play\\s+(?:song|video|music)?|start\\s+(?:song|video|music))\\s+(.+)$");
        Matcher m1 = p1.matcher(norm);
        if (m1.matches()) {
            return m1.group(1).trim();
        }
        // Pattern 2: [title] [chalao/bajao/play karo]
        Pattern p2 = Pattern.compile("(?i)^(.+?)\\s*(?:song|gana)?\\s*(?:chalao|bajao|play\\s+karo)$");
        Matcher m2 = p2.matcher(norm);
        if (m2.matches()) {
            return m2.group(1).trim();
        }
        // Pattern 3: youtube par [title] chalao/bajao
        Pattern p3 = Pattern.compile("(?i)^youtube\\s*(?:par|pe)?\\s*(.+?)\\s*(?:chalao|bajao|play\\s+karo|play)?$");
        Matcher m3 = p3.matcher(norm);
        if (m3.matches()) {
            return m3.group(1).trim();
        }
        return null;
    }

    private boolean isListNotesCommand(String s) {
        return s.equals("show my notes") || s.equals("show notes") || s.equals("list my notes")
                || s.equals("list notes") || s.equals("get notes") || s.equals("meri notes dikhao")
                || s.equals("notes dikhao") || s.equals("saari notes dikhao") || s.equals("saari notes batao")
                || s.equals("meri notes batao");
    }

    private String extractNoteTitle(String norm, String normLower) {
        Pattern p1 = Pattern.compile("(?i)^(?:create\\s+(?:a\\s+)?note|add\\s+note|save\\s+(?:this\\s+)?note|remember\\s+this\\s+note|note\\s+banao|meri\\s+note\\s+save\\s+karo|likh\\s+ke\\s+rakho|isko\\s+note\\s+kar\\s+lo|note\\s+likho):?\\s*(.*)$");
        Matcher m1 = p1.matcher(norm);
        if (m1.matches()) {
            String val = m1.group(1).trim();
            return val.isEmpty() ? "Quick Note" : val;
        }
        return null;
    }

    private boolean isListTasksCommand(String s) {
        return s.equals("show my tasks") || s.equals("show tasks") || s.equals("show my pending tasks")
                || s.equals("list my tasks") || s.equals("list tasks") || s.equals("tell me today's tasks")
                || s.equals("meri tasks dikhao") || s.equals("tasks dikhao") || s.equals("pending kaam dikhao")
                || s.equals("kya kya kaam hai") || s.equals("kaam dikhao") || s.equals("today's tasks");
    }

    private String extractCompleteTaskTitle(String norm, String normLower) {
        Pattern p1 = Pattern.compile("(?i)^(?:complete\\s+(?:the\\s+)?task|mark\\s+task\\s+(?:as\\s+)?(?:done|completed)|finish\\s+task|task\\s+complete\\s+karo|kaam\\s+complete\\s+karo|task\\s+khatam\\s+ho\\s+gaya):?\\s*(.*)$");
        Matcher m1 = p1.matcher(norm);
        if (m1.matches()) {
            return m1.group(1).trim();
        }
        return null;
    }

    private String extractCreateTaskTitle(String norm, String normLower) {
        Pattern p1 = Pattern.compile("(?i)^(?:create\\s+(?:a\\s+)?task|add\\s+(?:a\\s+)?task|add\\s+todo|new\\s+task|task\\s+banao|kaam\\s+add\\s+karo|todo\\s+banao|naya\\s+task):?\\s*(.*)$");
        Matcher m1 = p1.matcher(norm);
        if (m1.matches()) {
            String val = m1.group(1).trim();
            return val.isEmpty() ? "New Task" : val;
        }
        return null;
    }

    private String extractMemoryFact(String norm, String normLower) {
        Pattern p1 = Pattern.compile("(?i)^(?:remember\\s+(?:that\\s+)?|save\\s+this\\s+in\\s+memory:?\\s*|save\\s+in\\s+memory:?\\s*|yaad\\s+rakhna\\s+(?:ki\\s+)?|isko\\s+yaad\\s+rakh(?:na)?:?\\s*|ye\\s+yaad\\s+rakho\\s+(?:ki\\s+)?|memory\\s+me\\s+save\\s+karo:?\\s*)(.+)$");
        Matcher m1 = p1.matcher(norm);
        if (m1.matches()) {
            return m1.group(1).trim();
        }
        return null;
    }

    private String extractMemoryQuery(String norm, String normLower) {
        Pattern p1 = Pattern.compile("(?i)^(?:what\\s+is\\s+my|who\\s+is\\s+my|who\\s+is|what\\s+did\\s+i\\s+(?:ask\\s+you\\s+to\\s+|tell\\s+you\\s+to\\s+)?remember|what\\s+do\\s+you\\s+remember|do\\s+you\\s+remember|tell\\s+me\\s+about\\s+my|kya\\s+tumhe\\s+yaad\\s+hai|mujhe\\s+batao\\s+mera)\\s*(.*)$");
        Matcher m1 = p1.matcher(norm);
        if (m1.matches()) {
            String topic = m1.group(1).trim();
            return topic.isEmpty() ? norm : topic;
        }
        if (normLower.contains("dog's name") || normLower.contains("dog name") || normLower.contains("kya yaad hai") || normLower.contains("meri memory")) {
            return norm;
        }
        return null;
    }

    private boolean isTimeCommand(String s) {
        return s.equals("get time") || s.equals("what time is it") || s.equals("current time")
                || s.equals("time kya hua hai") || s.equals("kya time ho raha hai") || s.equals("kitne baje hain")
                || s.equals("time batao");
    }

    private boolean isDateCommand(String s) {
        return s.equals("get date") || s.equals("what is today's date") || s.equals("today's date")
                || s.equals("aaj kya date hai") || s.equals("aaj ki tarikh") || s.equals("tarikh kya hai")
                || s.equals("date batao");
    }

    public String callGemini(String prompt) {
        if (apiKey == null || apiKey.trim().isEmpty() || apiKey.contains("your_") || apiKey.contains("API_KEY") || apiKey.equals("ai.api.key")) {
            return "AI API key not configured";
        }

        // Deduplication check (5-second window)
        String dedupKey = prompt.trim().toLowerCase();
        CacheEntry cached = deduplicationCache.get(dedupKey);
        long now = System.currentTimeMillis();
        if (cached != null && (now - cached.timestamp) < DEDUP_WINDOW_MS) {
            return cached.reply;
        }

        try {
            String model = (aiModel != null && !aiModel.trim().isEmpty()) ? aiModel.trim() : "gemini-flash-lite-latest";
            String url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;

            Map<String, Object> textPart = new HashMap<>();
            textPart.put("text", prompt);

            Map<String, Object> partObj = new HashMap<>();
            partObj.put("parts", Collections.singletonList(textPart));

            Map<String, Object> contentObj = new HashMap<>();
            contentObj.put("contents", Collections.singletonList(partObj));

            Map<String, Object> response = restTemplate.postForObject(url, contentObj, Map.class);
            if (response != null && response.containsKey("candidates")) {
                List candidates = (List) response.get("candidates");
                if (!candidates.isEmpty()) {
                    Map candidate = (Map) candidates.get(0);
                    Map content = (Map) candidate.get("content");
                    List parts = (List) content.get("parts");
                    if (!parts.isEmpty()) {
                        Map part = (Map) parts.get(0);
                        String reply = (String) part.get("text");
                        if (reply != null) {
                            geminiSuccessRequests.incrementAndGet();
                            deduplicationCache.put(dedupKey, new CacheEntry(reply));
                            return reply;
                        }
                    }
                }
            }
            geminiFailedRequests.incrementAndGet();
            return "Error parsing AI response";
        } catch (HttpStatusCodeException e) {
            int statusCode = e.getStatusCode().value();
            String responseBody = e.getResponseBodyAsString() != null ? e.getResponseBodyAsString().toLowerCase() : "";
            if (statusCode == 429 || responseBody.contains("resource_exhausted") || responseBody.contains("quota") || responseBody.contains("rate limit")) {
                geminiRateLimitRequests.incrementAndGet();
                return "AI is temporarily unavailable due to rate limits or quota limits. Your saved notes, tasks, memory, and device commands (camera, calls, music, etc.) are still fully functional.";
            }
            geminiFailedRequests.incrementAndGet();
            return "AI service is temporarily unavailable (" + statusCode + "). Please try again.";
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage().toLowerCase() : "";
            if (msg.contains("429") || msg.contains("quota") || msg.contains("rate limit")) {
                geminiRateLimitRequests.incrementAndGet();
                return "AI is temporarily unavailable due to rate limits or quota limits. Your saved notes, tasks, memory, and device commands (camera, calls, music, etc.) are still fully functional.";
            }
            geminiFailedRequests.incrementAndGet();
            return "AI service request failed. Please try again shortly.";
        }
    }

    public String transcribeAudio(byte[] audioBytes, String mimeType) {
        if (apiKey == null || apiKey.trim().isEmpty() || apiKey.contains("your_") || apiKey.contains("API_KEY") || apiKey.equals("ai.api.key")) {
            return "AI API key not configured";
        }
        geminiTranscriptionRequests.incrementAndGet();
        try {
            String model = (aiModel != null && !aiModel.trim().isEmpty()) ? aiModel.trim() : "gemini-flash-lite-latest";
            String url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;

            String base64Audio = Base64.getEncoder().encodeToString(audioBytes);
            Map<String, Object> inlineData = new HashMap<>();
            inlineData.put("mimeType", mimeType != null ? mimeType : "audio/mp4");
            inlineData.put("data", base64Audio);

            Map<String, Object> audioPart = new HashMap<>();
            audioPart.put("inlineData", inlineData);

            Map<String, Object> textPart = new HashMap<>();
            textPart.put("text", "Transcribe the speech in this audio exactly. Output only the transcript, nothing else. If there is no speech, return an empty string.");

            Map<String, Object> partObj = new HashMap<>();
            partObj.put("parts", Arrays.asList(audioPart, textPart));

            Map<String, Object> contentObj = new HashMap<>();
            contentObj.put("contents", Collections.singletonList(partObj));

            Map<String, Object> response = restTemplate.postForObject(url, contentObj, Map.class);
            if (response != null && response.containsKey("candidates")) {
                List candidates = (List) response.get("candidates");
                if (!candidates.isEmpty()) {
                    Map candidate = (Map) candidates.get(0);
                    Map content = (Map) candidate.get("content");
                    List parts = (List) content.get("parts");
                    if (!parts.isEmpty()) {
                        Map part = (Map) parts.get(0);
                        geminiSuccessRequests.incrementAndGet();
                        return ((String) part.get("text")).trim();
                    }
                }
            }
            geminiFailedRequests.incrementAndGet();
            return "Error parsing transcription response";
        } catch (HttpStatusCodeException e) {
            if (e.getStatusCode().value() == 429) {
                geminiRateLimitRequests.incrementAndGet();
                return "Voice AI is temporarily unavailable due to rate limits. You can still type your commands.";
            }
            geminiFailedRequests.incrementAndGet();
            return "Transcription failed: " + e.getStatusCode();
        } catch (Exception e) {
            geminiFailedRequests.incrementAndGet();
            return "Transcription failed: " + e.getMessage();
        }
    }

    public Map<String, Object> getMetrics() {
        Map<String, Object> metrics = new LinkedHashMap<>();
        long total = totalRequests.get();
        long deterministic = deterministicRequests.get();
        long chat = geminiChatRequests.get();
        long transcription = geminiTranscriptionRequests.get();
        long success = geminiSuccessRequests.get();
        long failed = geminiFailedRequests.get();
        long rateLimit = geminiRateLimitRequests.get();

        metrics.put("totalRequests", total);
        metrics.put("deterministicRequests", deterministic);
        metrics.put("geminiChatRequests", chat);
        metrics.put("geminiTranscriptionRequests", transcription);
        metrics.put("geminiSuccessRequests", success);
        metrics.put("geminiFailedRequests", failed);
        metrics.put("geminiRateLimitRequests", rateLimit);

        double savingsPercent = total > 0 ? ((double) deterministic / total) * 100.0 : 0.0;
        metrics.put("geminiSavingsPercentage", String.format(Locale.US, "%.1f%%", savingsPercent));
        metrics.put("activeModel", (aiModel != null && !aiModel.trim().isEmpty()) ? aiModel.trim() : "gemini-flash-lite-latest");
        return metrics;
    }
}
