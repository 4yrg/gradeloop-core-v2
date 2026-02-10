package tracing

import (
	"context"
	"log"
	"os"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"google.golang.org/grpc"
)

// InitTracer initializes the OpenTelemetry tracer provider and sets it as the global tracer.
func InitTracer(serviceName string) (*sdktrace.TracerProvider, error) {
	// Get Jaeger endpoint from environment variable, with a default
	jaegerEndpoint := os.Getenv("JAEGER_ENDPOINT")
	if jaegerEndpoint == "" {
		jaegerEndpoint = "jaeger:14268" // Default for Docker Compose
	}

	// Create a gRPC connection to the Jaeger collector
	// We remove WithBlock() to prevent stalling the entire service startup if Jaeger is not ready
	conn, err := grpc.DialContext(context.Background(), jaegerEndpoint, grpc.WithInsecure())
	if err != nil {
		return nil, err
	}

	// Create a new OTLP trace exporter
	exporter, err := otlptracegrpc.New(context.Background(), otlptracegrpc.WithGRPCConn(conn))
	if err != nil {
		return nil, err
	}

	// Create a new resource with service name attribute
	res, err := resource.New(
		context.Background(),
		resource.WithAttributes(semconv.ServiceNameKey.String(serviceName)),
	)
	if err != nil {
		return nil, err
	}

	// Create a new tracer provider with a batch span processor and the OTLP exporter.
	// We use AlwaysSample sampler for this POC.
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
	)

	// Set the global tracer provider
	otel.SetTracerProvider(tp)

	// Set the W3C Trace Context propagator as the global propagator
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(propagation.TraceContext{}, propagation.Baggage{}))

	log.Printf("Tracer initialized for service: %s, exporting to: %s", serviceName, jaegerEndpoint)

	return tp, nil
}
