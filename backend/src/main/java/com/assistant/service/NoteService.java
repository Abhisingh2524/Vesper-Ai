package com.assistant.service;

import com.assistant.model.Note;
import com.assistant.model.User;
import com.assistant.repository.NoteRepository;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class NoteService {

    private final NoteRepository noteRepository;

    public NoteService(NoteRepository noteRepository) {
        this.noteRepository = noteRepository;
    }

    public List<Note> getNotesForUser(User user) {
        return noteRepository.findByUserIdOrderByUpdatedAtDesc(user.getId());
    }

    public Note createNote(String title, String content, User user) {
        Note note = new Note();
        note.setTitle(title);
        note.setContent(content);
        note.setUser(user);
        return noteRepository.save(note);
    }

    public Note updateNote(Long noteId, String title, String content, User user) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new IllegalArgumentException("Note not found"));

        if (!note.getUser().getId().equals(user.getId())) {
            throw new SecurityException("Unauthorized access to note");
        }

        note.setTitle(title);
        note.setContent(content);
        return noteRepository.save(note);
    }

    public void deleteNote(Long noteId, User user) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new IllegalArgumentException("Note not found"));

        if (!note.getUser().getId().equals(user.getId())) {
            throw new SecurityException("Unauthorized access to note");
        }

        noteRepository.delete(note);
    }
}
