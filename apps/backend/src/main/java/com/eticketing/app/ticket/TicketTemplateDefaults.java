package com.eticketing.app.ticket;

public final class TicketTemplateDefaults {

    private static final String DEFAULT_TEMPLATE = """
                <!DOCTYPE html>
                <html lang=\"fr\" xmlns=\"http://www.w3.org/1999/xhtml\">
                <head>
                <meta charset=\"utf-8\">
                <meta name=\"x-apple-disable-message-reformatting\">
                <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
                <title>Votre billet VIP</title>
                <style>
                    body{margin:0!important;padding:0!important;background:#f3f5f7!important;}
                    table{border-collapse:collapse!important;}
                    img{border:0;outline:none;text-decoration:none;display:block;}
                    a{color:inherit;text-decoration:none;}
                    .wrapper{width:100%;background:#f3f5f7;padding:0 0 24px 0;}
                    .container{max-width:640px;width:100%;margin:0 auto;background:#ffffff;}
                    .spacer-24{height:24px;line-height:24px;font-size:24px;}
                    .spacer-16{height:16px;line-height:16px;font-size:16px;}
                    .content{padding:0 24px 24px 24px;color:#222222;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;}
                    .h1{font-size:24px;line-height:1.25;font-weight:700;margin:0 0 8px 0;color:#111111;}
                    .muted{color:#6b7280;font-size:14px;}
                    .signature{margin-top:16px;}
                    .login-box{
                        background:#f8fafc;
                        border:1px solid #e5e7eb;
                        border-radius:8px;
                        padding:12px 16px;
                        margin:16px 0;
                        font-size:15px;
                        line-height:1.4;
                    }
                    .login-box strong{color:#111;}
                    @media screen and (max-width:640px){
                        .stack{display:block!important;width:100%!important;}
                        .stack td{display:block!important;width:100%!important;}
                        .qr{margin-top:12px!important;}
                    }
                </style>
                </head>
                <body style=\"margin:0;padding:0;background:#f3f5f7;\">
                    <center class=\"wrapper\">
                        <table role=\"presentation\" class=\"container\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">
                            <tr><td class=\"spacer-24\">&nbsp;</td></tr>
                            <tr>
                                <td class=\"content\">
                                    <div class=\"h1\">Votre billet VIP</div>
                                    <p>Bonjour <strong>{{passengerName}}</strong>,</p>
                                    <p>Voici votre billet pour le voyage <strong>{{tripRoute}}</strong> du <strong>{{tripDate}} à {{tripTime}}</strong>.</p>
                                    <div class=\"login-box\">
                                        <div><strong>Référence :</strong> {{reference}}</div>
                                        <div><strong>Agence :</strong> {{agencyName}}</div>
                                        <div><strong>Statut :</strong> {{status}}</div>
                                        <div><strong>Montant :</strong> {{totalAmount}} {{currency}}</div>
                                        <div><strong>Siège(s) réservé(s) :</strong> {{seats}} ({{seatCount}})</div>
                                    </div>
                                    <p>Contact agence : <strong>{{agencyEmail}} · {{agencyPhone}}</strong></p>
                                    <div class=\"signature\">
                                        <strong>Par l'organisation</strong><br>
                                        <span>{{agencyName}}</span>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td class=\"content\" style=\"padding-top:0;\">
                                    <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">
                                        <tr>
                                            <td class=\"stack qr\" align=\"center\" valign=\"top\" style=\"width:33.33%;padding-left:12px;\">
                                                <img src=\"{{qrCodeUrl}}\" alt=\"QR d'accès VIP\" width=\"200\" height=\"200\" style=\"max-width:200px;width:100%;height:auto;border:1px solid #e5e7eb;padding:8px;background:#ffffff;\">
                                                <div class=\"muted\" style=\"margin-top:8px;\">Présentez ce QR à l'entrée</div>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            <tr>
                                <td class=\"content\" style=\"padding-top:0;\">
                                    <div class=\"muted\">
                                        Billet valable pour une seule entrée.<br>
                                        Toute reproduction est interdite.
                                    </div>
                                </td>
                            </tr>
                            <tr><td class=\"spacer-16\">&nbsp;</td></tr>
                        </table>
                    </center>
                </body>
                </html>
                """;

    private TicketTemplateDefaults() {
    }

    public static String defaultTemplate() {
        return DEFAULT_TEMPLATE;
    }
}
