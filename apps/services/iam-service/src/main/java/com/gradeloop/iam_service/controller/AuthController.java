package com.gradeloop.iam_service.controller;

import com.gradeloop.iam_service.domain.User;
import com.gradeloop.iam_service.domain.RefreshToken;
import com.gradeloop.iam_service.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String password = body.get("password");
        return authService.authenticate(email, password)
                .map(user -> {
                    RefreshToken refreshToken = authService.createRefreshToken(user);
                    // TODO: Issue JWT, log audit, return tokens
                    return ResponseEntity.ok(Map.of(
                            "access_token", "<jwt>",
                            "refresh_token", refreshToken.getToken()
                    ));
                })
                .orElseGet(() -> ResponseEntity.status(401).body(Map.of("error", "Invalid credentials")));
    }

    // TODO: Implement /refresh, /activate, /forgot-password endpoints
}
