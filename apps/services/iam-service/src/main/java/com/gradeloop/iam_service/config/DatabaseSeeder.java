package com.gradeloop.iam_service.config;

import com.gradeloop.iam_service.domain.User;
import com.gradeloop.iam_service.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DatabaseSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        // Seed admin user if not exists
        if (userRepository.findByEmail("admin@gradeloop.com").isEmpty()) {
            User admin = User.builder()
                    .email("admin@gradeloop.com")
                    .passwordHash(passwordEncoder.encode("Admin@123456789"))
                    .role("ADMIN")
                    .active(true)
                    .build();
            userRepository.save(admin);
            log.info("Admin user created: admin@gradeloop.com");
        } else {
            log.info("Admin user already exists");
        }
    }
}
