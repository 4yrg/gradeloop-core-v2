package com.gradeloop.gateway.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/fallback")
public class FallbackController {

    @GetMapping("/iam")
    public ResponseEntity<Map<String, Object>> iamFallback() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of(
                        "error", "Service Unavailable",
                        "message", "The IAM service is temporarily unavailable. Please try again later.",
                        "retryable", true
                ));
    }

    @GetMapping("/academics")
    public ResponseEntity<Map<String, Object>> academicsFallback() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of(
                        "error", "Service Unavailable",
                        "message", "The Academics service is temporarily unavailable. Please try again later.",
                        "retryable", true
                ));
    }

    @GetMapping("/default")
    public ResponseEntity<Map<String, Object>> defaultFallback() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of(
                        "error", "Service Unavailable",
                        "message", "Service is temporarily unavailable. Please try again later.",
                        "retryable", true
                ));
    }
}
