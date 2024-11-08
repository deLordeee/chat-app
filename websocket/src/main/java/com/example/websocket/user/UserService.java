package com.example.websocket.user;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository repository;

    public void saveUser(User user) {
        user.setStatus(Status.ONLINE);
        repository.save(user);
    }

    public void disconnect(String nickname) {
        repository.findById(nickname)
                .ifPresent(user -> {
                    user.setStatus(Status.OFFLINE);
                    repository.save(user);
                });
    }

    @Scheduled(fixedRate = 60000)
    public void cleanupStaleSessions() {
        LocalDateTime timeout = LocalDateTime.now().minusMinutes(5);
        List<User> staleUsers = repository.findByLastActivityBefore(timeout);
        staleUsers.forEach(user -> {
            user.setStatus(Status.OFFLINE);
            repository.save(user);
        });
    }
    public List<User> findConnectedUsers() {
        return repository.findAllByStatus(Status.ONLINE);
    }
}