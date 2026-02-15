package com.gradeloop.gateway.filter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.reactive.error.ErrorWebExceptionHandler;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.util.Map;

@Component
@Order(-2)
public class ExceptionHandlerFilter implements ErrorWebExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ExceptionHandlerFilter.class);

    @Override
    public Mono<Void> handle(ServerWebExchange exchange, Throwable ex) {
        log.error("Gateway error occurred: path={}, error={}", exchange.getRequest().getURI().getPath(), ex.getMessage(), ex);

        if (exchange.getResponse().isCommitted()) {
            return Mono.error(ex);
        }

        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);

        HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;
        String message = "Internal server error";

        if (ex instanceof ResponseStatusException responseStatusException) {
            status = HttpStatus.valueOf(responseStatusException.getStatusCode().value());
            message = responseStatusException.getReason();
        } else if (ex.getCause() != null) {
            message = ex.getCause().getMessage();
        }

        // Map specific error types to appropriate HTTP status codes
        if (ex.getMessage() != null) {
            if (ex.getMessage().contains("Unauthorized") || ex.getMessage().contains("Invalid or expired token")) {
                status = HttpStatus.UNAUTHORIZED;
                message = "Unauthorized: Invalid or missing authentication token";
            } else if (ex.getMessage().contains("Access denied") || ex.getMessage().contains("Forbidden")) {
                status = HttpStatus.FORBIDDEN;
                message = "Access denied: Insufficient permissions";
            } else if (ex.getMessage().contains("Not found")) {
                status = HttpStatus.NOT_FOUND;
                message = "Resource not found";
            } else if (ex.getMessage().contains("timeout") || ex.getMessage().contains("Timeout")) {
                status = HttpStatus.GATEWAY_TIMEOUT;
                message = "Request timeout: Service took too long to respond";
            } else if (ex.getMessage().contains("Circuit breaker")) {
                status = HttpStatus.SERVICE_UNAVAILABLE;
                message = "Service temporarily unavailable: Circuit breaker is open";
            }
        }

        exchange.getResponse().setStatusCode(status);

        String responseBody = String.format(
                "{\"error\":\"%s\",\"message\":\"%s\",\"path\":\"%s\"}",
                status.getReasonPhrase(),
                message,
                exchange.getRequest().getURI().getPath()
        );

        return exchange.getResponse().writeWith(
                Mono.just(exchange.getResponse().bufferFactory().wrap(responseBody.getBytes(StandardCharsets.UTF_8)))
        );
    }
}
