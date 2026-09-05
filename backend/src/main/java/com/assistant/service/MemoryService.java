package com.assistant.service;

import com.assistant.model.Memory;
import com.assistant.model.User;
import com.assistant.repository.MemoryRepository;
import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.List;

@Service
public class MemoryService {

    private final MemoryRepository memoryRepository;

    public MemoryService(MemoryRepository memoryRepository) {
        this.memoryRepository = memoryRepository;
    }

    public List<Memory> getMemoriesForUser(User user) {
        return memoryRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
    }

    public List<Memory> searchMemoriesForUser(String query, User user) {
        List<Memory> all = getMemoriesForUser(user);
        if (query == null || query.trim().isEmpty()) {
            return all;
        }
        String q = query.toLowerCase().trim();
        List<Memory> matched = new ArrayList<>();
        for (Memory m : all) {
            String content = m.getContent().toLowerCase();
            if (content.contains(q)) {
                matched.add(m);
            }
        }
        if (!matched.isEmpty()) {
            return matched;
        }
        // Match key keywords
        String[] words = q.split("\\s+");
        for (Memory m : all) {
            String content = m.getContent().toLowerCase();
            for (String w : words) {
                if (w.length() > 2 && content.contains(w) && !matched.contains(m)) {
                    matched.add(m);
                }
            }
        }
        return matched.isEmpty() ? all : matched;
    }

    public Memory createMemory(String content, User user) {
        Memory memory = new Memory(content, user);
        return memoryRepository.save(memory);
    }

    public Memory updateMemory(Long memoryId, String content, User user) {
        Memory memory = memoryRepository.findById(memoryId)
                .orElseThrow(() -> new IllegalArgumentException("Memory not found"));

        if (!memory.getUser().getId().equals(user.getId())) {
            throw new SecurityException("Unauthorized access to memory");
        }

        memory.setContent(content);
        return memoryRepository.save(memory);
    }

    public void deleteMemory(Long memoryId, User user) {
        Memory memory = memoryRepository.findById(memoryId)
                .orElseThrow(() -> new IllegalArgumentException("Memory not found"));

        if (!memory.getUser().getId().equals(user.getId())) {
            throw new SecurityException("Unauthorized access to memory");
        }

        memoryRepository.delete(memory);
    }
}
