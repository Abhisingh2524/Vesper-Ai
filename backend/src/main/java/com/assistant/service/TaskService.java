package com.assistant.service;

import com.assistant.model.Task;
import com.assistant.model.User;
import com.assistant.repository.TaskRepository;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class TaskService {

    private final TaskRepository taskRepository;

    public TaskService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    public List<Task> getTasksForUser(User user) {
        return taskRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
    }

    public Task createTask(String title, String description, String priority, LocalDateTime dueDate, LocalDateTime reminderTime, User user) {
        Task task = new Task();
        task.setTitle(title);
        task.setDescription(description);
        task.setCompleted(false);
        task.setPriority(priority != null ? priority : "MEDIUM");
        task.setDueDate(dueDate);
        task.setReminderTime(reminderTime);
        task.setUser(user);
        return taskRepository.save(task);
    }

    public Task updateTask(Long taskId, String title, String description, boolean completed, String priority, LocalDateTime dueDate, LocalDateTime reminderTime, User user) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found"));

        if (!task.getUser().getId().equals(user.getId())) {
            throw new SecurityException("Unauthorized access to task");
        }

        task.setTitle(title);
        task.setDescription(description);
        task.setCompleted(completed);
        task.setPriority(priority);
        task.setDueDate(dueDate);
        task.setReminderTime(reminderTime);
        return taskRepository.save(task);
    }

    public void deleteTask(Long taskId, User user) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found"));

        if (!task.getUser().getId().equals(user.getId())) {
            throw new SecurityException("Unauthorized access to task");
        }

        taskRepository.delete(task);
    }

    public Task completeTaskByTitle(String title, User user) {
        List<Task> tasks = taskRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        if (title == null || title.trim().isEmpty()) {
            for (Task task : tasks) {
                if (!task.isCompleted()) {
                    task.setCompleted(true);
                    return taskRepository.save(task);
                }
            }
            return null;
        }
        String t = title.toLowerCase().trim();
        for (Task task : tasks) {
            if (!task.isCompleted() && task.getTitle().toLowerCase().contains(t)) {
                task.setCompleted(true);
                return taskRepository.save(task);
            }
        }
        return null;
    }
}
