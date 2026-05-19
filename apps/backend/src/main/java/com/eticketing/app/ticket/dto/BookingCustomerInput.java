package com.eticketing.app.ticket.dto;

import com.eticketing.app.user.PhoneType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import lombok.Data;

@Data
public class BookingCustomerInput {

    private String firstName;

    private String lastName;

    @Email
    private String email;

    @Valid
    private PhoneType phone;
}
