package com.gradeloop.email.config;

import org.springframework.amqp.core.Queue;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    // Defined but unused as per requirements
    public static final String QUEUE_NAME = "email-notification-queue";

    @Bean
    public Queue emailQueue() {
        return new Queue(QUEUE_NAME, true);
    }
}
