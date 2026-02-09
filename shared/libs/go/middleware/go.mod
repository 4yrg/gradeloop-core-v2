module github.com/4YRG/gradeloop-core-v2/shared/libs/go/middleware

go 1.25.6

require (
	github.com/4YRG/gradeloop-core-v2/shared/libs/go/logger v0.0.0
	github.com/gofiber/fiber/v3 v3.0.0
	github.com/google/uuid v1.6.0
)

replace github.com/4YRG/gradeloop-core-v2/shared/libs/go/logger => ../logger

require google.golang.org/grpc v1.78.0

require (
	golang.org/x/net v0.47.0 // indirect
	golang.org/x/sys v0.38.0 // indirect
	golang.org/x/text v0.31.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20251029180050-ab9386a59fda // indirect
	google.golang.org/protobuf v1.36.10 // indirect
)
