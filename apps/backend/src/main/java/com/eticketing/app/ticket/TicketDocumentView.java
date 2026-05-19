package com.eticketing.app.ticket;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

public class TicketDocumentView {

    private String ticketId;
    private String reference;
    private String htmlContent;
    private String emailHtmlContent;
    private String printHtmlContent;
    private String qrCodeUrl;
    private String qrCodeDataUri;
    private Instant renderedAt;
    private String passengerEmail;
    private String subject;
    private Map<String, Object> metadata = new HashMap<>();

    public String getTicketId() {
        return ticketId;
    }

    public void setTicketId(String ticketId) {
        this.ticketId = ticketId;
    }

    public String getReference() {
        return reference;
    }

    public void setReference(String reference) {
        this.reference = reference;
    }

    public String getBookingReference() {
        return reference;
    }

    public void setBookingReference(String bookingReference) {
        this.reference = bookingReference;
    }

    public String getHtmlContent() {
        return htmlContent;
    }

    public void setHtmlContent(String htmlContent) {
        this.htmlContent = htmlContent;
    }

    public String getEmailHtmlContent() {
        return emailHtmlContent;
    }

    public void setEmailHtmlContent(String emailHtmlContent) {
        this.emailHtmlContent = emailHtmlContent;
    }

    public String getPrintHtmlContent() {
        return printHtmlContent;
    }

    public void setPrintHtmlContent(String printHtmlContent) {
        this.printHtmlContent = printHtmlContent;
    }

    public String getQrCodeUrl() {
        return qrCodeUrl;
    }

    public void setQrCodeUrl(String qrCodeUrl) {
        this.qrCodeUrl = qrCodeUrl;
    }

    public String getQrCodeDataUri() {
        return qrCodeDataUri;
    }

    public void setQrCodeDataUri(String qrCodeDataUri) {
        this.qrCodeDataUri = qrCodeDataUri;
    }

    public Instant getRenderedAt() {
        return renderedAt;
    }

    public void setRenderedAt(Instant renderedAt) {
        this.renderedAt = renderedAt;
    }

    public String getPassengerEmail() {
        return passengerEmail;
    }

    public void setPassengerEmail(String passengerEmail) {
        this.passengerEmail = passengerEmail;
    }

    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }

    public void setMetadata(Map<String, Object> metadata) {
        this.metadata = metadata != null ? metadata : new HashMap<>();
    }
}
