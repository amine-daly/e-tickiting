package com.eticketing.app.ticket.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ScanRequest {

    /** Ticket reference encoded in the QR code (e.g. "2865145EF14E"). */
    @NotBlank
    private String reference;
}
