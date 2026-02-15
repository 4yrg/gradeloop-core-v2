package com.gradeloop.email.controller;

import com.gradeloop.email.model.EmailRequest;
import com.gradeloop.email.service.EmailSenderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/email")
@RequiredArgsConstructor
public class EmailController {

    private final EmailSenderService emailSenderService;

    @PostMapping("/send")
    public ResponseEntity<String> sendEmail(@Valid @RequestBody EmailRequest request) {
        emailSenderService.sendEmail(request.getTo(), request.getSubject(), request.getTemplateName(),
                request.getVariables());
        return ResponseEntity.ok("Email processing started");
    }
}
