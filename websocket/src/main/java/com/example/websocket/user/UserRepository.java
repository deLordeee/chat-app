package com.example.websocket.user;


import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface UserRepository  extends MongoRepository<User, String> {
    List<User> findAllByStatus(Status status);
    List<User> findByLastActivityBefore(LocalDateTime timestamp);

}