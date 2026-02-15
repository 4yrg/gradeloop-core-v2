package com.gradeloop.iam_service.ratelimit;

import org.springframework.stereotype.Service;

@Service
public class RateLimiterService {
    // Rate limiting disabled for now — service returns allowed for all requests.
    public boolean tryConsume(String key) {
        return true;
    }
}
