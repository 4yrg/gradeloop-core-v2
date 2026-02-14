package com.gradeloop.iam_service.service;

import com.gradeloop.iam_service.domain.AuditLog;
import com.gradeloop.iam_service.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class AuditService {
    private static final Logger log = LoggerFactory.getLogger(AuditService.class);
    private final AuditLogRepository auditLogRepository;

    public void logEvent(String event, String actor, String ip, String details) {
        AuditLog auditLog = AuditLog.builder()
                .event(event)
                .actor(actor)
                .ip(ip)
                .timestamp(Instant.now())
                .details(maskSensitive(details))
                .build();
        auditLogRepository.save(auditLog);
        log.info("Audit event: {} by {} from {}", event, actor, ip);
    }

    private String maskSensitive(String details) {
        // TODO: Mask sensitive data in details
        return details;
    }
}
