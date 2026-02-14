package com.gradeloop.iam_service.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "audit_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String event;

    @Column(nullable = false)
    private String actor;

    @Column(nullable = false)
    private String ip;

    @Column(nullable = false)
    private Instant timestamp;

    @Column(length = 2048)
    private String details;
}
