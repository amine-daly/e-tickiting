package com.eticketing.app.config;

import com.eticketing.app.user.PhoneType;
import com.eticketing.app.user.RoleType;
import com.eticketing.app.user.UserType;
import com.eticketing.app.user.UserTypeRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@Configuration
public class DataInitializer implements ApplicationRunner {

    private final UserTypeRepository users;

    @Value("${SEED_ADMIN:true}")
    private boolean seedAdmin;

    public DataInitializer(UserTypeRepository users) {
        this.users = users;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!seedAdmin) return;

        // Seed an admin if none exists
        boolean hasAdmin = users.findAll().stream().anyMatch(u -> u.getRole() == RoleType.ADMIN);
        if (!hasAdmin) {
            var encoder = new BCryptPasswordEncoder();
            var admin = new UserType(
                    "Admin",
                    "User",
                    "admin@eticketing.local",
                    new PhoneType("+212", "600000000"),
                    encoder.encode("Admin@123"),
                    RoleType.ADMIN
            );
            try {
                users.save(admin);
            } catch (Exception ignored) {
                // ignore duplicates if parallel startups
            }
        }
    }
}
