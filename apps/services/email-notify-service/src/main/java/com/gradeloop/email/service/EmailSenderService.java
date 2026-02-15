package com.gradeloop.email.service;

import com.gradeloop.email.model.DeliveryStatus;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Recover;
import org.springframework.retry.annotation.Retryable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailSenderService {

    private final JavaMailSender mailSender;
    private final TemplateService templateService;

    @Value("${spring.mail.username}")
    private String fromEmail;

    @Retryable(retryFor = { MailSendException.class,
            MessagingException.class }, maxAttempts = 3, backoff = @Backoff(delay = 30000, multiplier = 2.0, maxDelay = 120000))
    public void sendEmail(String to, String subject, String templateName, Map<String, Object> variables) {
        log.info("Attempting to send email to {} with template {}", to, templateName);
        try {
            String htmlBody = templateService.render(templateName, variables);

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED,
                    StandardCharsets.UTF_8.name());

            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);

            mailSender.send(message);
            logStatus(to, DeliveryStatus.SENT, "Email sent successfully");

        } catch (MessagingException | MailSendException e) {
            logStatus(to, DeliveryStatus.RETRYING, "Failed to send email, retrying... Error: " + e.getMessage());
            throw new MailSendException("Failed to send email", e);
        } catch (Exception e) {
            logStatus(to, DeliveryStatus.SKIPPED, "Template rendering or other non-retryable error: " + e.getMessage());
        }
    }

    @Recover
    public void recover(Exception e, String to, String subject, String templateName, Map<String, Object> variables) {
        logStatus(to, DeliveryStatus.FAILED, "Max retries reached. Email failed to send. Error: " + e.getMessage());
    }

    private void logStatus(String to, DeliveryStatus status, String message) {
        log.info("Email Status: [{}], Recipient: [{}], Message: [{}]", status, to, message);
    }
}
