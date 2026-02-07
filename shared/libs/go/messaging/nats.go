package messaging

import (
	"time"

	"github.com/nats-io/nats.go"
)

// NewNATSConnection establishes a connection to the NATS server.
func NewNATSConnection(url string) (*nats.Conn, error) {
	nc, err := nats.Connect(
		url,
		nats.MaxReconnects(-1),
		nats.ReconnectWait(2*time.Second),
	)
	return nc, err
}

// Publisher handles event publishing.
type Publisher struct {
	nc *nats.Conn
}

func NewPublisher(nc *nats.Conn) *Publisher {
	return &Publisher{nc: nc}
}

// Publish sends data to a subject.
func (p *Publisher) Publish(subject string, data []byte) error {
	return p.nc.Publish(subject, data)
}

// Subscriber handles event subscription.
type Subscriber struct {
	nc *nats.Conn
}

func NewSubscriber(nc *nats.Conn) *Subscriber {
	return &Subscriber{nc: nc}
}

// Subscribe subscribes to a subject with a handler.
func (s *Subscriber) Subscribe(subject string, handler func(*nats.Msg)) (*nats.Subscription, error) {
	return s.nc.Subscribe(subject, handler)
}
