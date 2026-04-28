package handler

import (
	"bufio"
	"fmt"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/sse"
	"github.com/gofiber/fiber/v3"
	"go.uber.org/zap"
)

type SSEHandler struct {
	hub    *sse.Hub
	logger *zap.Logger
}

func NewSSEHandler(hub *sse.Hub, logger *zap.Logger) *SSEHandler {
	return &SSEHandler{hub: hub, logger: logger}
}

func (h *SSEHandler) Stream(c fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return fiber.NewError(fiber.StatusUnauthorized, "user not authenticated")
	}

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")

	client := &sse.Client{
		UserID: userID,
		Send:   make(chan []byte, 256),
	}

	h.hub.Register(client)
	defer h.hub.Unregister(client)

	return c.SendStreamWriter(func(w *bufio.Writer) {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		connected := sse.FormatSSE("connected", "", []byte(`{"status":"connected"}`))
		if _, err := w.Write(connected); err != nil {
			return
		}
		if err := w.Flush(); err != nil {
			return
		}

		for {
			select {
			case msg, ok := <-client.Send:
				if !ok {
					return
				}
				if _, err := w.Write(msg); err != nil {
					h.logger.Debug("sse: write error, closing stream",
						zap.String("user_id", userID),
						zap.Error(err),
					)
					return
				}
				if err := w.Flush(); err != nil {
					return
				}
			case <-ticker.C:
				heartbeat := sse.FormatSSE("heartbeat", "", fmt.Appendf(nil, `{"ts":%d}`, time.Now().Unix()))
				if _, err := w.Write(heartbeat); err != nil {
					return
				}
				if err := w.Flush(); err != nil {
					return
				}
			}
		}
	})
}