# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for GradeLoop V2. ADRs document significant architectural decisions made during the development of the platform.

## What is an ADR?

An Architecture Decision Record captures a single architectural decision and its rationale. Each ADR describes:

- **Context**: The circumstances that led to the decision
- **Decision**: What was decided
- **Rationale**: Why this decision was made
- **Consequences**: The positive and negative impacts
- **Alternatives**: What other options were considered

## ADR Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](001-monorepo-structure.md) | Monorepo Structure | Accepted | 2024-01-15 |
| [ADR-002](002-grpc-service-communication.md) | gRPC for Service Communication | Proposed | TBD |
| [ADR-003](003-postgresql-database.md) | PostgreSQL for Transactional Data | Proposed | TBD |
| [ADR-004](004-event-driven-architecture.md) | Event-Driven Architecture with NATS | Proposed | TBD |
| [ADR-005](005-sveltekit-frontend.md) | SvelteKit for Frontend Framework | Proposed | TBD |

## ADR Status

- **Proposed**: Under discussion
- **Accepted**: Decision has been made and is being implemented
- **Deprecated**: No longer relevant
- **Superseded**: Replaced by another ADR

## Creating a New ADR

### 1. Use the Template

Copy the template to create a new ADR:

```bash
cp docs/adr/template.md docs/adr/XXX-your-decision-title.md
```

### 2. Naming Convention

- Number ADRs sequentially (001, 002, 003, etc.)
- Use lowercase with hyphens for the title
- Format: `XXX-descriptive-title.md`

### 3. Required Sections

Every ADR must include:

- **Status**: Proposed, Accepted, Deprecated, or Superseded
- **Date**: When the decision was made
- **Context**: Why the decision is needed
- **Decision**: What was decided
- **Rationale**: Why this was chosen
- **Consequences**: Positive and negative impacts
- **Alternatives Considered**: What else was evaluated

### 4. Review Process

1. Create ADR as "Proposed"
2. Submit PR for team review
3. Discuss in architecture review meeting
4. Update status to "Accepted" once approved
5. Update this README index

## Guidelines

### Keep It Concise

ADRs should be brief but complete. Aim for 1-2 pages.

### Focus on "Why"

The most important part is explaining WHY a decision was made, not just WHAT was decided.

### Include Trade-offs

Be honest about downsides and limitations of the chosen approach.

### Link Related ADRs

If a decision builds on or contradicts a previous ADR, reference it explicitly.

### Use Clear Language

Write for engineers who will read this months or years from now. Avoid jargon and acronyms without explanation.

## Example Structure

```markdown
# ADR-XXX: Title

**Status:** Proposed  
**Date:** YYYY-MM-DD  
**Authors:** Team Name  
**Deciders:** Decision Makers  

## Context

What is the issue we're addressing? What are the constraints?

## Decision

What did we decide to do?

## Rationale

Why did we choose this approach?

## Consequences

### Positive
- Benefit 1
- Benefit 2

### Negative
- Drawback 1
- Drawback 2

## Alternatives Considered

### Alternative 1
Why we didn't choose it.

### Alternative 2
Why we didn't choose it.

## References

- Link to related docs
- External articles
- Research papers
```

## Revision History

When updating an ADR:

1. Add entry to the "Revision History" section at the bottom
2. Update the "Last Modified" date in the header
3. If superseding, update status and link to new ADR

## Questions?

For questions about ADRs or the decision-making process, contact:
- **Architecture Team**: `#gradeloop-architecture` on Slack
- **Tech Lead**: See team wiki for current contact

## Further Reading

- [Documenting Architecture Decisions by Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [ADR GitHub Organization](https://adr.github.io/)
- [When Should I Write an ADR?](https://engineering.atspotify.com/2020/04/when-should-i-write-an-architecture-decision-record/)