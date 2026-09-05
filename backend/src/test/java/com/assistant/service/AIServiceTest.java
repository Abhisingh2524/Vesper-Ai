package com.assistant.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

public class AIServiceTest {

    private AIService aiService;

    @BeforeEach
    void setUp() {
        aiService = new AIService();
        // Configure test key & model
        ReflectionTestUtils.setField(aiService, "apiKey", "test-key-configured");
        ReflectionTestUtils.setField(aiService, "aiModel", "gemini-flash-lite-latest");
    }

    @Test
    void testCameraCommands_ZeroGemini() {
        String[] commands = {
                "open camera",
                "camera open",
                "camera kholo",
                "camera open karo",
                "take a photo",
                "photo lena hai",
                "Vesper, open camera please!",
                "kripya camera kholo"
        };
        for (String cmd : commands) {
            AIService.AIResponse response = aiService.parseIntent(cmd);
            assertEquals("OPEN_CAMERA", response.getToolName(), "Failed for: " + cmd);
        }
        Map<String, Object> metrics = aiService.getMetrics();
        assertEquals(0L, metrics.get("geminiChatRequests"), "Gemini should NOT be called for camera commands");
        assertEquals((long) commands.length, metrics.get("deterministicRequests"));
    }

    @Test
    void testCallCommands_ZeroGemini() {
        String[] commands = {
                "call 9876543210",
                "9876543210 par call karo",
                "call mom",
                "call contact Abhishek",
                "phone lagao 9876543210",
                "isko call karo 9876543210",
                "Vesper, please call 9876543210"
        };
        for (String cmd : commands) {
            AIService.AIResponse response = aiService.parseIntent(cmd);
            assertEquals("CALL_CONTACT", response.getToolName(), "Failed for: " + cmd);
            assertNotNull(response.getParameters().get("name"));
        }
        Map<String, Object> metrics = aiService.getMetrics();
        assertEquals(0L, metrics.get("geminiChatRequests"), "Gemini should NOT be called for call commands");
    }

    @Test
    void testMusicAndVideoCommands_ZeroGemini() {
        String[] commands = {
                "play song Believer",
                "start song Shape of You",
                "Believer bajao",
                "YouTube par Believer chalao",
                "play video Java Tutorial"
        };
        for (String cmd : commands) {
            AIService.AIResponse response = aiService.parseIntent(cmd);
            assertEquals("PLAY_SONG", response.getToolName(), "Failed for: " + cmd);
            assertNotNull(response.getParameters().get("query"));
        }

        AIService.AIResponse yt = aiService.parseIntent("open youtube");
        assertEquals("OPEN_WEBSITE", yt.getToolName());
        assertEquals("https://youtube.com", yt.getParameters().get("url"));

        Map<String, Object> metrics = aiService.getMetrics();
        assertEquals(0L, metrics.get("geminiChatRequests"), "Gemini should NOT be called for music/video commands");
    }

    @Test
    void testNoteCommands_ZeroGemini() {
        // Create note
        AIService.AIResponse c1 = aiService.parseIntent("create a note: buy groceries");
        assertEquals("CREATE_NOTE", c1.getToolName());
        assertEquals("buy groceries", c1.getParameters().get("title"));

        AIService.AIResponse c2 = aiService.parseIntent("note banao: project meeting");
        assertEquals("CREATE_NOTE", c2.getToolName());

        AIService.AIResponse c3 = aiService.parseIntent("meri note save karo: important ideas");
        assertEquals("CREATE_NOTE", c3.getToolName());

        AIService.AIResponse c4 = aiService.parseIntent("likh ke rakho: password updated");
        assertEquals("CREATE_NOTE", c4.getToolName());

        // List notes
        AIService.AIResponse l1 = aiService.parseIntent("show my notes");
        assertEquals("LIST_NOTES", l1.getToolName());

        AIService.AIResponse l2 = aiService.parseIntent("meri notes dikhao");
        assertEquals("LIST_NOTES", l2.getToolName());

        Map<String, Object> metrics = aiService.getMetrics();
        assertEquals(0L, metrics.get("geminiChatRequests"), "Gemini should NOT be called for notes");
    }

    @Test
    void testTaskCommands_ZeroGemini() {
        // Create task
        AIService.AIResponse t1 = aiService.parseIntent("create task: finish homework");
        assertEquals("CREATE_TASK", t1.getToolName());
        assertEquals("finish homework", t1.getParameters().get("title"));

        AIService.AIResponse t2 = aiService.parseIntent("task banao: study Spring Boot");
        assertEquals("CREATE_TASK", t2.getToolName());

        AIService.AIResponse t3 = aiService.parseIntent("kaam add karo: laundry");
        assertEquals("CREATE_TASK", t3.getToolName());

        // List tasks
        AIService.AIResponse l1 = aiService.parseIntent("show my tasks");
        assertEquals("LIST_TASKS", l1.getToolName());

        AIService.AIResponse l2 = aiService.parseIntent("meri tasks dikhao");
        assertEquals("LIST_TASKS", l2.getToolName());

        AIService.AIResponse l3 = aiService.parseIntent("tell me today's tasks");
        assertEquals("LIST_TASKS", l3.getToolName());

        // Complete task
        AIService.AIResponse comp1 = aiService.parseIntent("complete task: finish homework");
        assertEquals("COMPLETE_TASK", comp1.getToolName());
        assertEquals("finish homework", comp1.getParameters().get("title"));

        AIService.AIResponse comp2 = aiService.parseIntent("task complete karo: study Spring Boot");
        assertEquals("COMPLETE_TASK", comp2.getToolName());

        Map<String, Object> metrics = aiService.getMetrics();
        assertEquals(0L, metrics.get("geminiChatRequests"), "Gemini should NOT be called for tasks");
    }

    @Test
    void testMemoryCommands_ZeroGemini() {
        // Store memory
        AIService.AIResponse m1 = aiService.parseIntent("remember that my dog name is Rocky");
        assertEquals("CREATE_MEMORY", m1.getToolName());
        assertTrue(((String) m1.getParameters().get("content")).contains("Rocky"));

        AIService.AIResponse m2 = aiService.parseIntent("save this in memory: I live in Delhi");
        assertEquals("CREATE_MEMORY", m2.getToolName());

        AIService.AIResponse m3 = aiService.parseIntent("yaad rakhna mera bhai Rahul hai");
        assertEquals("CREATE_MEMORY", m3.getToolName());

        // Query memory
        AIService.AIResponse q1 = aiService.parseIntent("what is my dog name");
        assertEquals("GET_MEMORY", q1.getToolName());

        AIService.AIResponse q2 = aiService.parseIntent("what did I ask you to remember");
        assertEquals("GET_MEMORY", q2.getToolName());

        AIService.AIResponse q3 = aiService.parseIntent("who is Rocky");
        assertEquals("GET_MEMORY", q3.getToolName());

        Map<String, Object> metrics = aiService.getMetrics();
        assertEquals(0L, metrics.get("geminiChatRequests"), "Gemini should NOT be called for memory operations");
    }

    @Test
    void testTimeAndDateCommands_ZeroGemini() {
        assertEquals("GET_TIME", aiService.parseIntent("get time").getToolName());
        assertEquals("GET_TIME", aiService.parseIntent("what time is it").getToolName());
        assertEquals("GET_TIME", aiService.parseIntent("time kya hua hai").getToolName());

        assertEquals("GET_DATE", aiService.parseIntent("get date").getToolName());
        assertEquals("GET_DATE", aiService.parseIntent("today's date").getToolName());
        assertEquals("GET_DATE", aiService.parseIntent("aaj kya date hai").getToolName());

        Map<String, Object> metrics = aiService.getMetrics();
        assertEquals(0L, metrics.get("geminiChatRequests"), "Gemini should NOT be called for date/time");
    }

    @Test
    void testNormalizationStripsPoliteFillers() {
        assertEquals("open camera", aiService.normalizeInput("Vesper, open camera please!"));
        assertEquals("9876543210 par call karo", aiService.normalizeInput("kripya 9876543210 par call karo"));
        assertEquals("what is my dog name", aiService.normalizeInput("Hey Vesper, what is my dog name?"));
        assertEquals("show my notes", aiService.normalizeInput("assistant, show my notes please."));
    }

    @Test
    void testComplexAiQuestions_UseGemini() {
        // Complex AI request should fall through to callGemini (toolName is null)
        AIService.AIResponse response = aiService.parseIntent("Explain Spring Boot dependency injection in detail.");
        assertNull(response.getToolName()); // routed to Gemini
        Map<String, Object> metrics = aiService.getMetrics();
        assertEquals(1L, metrics.get("geminiChatRequests"));
    }

    @Test
    void testNaturalConversation_UsesGemini() {
        AIService.AIResponse response = aiService.parseIntent("Hello! How are you doing today? Can you chat with me?");
        assertNull(response.getToolName()); // routed to Gemini
        Map<String, Object> metrics = aiService.getMetrics();
        assertEquals(1L, metrics.get("geminiChatRequests"));
    }

    @Test
    void testVoiceWorkflow_SimpleCommand_ZeroSecondGeminiCall() {
        // Simulating the voice flow:
        // Step 1: STT transcribes audio into text e.g. "open camera"
        // Step 2: The transcript text is fed to parseIntent
        String sttTranscript = "open camera";
        AIService.AIResponse response = aiService.parseIntent(sttTranscript);
        assertEquals("OPEN_CAMERA", response.getToolName());

        // Verify zero Gemini chat requests were made for executing the transcribed command
        Map<String, Object> metrics = aiService.getMetrics();
        assertEquals(0L, metrics.get("geminiChatRequests"));
        assertEquals(1L, metrics.get("deterministicRequests"));
    }

    @Test
    void testVoiceWorkflow_ComplexQuestion_UsesGemini() {
        // Step 1: STT produces complex question
        String sttTranscript = "Explain why Java uses garbage collection and how it works.";
        // Step 2: Fed to parseIntent -> falls through to callGemini
        AIService.AIResponse response = aiService.parseIntent(sttTranscript);
        assertNull(response.getToolName());
        Map<String, Object> metrics = aiService.getMetrics();
        assertEquals(1L, metrics.get("geminiChatRequests"));
    }

    @Test
    void testFallback_DeterministicCommandsWorkEvenIfGeminiFailsOrUnavailable() {
        // Unset the API key to simulate Gemini being completely down / unavailable
        ReflectionTestUtils.setField(aiService, "apiKey", "");

        // Deterministic commands must STILL succeed without error
        assertEquals("OPEN_CAMERA", aiService.parseIntent("open camera").getToolName());
        assertEquals("CALL_CONTACT", aiService.parseIntent("call 9876543210").getToolName());
        assertEquals("PLAY_SONG", aiService.parseIntent("play song Believer").getToolName());
        assertEquals("CREATE_NOTE", aiService.parseIntent("create note: test note").getToolName());
        assertEquals("LIST_NOTES", aiService.parseIntent("show my notes").getToolName());
        assertEquals("CREATE_TASK", aiService.parseIntent("create task: test task").getToolName());
        assertEquals("LIST_TASKS", aiService.parseIntent("show my tasks").getToolName());
        assertEquals("COMPLETE_TASK", aiService.parseIntent("complete task: test task").getToolName());
        assertEquals("CREATE_MEMORY", aiService.parseIntent("remember that my dog is Rocky").getToolName());
        assertEquals("GET_MEMORY", aiService.parseIntent("what is my dog name").getToolName());

        Map<String, Object> metrics = aiService.getMetrics();
        assertEquals(0L, metrics.get("geminiChatRequests"));
        assertEquals(10L, metrics.get("deterministicRequests"));
    }
}
