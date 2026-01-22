package com.eticketing.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.mongodb.config.EnableMongoAuditing;

@SpringBootApplication
@EnableMongoAuditing
public class EticketingApplication {

    public static void main(String[] args) {
        SpringApplication.run(EticketingApplication.class, args);
    }
}
