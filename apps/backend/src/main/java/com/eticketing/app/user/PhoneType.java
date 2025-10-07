package com.eticketing.app.user;

import jakarta.validation.constraints.NotBlank;

public class PhoneType {
    @NotBlank
    private String countryCode; // e.g. +212
    @NotBlank
    private String number;      // e.g. 612345678

    public PhoneType() {}

    public PhoneType(String countryCode, String number) {
        this.countryCode = countryCode;
        this.number = number;
    }

    public String getCountryCode() { return countryCode; }
    public void setCountryCode(String countryCode) { this.countryCode = countryCode; }
    public String getNumber() { return number; }
    public void setNumber(String number) { this.number = number; }
}
