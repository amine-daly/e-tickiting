package com.eticketing.app.ticket;

import java.util.Locale;

public enum TicketLanguage {
    FR_FR("fr-fr", Locale.forLanguageTag("fr-FR"), "fr", false),
    EN_GB("en-gb", Locale.forLanguageTag("en-GB"), "en", false),
    AR_SA("ar-sa", Locale.forLanguageTag("ar-SA"), "ar", true);

    private final String code;
    private final Locale locale;
    private final String htmlLang;
    private final boolean rtl;

    TicketLanguage(String code, Locale locale, String htmlLang, boolean rtl) {
        this.code = code;
        this.locale = locale;
        this.htmlLang = htmlLang;
        this.rtl = rtl;
    }

    public String getCode() {
        return code;
    }

    public Locale getLocale() {
        return locale;
    }

    public String getHtmlLang() {
        return htmlLang;
    }

    public boolean isRtl() {
        return rtl;
    }

    public String getDirection() {
        return rtl ? "rtl" : "ltr";
    }

    public String getTextAlign() {
        return rtl ? "right" : "left";
    }

    public static TicketLanguage fromCode(String code) {
        if (code == null || code.isBlank()) {
            return FR_FR;
        }

        String normalized = code.trim().toLowerCase(Locale.ROOT);
        for (TicketLanguage language : values()) {
            if (language.code.equals(normalized)) {
                return language;
            }
        }

        return FR_FR;
    }
}