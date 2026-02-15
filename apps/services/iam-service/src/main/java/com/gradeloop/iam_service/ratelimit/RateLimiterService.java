package com.gradeloop.iam_service.ratelimit;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Bucket4j;
import io.github.bucket4j.Refill;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RateLimiterService {
    private final RedisTemplate<String, String> redisTemplate;
    private final Map<String, Bucket> localBuckets = new ConcurrentHashMap<>();
    private final boolean redisEnabled;

    public RateLimiterService(RedisTemplate<String, String> redisTemplate, @Value("${spring.redis.host:}") String redisHost) {
        this.redisTemplate = redisTemplate;
        this.redisEnabled = redisHost != null && !redisHost.isEmpty();
    }

    public boolean tryConsume(String key) {
        if (redisEnabled && redisTemplate.getConnectionFactory() != null) {
            // TODO: Implement Redis-backed Bucket4j
            // Fallback to local if Redis unavailable
        }
        // In-memory fallback
        Bucket bucket = localBuckets.computeIfAbsent(key, k -> Bucket4j.builder()
                .addLimit(Bandwidth.classic(5, Refill.greedy(5, Duration.ofMinutes(15))))
                .build());
        return bucket.tryConsume(1);
    }
}
