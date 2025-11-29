package com.eticketing.app.ticket;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.lang.Nullable;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import jakarta.mail.internet.MimeMessage;

@Service
public class TicketEmailService {

    private static final Logger LOGGER = LoggerFactory.getLogger(TicketEmailService.class);

    private final JavaMailSender mailSender;
    private final String fromAddress;
    private final MailProvider provider;
    private final String resendApiKey;
    private final RestClient resendClient;

    public TicketEmailService(@Nullable JavaMailSender mailSender,
            @Value("${app.mail.from:noreply@eticketing.local}") String fromAddress,
            @Value("${app.mail.provider:auto}") String providerValue,
            @Value("${app.mail.resend.apiKey:}") String resendApiKey,
            @Value("${app.mail.resend.baseUrl:https://api.resend.com}") String resendBaseUrl) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
        this.provider = MailProvider.resolve(providerValue);
        this.resendApiKey = resendApiKey;
        this.resendClient = RestClient.builder().baseUrl(resendBaseUrl).build();
    }

    public boolean sendTicket(TicketDocumentView documentView, String recipientEmail) {
        if (documentView == null || recipientEmail == null || recipientEmail.isBlank()) {
            return false;
        }
        return switch (provider) {
            case SMTP ->
                sendViaSmtp(documentView, recipientEmail);
            case RESEND ->
                sendViaResend(documentView, recipientEmail);
            case AUTO -> {
                boolean smtpSent = sendViaSmtp(documentView, recipientEmail);
                if (smtpSent) {
                    yield true;
                }
                yield sendViaResend(documentView, recipientEmail);
            }
        };
    }

    private boolean sendViaSmtp(TicketDocumentView documentView, String recipientEmail) {
        if (mailSender == null) {
            LOGGER.warn("Mail sender not configured; skipping SMTP ticket email for {}", recipientEmail);
            return false;
        }
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
            helper.setTo(recipientEmail);
            helper.setFrom(fromAddress);
            helper.setSubject(documentView.getSubject() != null ? documentView.getSubject() : "Votre billet");
            helper.setText(documentView.getHtmlContent(), true);
            mailSender.send(message);
            return true;
        } catch (Exception ex) {
            LOGGER.error("Failed to send ticket email via SMTP", ex);
            return false;
        }
    }

    private boolean sendViaResend(TicketDocumentView documentView, String recipientEmail) {
        if (resendApiKey == null || resendApiKey.isBlank()) {
            LOGGER.warn("Resend API key missing; cannot send ticket email for {}", recipientEmail);
            return false;
        }
        try {
            var body = java.util.Map.of(
                    "from", fromAddress,
                    "to", java.util.List.of(recipientEmail),
                    "subject", documentView.getSubject() != null ? documentView.getSubject() : "Votre billet",
                    "html", documentView.getHtmlContent()
            );
            resendClient.post()
                    .uri("/emails")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + resendApiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            return true;
        } catch (Exception ex) {
            LOGGER.error("Failed to send ticket email via Resend", ex);
            return false;
        }
    }

    private enum MailProvider {
        SMTP,
        RESEND,
        AUTO;

        static MailProvider resolve(String value) {
            if (value == null) {
                return AUTO;
            }
            return switch (value.trim().toLowerCase()) {
                case "smtp" ->
                    SMTP;
                case "resend" ->
                    RESEND;
                default ->
                    AUTO;
            };
        }
    }
}
