# CIPAS Service - Bruno Quick Reference

## Service Overview

**CIPAS** (Code Integrity Analysis and Plagiarism Detection Service) provides multi-language source code clone detection and similarity analysis.

- **Port**: `8085`
- **Base URL**: `http://localhost:8085/api/v1/cipas`
- **Environment Variable**: `{{CIPAS_URL_V1}}`

## Quick Start Workflow

### Step 1: Start Service
```bash
docker-compose up cipas-service
```

### Step 2: Check Health
- Request: `CIPAS Service > Health > Health Check`
- Expected: `{"status": "healthy", "version": "0.2.0"}`

### Step 3: Submit Code (Student A)
- Request: `CIPAS Service > Submissions > Submit Code`
- Set: `SUBMISSION_ID`, `ASSIGNMENT_ID`, `CURRENT_USER_ID`
- Response: `granules_extracted: 5`

### Step 4: Submit Code (Student B)
- Request: `CIPAS Service > Submissions > Submit Code`
- Set: New `SUBMISSION_ID` (save as `SUBMISSION_ID_V2`)
- Response: `granules_extracted: 5`

### Step 5: Run Similarity Analysis
- Request: `CIPAS Service > Similarity Analysis > Run Similarity Analysis`
- Ensure: `SUBMISSION_ID` and `SUBMISSION_ID_V2` set
- Response: `clones_flagged: 3`, `report_id: uuid`

### Step 6: View Evidence
Choose one:
- **Graph**: `Clone Evidence > Get Clone Graph`
- **Classes**: `Clone Evidence > Get Clone Classes`
- **Code Comparison**: `Clone Evidence > Get Clone Evidence`

## Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `CIPAS_BASE_URL` | Service URL | `http://localhost:8085` |
| `CIPAS_URL_V1` | API endpoint | `{{CIPAS_BASE_URL}}/api/v1/cipas` |
| `ASSIGNMENT_ID` | Assignment context | `550e8400-e29b-41d4-a716-446655440000` |
| `SUBMISSION_ID` | First submission | `660e8400-e29b-41d4-a716-446655440001` |
| `SUBMISSION_ID_V2` | Second submission | `770e8400-e29b-41d4-a716-446655440002` |
| `REPORT_ID` | Analysis report | `880e8400-e29b-41d4-a716-446655440003` |

## Endpoint Reference

### Health Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/ready` | GET | Service readiness |
| `/metrics/pool` | GET | Database pool metrics |

### Submission Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/submissions` | POST | Submit code for analysis |
| `/submissions/{id}` | GET | Get submission status |
| `/submissions/{id}/granules` | GET | List extracted granules |

### Similarity Analysis Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/submissions/{id}/similarity-analysis` | POST | Compare two submissions |
| `/similarity-reports/{id}` | GET | Get report by ID |
| `/similarity-reports/{id}/matches` | GET | List clone matches |
| `/submissions/{id}/similarity-reports` | GET | List reports for submission |

### Clone Evidence Endpoints (E15/US10)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/assignments/{id}/clone-graph` | GET | Get Sigma.js graph data |
| `/assignments/{id}/clone-classes` | GET | Get Union-Find clusters |
| `/submissions/{id}/clone-evidence/{matched_id}` | GET | Get code comparison |
| `/assignments/{id}/evidence-report` | GET | Get comprehensive report |

## Configuration Defaults

| Parameter | Default | Description |
|-----------|---------|-------------|
| `syntactic_clone_threshold` | 0.85 | LCS similarity threshold |
| `jaccard_prefilter_threshold` | 0.30 | MinHash Jaccard threshold |
| `minhash_num_permutations` | 128 | MinHash signature size |
| `lsh_num_bands` | 32 | LSH band count |
| `shingle_size` | 5 | Shingle n-gram size |

## Threshold Tuning

### Strict Detection (Few False Positives)
```json
{
  "syntactic_clone_threshold": 0.95,
  "jaccard_prefilter_threshold": 0.5
}
```

### Lenient Detection (Catch More Clones)
```json
{
  "syntactic_clone_threshold": 0.70,
  "jaccard_prefilter_threshold": 0.1
}
```

### Debug Mode (Flag Everything)
```json
{
  "syntactic_clone_threshold": 0.0,
  "jaccard_prefilter_threshold": 0.0
}
```

## Response Examples

### Submit Code Response
```json
{
  "submission_id": "uuid",
  "assignment_id": "uuid",
  "status": "COMPLETED",
  "granules_extracted": 5,
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Similarity Analysis Response
```json
{
  "report_id": "uuid",
  "clones_flagged": 3,
  "metrics": {
    "total_granule_pairs": 25,
    "pre_filter_candidates": 5,
    "lcs_comparisons_run": 5,
    "pre_filter_rejection_rate": 0.80,
    "duration_seconds": 1.5
  }
}
```

### Clone Graph Response
```json
{
  "nodes": [
    {"id": "sub_123", "label": "Student A", "size": 10}
  ],
  "edges": [
    {"from": "sub_123", "to": "sub_456", "value": 0.85}
  ],
  "total_nodes": 2,
  "total_edges": 1
}
```

### Clone Classes Response
```json
{
  "total_classes": 1,
  "total_submissions_involved": 3,
  "classes": [
    {
      "size": 3,
      "avg_similarity": 0.88,
      "pair_count": 2
    }
  ]
}
```

## Common Use Cases

### 1. Detect Exact Clones (Type-1)
```
Endpoint: List Clone Matches
Query: clone_type=type1, min_score=0.99
```

### 2. Detect Renamed Clones (Type-2)
```
Endpoint: List Clone Matches
Query: clone_type=type2, min_score=0.85
```

### 3. Find Collusion Rings
```
Endpoint: Get Clone Classes
Look for: size >= 3
```

### 4. Visualize Clone Network
```
Endpoint: Get Clone Graph
Use with: Sigma.js or Cytoscape.js
```

### 5. Review Evidence
```
Endpoint: Get Clone Evidence
Shows: Side-by-side code comparison
```

## Performance Benchmarks

| Operation | Target | Typical |
|-----------|--------|---------|
| Health check | <100ms | ~20ms |
| Submit code (100 LOC) | <500ms | ~150ms |
| Similarity analysis (10 granules each) | <5s | ~2.5s |
| Get clone graph (100 submissions) | <500ms | ~120ms |
| Get clone classes (100 submissions) | <100ms | ~15ms |
| Get clone evidence | <300ms | ~80ms |

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| 503 Service Unavailable | Service starting | Wait 10s, retry |
| 404 Submission Not Found | Invalid ID | Check UUID format |
| 400 Self Comparison | Same submission ID | Use different IDs |
| 500 Pipeline Error | Internal error | Check service logs |

## Testing Tips

1. **Use Unique IDs**: Generate new UUIDs for each submission
2. **Check Granules**: Verify `granules_extracted > 0` after submit
3. **Monitor Metrics**: High rejection rate (≥0.90) = good pre-filtering
4. **Start Small**: Test with 2-3 granules before large batches
5. **Use Evidence Report**: Single call for all evidence data

## Related Documentation

- [Full README](./README.md)
- [Evidence Interpretation Guide](../docs/cipas-evidence-interpretation.md)
- [API Documentation](../API_DOCUMENTATION.md)
- [Troubleshooting](./TROUBLESHOOTING.md)

---

**Quick Reference Version**: 1.0.0  
**Last Updated**: 2026-02-24
