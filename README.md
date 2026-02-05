# GradeLoop V2 

## Folder Structure of the GradeLoop V2
```
grade-loop-v2/
├── apps/                     # All runnable applications (frontend + services)
│   ├── web/                  # SvelteKit frontend
│   ├── gateway/              # API Gateway (Go or Envoy-based proxy + authz middleware)
│   └── services/             # Microservices (each in its own dir)
│       ├── iam-service/
│       ├── academics-service/
│       ├── assignment-service/
│       ├── cipas-service/
│       ├── acafs-service/
│       ├── ivas-service/
│       ├── blaim-service/
│       └── email-notify-service/
├── shared/                   # Shared cross-cutting concerns
│   ├── protos/               # .proto files for gRPC contracts
│   ├── libs/                 # Reusable internal libraries
│   │   ├── go/               # Go modules (authz helpers, tracing, etc.)
│   │   └── py/               # Python packages (utils, DTOs, exceptions)
│   └── contracts/            # Auth, event, and domain contracts (e.g., JWT claims schema)
├── infra/                    # Infrastructure-as-Code & local dev setup
│   ├── docker/               # Dockerfiles per service
│   ├── compose/              # Docker Compose for local POC
│   ├── k8s/                  # (Future) Kubernetes manifests
│   └── env/                  # Environment templates (.env.example, local/dev/prod)
├── scripts/                  # Dev & CI scripts (migrate, test, build, seed)
├── ops/                      # Observability, logging, alerting configs (Prometheus, Grafana, Loki)
└── docs/                     # ADRs, sequence diagrams, deployment guides`
```
