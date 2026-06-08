package com.eticketing.app.ticket.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ScanResponse {

    private boolean success;
    private ScanRejectionReason reason;
    private String passengerName;
    private String seatNumber;

    public static ScanResponse approved(String passengerName, String seatNumber) {
        return ScanResponse.builder()
                .success(true)
                .passengerName(passengerName)
                .seatNumber(seatNumber)
                .build();
    }

    public static ScanResponse rejected(ScanRejectionReason reason, String passengerName, String seatNumber) {
        return ScanResponse.builder()
                .success(false)
                .reason(reason)
                .passengerName(passengerName)
                .seatNumber(seatNumber)
                .build();
    }

    public static ScanResponse rejected(ScanRejectionReason reason) {
        return rejected(reason, null, null);
    }
}
