package com.example.websocket.user;


import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Getter
@Setter
@Document
public class User {
    @Id
    private String nickName;
    private String fullName;
    private Status status;
    private LocalDateTime lastActivity;

    public void updateLastActivity() {
        lastActivity = LocalDateTime.now();
    }
}