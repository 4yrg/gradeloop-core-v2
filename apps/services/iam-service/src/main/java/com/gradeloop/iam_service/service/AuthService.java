package com.gradeloop.iam_service.service;

import com.gradeloop.iam_service.domain.User;
import com.gradeloop.iam_service.domain.RefreshToken;
import com.gradeloop.iam_service.repository.UserRepository;
import com.gradeloop.iam_service.repository.RefreshTokenRepository;
import com.gradeloop.iam_service.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final AuditLogRepository auditLogRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    @Transactional
    public Optional<User> authenticate(String email, String password) {
        return userRepository.findByEmail(email)
                .filter(user -> passwordEncoder.matches(password, user.getPasswordHash()) && user.isActive());
    }

    @Transactional
    public RefreshToken createRefreshToken(User user) {
        RefreshToken token = RefreshToken.builder()
                .token(UUID.randomUUID().toString())
                .user(user)
                .expiresAt(Instant.now().plusSeconds(30 * 24 * 60 * 60)) // 30 days
                .revoked(false)
                .createdAt(Instant.now())
                .build();
        return refreshTokenRepository.save(token);
    }

    // ...other methods for refresh, activate, forgot-password, audit logging
}
