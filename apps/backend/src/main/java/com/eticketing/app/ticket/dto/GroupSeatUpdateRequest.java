package com.eticketing.app.ticket.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class GroupSeatUpdateRequest {

    @NotEmpty
    @Valid
    private List<SeatAssignment> assignments;

    @Data
    public static class SeatAssignment {

        @NotBlank
        private String ticketId;

        @NotBlank
        private String seatNo;
    }
}
