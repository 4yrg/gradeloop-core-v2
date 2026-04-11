package grpc

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

type Client struct {
	conn   *grpc.ClientConn
	addr   string
	opts   []grpc.DialOption
}

func NewClient(addr string, opts ...grpc.DialOption) *Client {
	dialOpts := []grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
		grpc.WithTimeout(5 * time.Second),
	}
	dialOpts = append(dialOpts, opts...)
	return &Client{
		addr: addr,
		opts: dialOpts,
	}
}

func (c *Client) Connect() error {
	conn, err := grpc.Dial(c.addr, c.opts...)
	if err != nil {
		return fmt.Errorf("failed to connect to %s: %w", c.addr, err)
	}
	c.conn = conn
	return nil
}

func (c *Client) Conn() *grpc.ClientConn {
	return c.conn
}

func (c *Client) Close() error {
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}

func (c *Client) WithToken(token string) *Client {
	opts := append(c.opts, grpc.WithPerRPCCredentials(&tokenCreds{token: token}))
	return &Client{
		conn: c.conn,
		addr: c.addr,
		opts: opts,
	}
}

type tokenCreds struct {
	token string
}

func (t *tokenCreds) GetRequestMetadata(context.Context, ...string) (map[string]string, error) {
	return map[string]string{
		"authorization": "Bearer " + t.token,
	}, nil
}

func (t *tokenCreds) RequireTransportSecurity() bool {
	return false
}

func NewServerInterceptor(token string) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return nil, fmt.Errorf("missing metadata")
		}
		if len(md["authorization"]) == 0 {
			return nil, fmt.Errorf("missing authorization token")
		}
		return handler(ctx, req)
	}
}

const (
	ServiceIAM         = "iam-service:8081"
	ServiceAcademic   = "academic-service:8083"
	ServiceAssessment = "assessment-service:8084"
	ServiceEmail      = "email-service:8082"
	ServiceKeystroke  = "keystroke-service:8003"
	ServiceIVAS      = "ivas-service:8088"
)