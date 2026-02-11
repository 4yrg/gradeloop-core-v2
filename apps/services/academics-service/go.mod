module github.com/4yrg/gradeloop-core-v2/apps/services/academics-service

go 1.25

require (
	github.com/4yrg/gradeloop-core-v2/shared/libs/go/logger v0.0.0
	github.com/4yrg/gradeloop-core-v2/shared/libs/go/middleware v0.0.0
	github.com/4yrg/gradeloop-core-v2/shared/libs/go/secrets v0.0.0
	github.com/4yrg/gradeloop-core-v2/shared/libs/go/tracing v0.0.0
	github.com/gofiber/fiber/v3 v3.0.0
	github.com/google/uuid v1.6.0
	github.com/redis/go-redis/v9 v9.17.3
	github.com/stretchr/testify v1.11.1
	github.com/uptrace/opentelemetry-go-extra/otelgorm v0.3.2
	gorm.io/driver/postgres v1.6.0
	gorm.io/gorm v1.31.1
)

replace github.com/4yrg/gradeloop-core-v2/shared/libs/go/logger => ../../../shared/libs/go/logger
replace github.com/4yrg/gradeloop-core-v2/shared/libs/go/middleware => ../../../shared/libs/go/middleware
replace github.com/4yrg/gradeloop-core-v2/shared/libs/go/secrets => ../../../shared/libs/go/secrets
replace github.com/4yrg/gradeloop-core-v2/shared/libs/go/tracing => ../../../shared/libs/go/tracing
