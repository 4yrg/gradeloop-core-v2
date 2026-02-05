# ADR-001: Monorepo Structure

**Status:** Accepted  
**Date:** 2024-01-15  
**Authors:** GradeLoop Engineering Team  
**Deciders:** Technical Leadership Team  

---

## Context

GradeLoop V2 is a complex educational platform consisting of multiple services across different technology stacks:

- **Frontend**: SvelteKit-based web application
- **Backend Services**: Go-based microservices (academics, assignments, notifications)
- **AI/ML Services**: Python-based services (plagiarism detection, video analysis, fairness analysis)
- **Infrastructure**: API Gateway, observability stack, database migrations

We needed to decide on a repository structure that would support our development workflow while maintaining clear boundaries between services.

### Options Considered

1. **Polyrepo (Multiple Repositories)**
   - Each service in its own repository
   - Independent versioning per service
   - Separate CI/CD pipelines

2. **Monorepo (Single Repository)**
   - All services in one repository
   - Shared tooling and CI/CD
   - Atomic cross-service changes

3. **Hybrid Approach**
   - Core services in monorepo
   - AI/ML services in separate repositories
   - Shared libraries as npm/PyPI packages

---

## Decision

We have decided to adopt a **monorepo structure** for GradeLoop V2.

All application code, services, libraries, infrastructure configuration, and documentation will reside in a single Git repository: `gradeloop-core-v2`.

---

## Rationale

### Advantages of Monorepo

#### 1. **Atomic Changes Across Services**
- A single PR can update multiple services and the frontend simultaneously
- Breaking changes to shared contracts (e.g., gRPC protos) can be fixed atomically
- No need to coordinate releases across multiple repositories

**Example:** Changing a gRPC contract requires updates to:
- Proto definition (`shared/protos/`)
- Client code in Go services
- Client code in Python services
- Frontend API calls

In a monorepo, this is **one PR**. In polyrepo, this requires **4+ PRs** with complex coordination.

#### 2. **Simplified Dependency Management**
- Shared libraries (`shared/libs/go/`, `shared/libs/py/`) are always in sync
- No need to publish internal packages to registries
- Import paths are consistent and predictable

#### 3. **Unified Developer Experience**
- Single `git clone` gets entire codebase
- One Docker Compose file to run full stack locally
- Consistent tooling (linting, testing, formatting) across all services
- New developers onboard faster

#### 4. **Better Code Reuse**
- Easy to extract shared utilities without creating packages
- Discourages code duplication
- Encourages teams to review each other's code

#### 5. **Simplified CI/CD**
- Single source of truth for build configuration
- Shared CI pipelines with service-specific jobs
- Easier to enforce code quality standards uniformly

#### 6. **Version Control Benefits**
- Single version number for entire platform
- Clear history of cross-service changes
- Easier to bisect bugs affecting multiple services

### Challenges & Mitigations

| Challenge | Mitigation |
|-----------|-----------|
| **Large repository size** | Use Git LFS for binaries; keep ML models external |
| **Long CI times** | Implement smart CI that only tests changed services |
| **Merge conflicts** | Clear directory ownership; enforce small PRs |
| **IDE performance** | Provide `.vscode/` workspace configs with exclusions |
| **Build complexity** | Use Docker multi-stage builds; cache dependencies |

---

## Implementation Details

### Directory Structure

```
gradeloop-core-v2/
├── apps/
│   ├── web/                  # SvelteKit frontend
│   ├── gateway/              # API Gateway
│   └── services/             # All microservices
│       ├── academics-service/
│       ├── assignment-service/
│       ├── cipas-service/
│       └── ...
├── shared/
│   ├── protos/               # gRPC contracts
│   ├── libs/                 # Shared libraries
│   └── contracts/            # Domain contracts
├── infra/                    # Infrastructure configs
├── scripts/                  # Automation scripts
├── ops/                      # Observability configs
└── docs/                     # Documentation & ADRs
```

### Naming Conventions

- **Lowercase with hyphens**: `assignment-service` (not `AssignmentService`)
- **Descriptive suffixes**: `-service` for services, `-lib` for libraries
- **No abbreviations** in directory names (except well-known: `api`, `ci`, `db`)

### Service Independence

Despite being in a monorepo, each service maintains:
- **Own database schema** (no shared databases)
- **Independent Dockerfile**
- **Service-specific README**
- **Isolated dependencies** (Go modules, Python requirements)

### CI/CD Strategy

```yaml
# GitHub Actions workflow (example)
on: [pull_request]

jobs:
  detect-changes:
    # Detect which services changed
    
  test-academics:
    needs: detect-changes
    if: needs.detect-changes.outputs.academics == 'true'
    # Run only if academics-service changed
    
  test-frontend:
    needs: detect-changes
    if: needs.detect-changes.outputs.web == 'true'
    # Run only if frontend changed
```

---

## Alternatives Considered

### Polyrepo (Rejected)

**Pros:**
- Clear service boundaries
- Independent deployment schedules
- Smaller repository size per team

**Cons:**
- Complex cross-service changes (multiple PRs)
- Difficult to share code without publishing packages
- Version synchronization nightmares
- Harder to enforce consistent standards
- More CI/CD configuration overhead

**Why Rejected:** The overhead of coordinating changes across repositories outweighs the benefits, especially with frequent schema changes during active development.

### Hybrid Approach (Rejected)

**Pros:**
- Balance between monorepo and polyrepo
- AI/ML teams could have autonomy

**Cons:**
- Worst of both worlds: complexity of polyrepo + overhead of monorepo
- Unclear where to draw the line (which services go where?)
- Still requires cross-repo coordination for proto changes

**Why Rejected:** Adds unnecessary complexity. If we're going to coordinate across repos anyway, better to have everything in one place.

---

## Consequences

### Positive

✅ **Faster development velocity**: No waiting for package releases  
✅ **Better code quality**: Easier to enforce standards uniformly  
✅ **Simplified onboarding**: One repo to learn  
✅ **Atomic refactoring**: Safe to make large-scale changes  
✅ **Single source of truth**: All code, docs, and configs in one place  

### Negative

⚠️ **Requires discipline**: Teams must avoid tight coupling  
⚠️ **Git performance**: May slow down on very large repos (mitigated with shallow clones)  
⚠️ **CI optimization needed**: Must implement smart builds to avoid testing everything  
⚠️ **Access control**: Cannot grant repo access per-service (entire repo or nothing)  

### Neutral

🔄 **Learning curve**: Teams accustomed to polyrepo must adapt  
🔄 **Tooling changes**: Need monorepo-aware tools (Nx, Turborepo, or custom scripts)  

---

## Success Metrics

We will measure the success of this decision by tracking:

1. **Time to onboard new developers** (target: < 2 hours to run full stack locally)
2. **Cross-service change frequency** (expect 20%+ of PRs to touch multiple services)
3. **CI duration** (target: < 10 minutes for average PR)
4. **Merge conflict rate** (target: < 5% of PRs)
5. **Developer satisfaction** (quarterly surveys)

---

## References

- [Google's Monorepo Philosophy](https://research.google/pubs/pub45424/)
- [Why Google Stores Billions of Lines of Code in a Single Repository](https://cacm.acm.org/magazines/2016/7/204032-why-google-stores-billions-of-lines-of-code-in-a-single-repository/fulltext)
- [Monorepo vs Polyrepo](https://earthly.dev/blog/monorepo-vs-polyrepo/)
- [Advantages of Monolithic Version Control](https://danluu.com/monorepo/)

---

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2024-01-15 | 1.0 | Initial decision | Engineering Team |

---

**Next Steps:**

1. ✅ Create monorepo directory structure
2. ✅ Migrate existing services into monorepo
3. 🔲 Implement smart CI to test only changed services
4. 🔲 Document contribution guidelines
5. 🔲 Set up pre-commit hooks for code quality
6. 🔲 Create developer onboarding guide