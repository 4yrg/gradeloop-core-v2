package com.gradeloop.gateway.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsConfigurationSource;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.ServerCorsConfigurationSource;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;

import java.util.Arrays;
import java.util.List;

@Configuration
public class SecurityConfig {

    @Bean
    public CorsWebFilter corsWebFilter() {
        return new CorsWebFilter(corsConfigurationSource());
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        ServerCorsConfigurationSource source = new ServerCorsConfigurationSource();
        CorsConfiguration config = new CorsConfiguration();
        
        // Allow all origins in development
        config.setAllowedOriginPatterns(List.of("*"));
        
        // Allow common HTTP methods
        config.setAllowedMethods(Arrays.asList(
                HttpMethod.GET.name(),
                HttpMethod.POST.name(),
                HttpMethod.PUT.name(),
                HttpMethod.DELETE.name(),
                HttpMethod.PATCH.name(),
                HttpMethod.OPTIONS.name(),
                HttpMethod.HEAD.name()
        ));
        
        // Allow all headers
        config.setAllowedHeaders(List.of("*"));
        
        // Allow credentials
        config.setAllowCredentials(true);
        
        // Max age for preflight requests
        config.setMaxAge(3600L);
        
        // Expose headers in response
        config.setExposedHeaders(Arrays.asList(
                HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN,
                HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS,
                HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS,
                "X-Request-Id",
                "X-User-Id",
                "X-User-Roles"
        ));
        
        source.setCorsConfiguration(config);
        return source;
    }

    @Bean
    public WebFilter secureHeadersFilter() {
        return (exchange, chain) -> {
            ServerHttpResponse response = exchange.getResponse();
            
            // Add security headers
            response.getHeaders().add("X-Content-Type-Options", "nosniff");
            response.getHeaders().add("X-Frame-Options", "DENY");
            response.getHeaders().add("X-XSS-Protection", "1; mode=block");
            response.getHeaders().add("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
            response.getHeaders().add("Referrer-Policy", "strict-origin-when-cross-origin");
            response.getHeaders().add("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
            
            return chain.filter(exchange);
        };
    }
}
