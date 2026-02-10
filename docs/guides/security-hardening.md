# Security Hardening Guide

This document describes the security measures implemented in the GradeLoop IAM service to protect against common attacks and ensure system integrity.

## Brute-Force Protection

### Overview

The IAM service implements comprehensive brute-force protection for authentication endpoints using Redis-based rate limiting. This prevents attackers from attempting to guess user credentials through repeated login attempts.

### Configuration

**Thresholds:**
- **Max Attempts:** 5 failed login attempts
- **Lockout Window:** 15 minutes
- **Tracking Granularity:** Per IP address + username combination

**Performance:**
- Redis operations complete in < 5ms (monitored and logged if exceeded)
- Automatic fail-safe mode if Redis is unavailable

### How It Works

1. **Tracking Failed Attempts:**
   - Each failed login attempt is recorded in Redis with key format: `auth_fail:{ip}:{username}`
   - Counter increments on each failed attempt (401 Unauthorized response)
   - Counter expires automatically after 15 minutes

2. **Account Lockout:**
   - After 5 failed attempts, subsequent requests return `429 Too Many Requests`
   - Lockout is temporary and expires automatically after 15 minutes
   - No manual intervention required

3. **Counter Reset:**
   - Successful login (200 OK response) immediately resets the failure counter
   - User can attempt login again without waiting for expiration

4. **Anti-Enumeration Protection:**
   - Standardized error message: "Account temporarily locked"
   - Same response whether user exists or not
   - Prevents attackers from discovering valid usernames

### Audit Logging

All authentication events are logged to the `audit_logs` table:

- **Failed Attempts:** `auth.login.failed`
  - Includes IP address, user agent, attempt count
  
- **Account Lockouts:** `auth.login.locked`
  - Includes IP address, user agent, total attempts
  
- **Successful Logins:** `auth.login.success`
  - Includes IP address, user agent, counter reset confirmation
  
- **Redis Failures:** `auth.redis.failure`
  - High-priority warning when Redis is unavailable
  - Indicates degraded mode operation

### Fail-Safe Mode

If Redis becomes unavailable:
- Authentication proceeds normally (degraded mode)
- High-priority warning logged to audit system
- No rate limiting enforced during outage
- System remains operational

**Monitoring:** Check for `auth.redis.failure` audit logs to detect Redis outages.

### Protected Endpoints

- `POST /api/v1/auth/login` - User login

### Testing Lockout Behavior

**Manual Test:**
```bash
# Make 5 failed login attempts
for i in {1..5}; do
  curl -X POST http://localhost/api/iam/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
  echo ""
done

# 6th attempt should return 429
curl -X POST http://localhost/api/iam/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}'
```

**Verify Redis State:**
```bash
# Check Redis keys
docker exec gradeloop-redis-dev redis-cli KEYS "auth_fail:*"

# Check attempt count
docker exec gradeloop-redis-dev redis-cli GET "auth_fail:<ip>:<email>"

# Check TTL (should be ~900 seconds)
docker exec gradeloop-redis-dev redis-cli TTL "auth_fail:<ip>:<email>"
```

**Query Audit Logs:**
```sql
SELECT 
  action,
  entity_id,
  ip_address,
  user_agent,
  new_value,
  created_at
FROM audit_logs
WHERE action IN ('auth.login.failed', 'auth.login.locked', 'auth.login.success')
ORDER BY created_at DESC
LIMIT 20;
```

## Redis Configuration

### Development Environment

Redis is configured in `infra/compose/compose.dev.yaml`:

```yaml
redis:
  image: redis:7-alpine
  container_name: gradeloop-redis-dev
  ports:
    - "6379:6379"
  command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 2s
    timeout: 5s
    retries: 15
  networks:
    - gradeloop-network
```

**Configuration Details:**
- **Max Memory:** 256MB (sufficient for rate limiting data)
- **Eviction Policy:** `allkeys-lru` (least recently used keys evicted first)
- **Health Check:** Ensures Redis is ready before IAM service starts

### Connection

The IAM service connects to Redis using the `REDIS_ADDR` environment variable:

- **Development:** `redis:6379` (Docker internal network)
- **Testing:** `localhost:6379` (configurable via `REDIS_ADDR` env var)

### High Availability Considerations

For production deployments:

1. **Redis Sentinel:** Use Redis Sentinel for automatic failover
2. **Redis Cluster:** For horizontal scaling and data sharding
3. **Persistence:** Enable RDB or AOF persistence for data durability
4. **Monitoring:** Monitor Redis memory usage, connection count, and latency

## Performance Monitoring

### Metrics

The brute-force protection middleware tracks:

1. **Redis Operation Latency:**
   - Logged as warning if > 5ms
   - Includes operation type (GET, INCR, DEL, EXPIRE)
   
2. **Redis Availability:**
   - Logged as error when Redis is unreachable
   - Triggers degraded mode operation

### Prometheus Metrics

Monitor via Prometheus at `http://localhost:9090`:

```promql
# Redis operation duration (p95)
histogram_quantile(0.95, 
  rate(iam_service_redis_operation_duration_seconds_bucket[5m])
)

# Redis error rate
rate(iam_service_redis_errors_total[5m])
```

### Alerts

Recommended alerts:

```yaml
# High Redis latency
- alert: RedisHighLatency
  expr: histogram_quantile(0.95, rate(iam_service_redis_operation_duration_seconds_bucket[5m])) > 0.005
  for: 5m
  annotations:
    summary: "Redis operations exceeding 5ms threshold"

# Redis unavailable
- alert: RedisUnavailable
  expr: rate(iam_service_redis_errors_total[1m]) > 0
  for: 1m
  annotations:
    summary: "Redis connection failures detected"
```

## Security Best Practices

### Rate Limiting Strategy

1. **Granular Tracking:** IP + username prevents collateral lockouts
   - Users on shared networks (campus WiFi, VPN) are isolated
   - Each user's attempts tracked independently
   
2. **Automatic Expiration:** No manual unlock required
   - Reduces operational burden
   - Prevents permanent lockouts from forgotten passwords
   
3. **Immediate Reset:** Successful login clears counter
   - Legitimate users not penalized for typos
   - Reduces support tickets

### Additional Recommendations

1. **CAPTCHA Integration:** Add CAPTCHA after 3 failed attempts
2. **Email Notifications:** Notify users of suspicious login attempts
3. **IP Allowlisting:** Allow trusted IPs to bypass rate limiting
4. **Adaptive Thresholds:** Increase lockout duration for repeated violations

## Troubleshooting

### User Locked Out

**Symptom:** User receives "Account temporarily locked" message

**Resolution:**
1. Wait 15 minutes for automatic expiration
2. Or manually clear Redis key:
   ```bash
   docker exec gradeloop-redis-dev redis-cli DEL "auth_fail:<ip>:<email>"
   ```

### Redis Connection Failures

**Symptom:** Logs show "Redis unavailable - operating in degraded mode"

**Resolution:**
1. Check Redis container status:
   ```bash
   docker ps | grep redis
   docker logs gradeloop-redis-dev
   ```
2. Restart Redis if needed:
   ```bash
   docker restart gradeloop-redis-dev
   ```
3. Verify network connectivity:
   ```bash
   docker exec gradeloop-iam-service-dev ping redis
   ```

### High Redis Latency

**Symptom:** Warnings about Redis operations exceeding 5ms

**Possible Causes:**
- Redis memory full (check `maxmemory` setting)
- High connection count
- Network latency
- Slow disk I/O (if persistence enabled)

**Resolution:**
1. Check Redis memory usage:
   ```bash
   docker exec gradeloop-redis-dev redis-cli INFO memory
   ```
2. Monitor slow queries:
   ```bash
   docker exec gradeloop-redis-dev redis-cli SLOWLOG GET 10
   ```
3. Increase memory limit if needed (edit `compose.dev.yaml`)

## Related Documentation

- [Audit Logging](./observability.md#audit-logging)
- [Local Development Guide](./local-dev-guide.md)
- [Secrets Management](./secrets-management.md)
