package com.eticketing.app.company;

import com.eticketing.app.user.PhoneType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Embedded contact information for Company.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContactType {

    private String email;
    private PhoneType phone;
}
