package com.assistant.controller;

import com.assistant.model.Note;
import com.assistant.model.User;
import com.assistant.repository.UserRepository;
import com.assistant.service.NoteService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notes")
public class NoteController {

    private final NoteService noteService;
    private final UserRepository userRepository;

    public NoteController(NoteService noteService, UserRepository userRepository) {
        this.noteService = noteService;
        this.userRepository = userRepository;
    }

    private User getAuthenticatedUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Authenticated user not found"));
    }

    @GetMapping
    public ResponseEntity<List<Note>> getNotes() {
        User user = getAuthenticatedUser();
        return ResponseEntity.ok(noteService.getNotesForUser(user));
    }

    @PostMapping
    public ResponseEntity<?> createNote(@RequestBody Map<String, String> payload) {
        try {
            User user = getAuthenticatedUser();
            String title = payload.get("title");
            String content = payload.get("content");
            Note note = noteService.createNote(title, content, user);
            return ResponseEntity.ok(note);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateNote(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        try {
            User user = getAuthenticatedUser();
            String title = payload.get("title");
            String content = payload.get("content");
            Note note = noteService.updateNote(id, title, content, user);
            return ResponseEntity.ok(note);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteNote(@PathVariable Long id) {
        try {
            User user = getAuthenticatedUser();
            noteService.deleteNote(id, user);
            return ResponseEntity.ok(Map.of("message", "Note deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
