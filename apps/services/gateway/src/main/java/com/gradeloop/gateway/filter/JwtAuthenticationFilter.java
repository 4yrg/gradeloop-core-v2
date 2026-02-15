package com.gradeloop.gateway.filter;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.ResourceLoader;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.List;

@Component
public class JwtAuthenticationFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);
    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";
    private static final String USER_ID_HEADER = "X-User-Id";
    private static final String USER_ROLES_HEADER = "X-User-Roles";
    private static final String USER_EMAIL_HEADER = "X-User-Email";
    private static final String USER_NAME_HEADER = "X-User-Name";

    private final RSAPublicKey publicKey;

    public JwtAuthenticationFilter(
            @Value("${jwt.public-key:classpath:public_key.pem}") String publicKeyLocation,
            ResourceLoader resourceLoader) {
        this.publicKey = loadPublicKey(publicKeyLocation, resourceLoader);
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();

        // Skip JWT validation for public endpoints
        if (isPublicEndpoint(path)) {
            return chain.filter(exchange);
        }

        String authHeader = request.getHeaders().getFirst(AUTHORIZATION_HEADER);

        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
            return unauthorized(exchange.getResponse(), "Missing or invalid Authorization header");
        }

        String token = authHeader.substring(BEARER_PREFIX.length());

        try {
            Claims claims = validateToken(token);
            return addUserHeaders(exchange, chain, claims);
        } catch (Exception e) {
            log.error("JWT validation failed for path {}: {}", path, e.getMessage());
            return unauthorized(exchange.getResponse(), "Invalid or expired token");
        }
    }

    private boolean isPublicEndpoint(String path) {
        // Public endpoints that don't require authentication
        return path.startsWith("/auth/")
                || path.startsWith("/actuator/health")
                || path.equals("/actuator")
                || path.startsWith("/fallback/")
                || path.equals("/");
    }

    private Claims validateToken(String token) {
        return Jwts.parser()
                .verifyWith(publicKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private Mono<Void> addUserHeaders(ServerWebExchange exchange, GatewayFilterChain chain, Claims claims) {
        ServerHttpRequest.Builder requestBuilder = exchange.getRequest().mutate();

        String userId = claims.getSubject();
        if (userId != null) {
            requestBuilder.header(USER_ID_HEADER, userId);
        }

        Object rolesClaim = claims.get("roles");
        if (rolesClaim != null) {
            String roles;
            if (rolesClaim instanceof List) {
                roles = String.join(",", (List<?>) rolesClaim);
            } else {
                roles = rolesClaim.toString();
            }
            requestBuilder.header(USER_ROLES_HEADER, roles);
        }

        String email = claims.get("email", String.class);
        if (email != null) {
            requestBuilder.header(USER_EMAIL_HEADER, email);
        }

        String name = claims.get("name", String.class);
        if (name != null) {
            requestBuilder.header(USER_NAME_HEADER, name);
        }

        return chain.filter(exchange.mutate().request(requestBuilder.build()).build());
    }

    private Mono<Void> unauthorized(ServerHttpResponse response, String message) {
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        response.getHeaders().add("Content-Type", "application/json");
        String body = String.format("{\"error\":\"Unauthorized\",\"message\":\"%s\"}", message);
        return response.writeWith(Mono.just(response.bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8))));
    }

    private RSAPublicKey loadPublicKey(String location, ResourceLoader resourceLoader) {
        try {
            String keyPath = location.replace("classpath:", "");
            InputStream inputStream = resourceLoader.getResource(keyPath).getInputStream();
            String keyContent = new String(inputStream.readAllBytes(), StandardCharsets.UTF_8)
                    .replace("-----BEGIN PUBLIC KEY-----", "")
                    .replace("-----END PUBLIC KEY-----", "")
                    .replaceAll("\\s", "");

            byte[] keyBytes = Base64.getDecoder().decode(keyContent);
            X509EncodedKeySpec keySpec = new X509EncodedKeySpec(keyBytes);
            KeyFactory keyFactory = KeyFactory.getInstance("RSA");
            return (RSAPublicKey) keyFactory.generatePublic(keySpec);
        } catch (Exception e) {
            log.error("Failed to load public key from {}: {}", location, e.getMessage());
            throw new IllegalStateException("Failed to load JWT public key", e);
        }
    }

    @Override
    public int getOrder() {
        // Execute after route matching but before other filters
        return Ordered.LOWEST_PRECEDENCE - 1;
    }
}
