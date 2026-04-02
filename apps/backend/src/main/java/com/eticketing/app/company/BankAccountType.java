package com.eticketing.app.company;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Embedded bank account information for Company payouts.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BankAccountType {

    private String iban;
    private String bankName;
    private String accountHolder;
}
