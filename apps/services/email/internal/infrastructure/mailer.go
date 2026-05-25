package infrastructure

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"strconv"
	"strings"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/email/internal/config"
)

type Mailer struct {
	cfg  *config.Config
	auth smtp.Auth
}

func NewMailer(cfg *config.Config) *Mailer {
	auth := smtp.PlainAuth("", cfg.SMTP.Username, cfg.SMTP.Password, cfg.SMTP.Host)
	if cfg.SMTP.Username == "" {
		auth = nil
	}

	return &Mailer{
		cfg:  cfg,
		auth: auth,
	}
}

// Send delivers one HTML email. Uses implicit TLS on port 465 and STARTTLS on
// submission port 587 (required for Gmail and most providers). Port 1025 and
// similar dev ports stay plain SMTP.
func (m *Mailer) Send(to []string, subject, bodyHTML, bodyText string) error {
	from := m.cfg.SMTP.EmailFrom
	if from == "" {
		from = "no-reply@gradeloop.com"
	}

	msg := fmt.Sprintf("From: GradeLoop <%s>\r\n"+
		"To: %s\r\n"+
		"Subject: %s\r\n"+
		"MIME-Version: 1.0\r\n"+
		"Content-Type: text/html; charset=\"UTF-8\"\r\n"+
		"\r\n"+
		"%s", from, strings.Join(to, ","), subject, bodyHTML)

	host := m.cfg.SMTP.Host
	port := m.cfg.SMTP.Port
	addr := net.JoinHostPort(host, strconv.Itoa(port))

	dialer := &net.Dialer{Timeout: 20 * time.Second}
	tlsCfg := &tls.Config{
		ServerName: host,
		MinVersion: tls.VersionTLS12,
	}

	var conn net.Conn
	var err error

	switch port {
	case 465:
		conn, err = tls.DialWithDialer(dialer, "tcp", addr, tlsCfg)
		if err != nil {
			return fmt.Errorf("smtp tls dial: %w", err)
		}
	default:
		conn, err = dialer.Dial("tcp", addr)
		if err != nil {
			return fmt.Errorf("smtp dial: %w", err)
		}
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	defer func() { _ = client.Close() }()

	if port != 465 {
		if ok, _ := client.Extension("STARTTLS"); ok {
			if err = client.StartTLS(tlsCfg); err != nil {
				return fmt.Errorf("smtp starttls: %w", err)
			}
		}
	}

	if m.auth != nil {
		if err = client.Auth(m.auth); err != nil {
			return fmt.Errorf("smtp auth: %w", err)
		}
	}

	if err = client.Mail(from); err != nil {
		return fmt.Errorf("smtp mail from: %w", err)
	}
	for _, rcpt := range to {
		if err = client.Rcpt(rcpt); err != nil {
			return fmt.Errorf("smtp rcpt %q: %w", rcpt, err)
		}
	}
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp data: %w", err)
	}
	if _, err = w.Write([]byte(msg)); err != nil {
		return fmt.Errorf("smtp write body: %w", err)
	}
	if err = w.Close(); err != nil {
		return fmt.Errorf("smtp finish body: %w", err)
	}
	if err = client.Quit(); err != nil {
		return fmt.Errorf("smtp quit: %w", err)
	}
	return nil
}
