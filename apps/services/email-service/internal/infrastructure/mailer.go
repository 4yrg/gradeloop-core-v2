package infrastructure

import (
	"fmt"
	"net/smtp"
	"strings"

	"github.com/gradeloop/email-service/internal/config"
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

func (m *Mailer) Send(to []string, subject, bodyHTML, bodyText string) error {
	addr := fmt.Sprintf("%s:%d", m.cfg.SMTP.Host, m.cfg.SMTP.Port)

	// Construct simplified MIME message
	// In production, use a library like explicit/go-mail for multipart
	msg := "From: GradeLoop <no-reply@gradeloop.com>\r\n" +
		"To: " + strings.Join(to, ",") + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"MIME-Version: 1.0\r\n" +
		"Content-Type: text/html; charset=\"UTF-8\"\r\n" +
		"\r\n" +
		bodyHTML

	return smtp.SendMail(addr, m.auth, "no-reply@gradeloop.com", to, []byte(msg))
}
