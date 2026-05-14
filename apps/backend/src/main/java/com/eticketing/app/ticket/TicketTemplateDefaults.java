package com.eticketing.app.ticket;

public final class TicketTemplateDefaults {

    private static final String DEFAULT_TEMPLATE = """
                <!DOCTYPE html>
                <html lang="{{htmlLang}}" dir="{{direction}}" xmlns="http://www.w3.org/1999/xhtml">
                <head>
                <meta charset="utf-8">
                <meta name="x-apple-disable-message-reformatting">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>{{eyebrowText}}</title>
                <style>
                    body{margin:0!important;padding:0!important;background:#eef2f6!important;direction:{{direction}};text-align:{{textAlign}};}
                    table{border-collapse:collapse!important;}
                    img{border:0;outline:none;text-decoration:none;display:block;}
                    a{color:inherit;text-decoration:none;}
                    .wrapper{width:100%;background:#eef2f6;padding:24px 12px;direction:{{direction}};text-align:{{textAlign}};}
                    .container{max-width:680px;width:100%;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;}
                    .section{padding:0 28px 28px 28px;color:#1f2937;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;text-align:{{textAlign}};direction:{{direction}};}
                    .hero{padding:28px 28px 20px 28px;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#ffffff;text-align:{{textAlign}};direction:{{direction}};}
                    .eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#cbd5e1;margin:0 0 8px 0;}
                    .title{font-size:28px;line-height:1.2;font-weight:700;margin:0 0 10px 0;color:#ffffff;}
                    .subtitle{font-size:15px;line-height:1.55;color:#e2e8f0;margin:0;}
                    .brand{font-size:20px;line-height:1.2;font-weight:700;color:#ffffff;margin:0;}
                    .brand-subtitle{font-size:13px;line-height:1.45;color:#cbd5e1;margin:6px 0 0 0;}
                    .logo{width:72px;height:72px;max-width:72px;border-radius:16px;background:#ffffff;padding:8px;box-sizing:border-box;}
                    .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;}
                    .card-pad{padding:18px 20px;text-align:{{textAlign}};direction:{{direction}};}
                    .label{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;}
                    .value{font-size:16px;font-weight:700;color:#0f172a;}
                    .muted{color:#64748b;font-size:13px;}
                    .info-title{font-size:13px;font-weight:700;color:#0f172a;margin:0 0 4px 0;}
                    .info-copy{font-size:14px;color:#475569;margin:0;}
                    .divider{height:1px;line-height:1px;font-size:1px;background:#e2e8f0;}
                    .pill{display:inline-block;padding:6px 10px;border-radius:999px;background:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;}
                    .qr-box{padding:20px;border:1px solid #e2e8f0;border-radius:16px;background:#ffffff;text-align:center;}
                    .footer{font-size:13px;color:#64748b;}
                    @media screen and (max-width:640px){
                        .wrapper{padding:12px 0;}
                        .section{padding:0 18px 22px 18px!important;}
                        .hero{padding:20px 18px 18px 18px!important;}
                        .stack, .stack tbody, .stack tr, .stack td{display:block!important;width:100%!important;}
                        .stack td{padding-right:0!important;padding-left:0!important;}
                        .stack-gap{height:12px!important;line-height:12px!important;font-size:12px!important;}
                    }
                </style>
                </head>
                <body style="margin:0;padding:0;background:#eef2f6;direction:{{direction}};text-align:{{textAlign}};">
                    <center class="wrapper">
                        <table role="presentation" class="container" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                                <td class="hero">
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="{{direction}}">
                                        <tr>
                                            <td valign="top" style="{{heroLogoCellStyle}}">
                                                <img src="{{companyLogoUrl}}" alt="{{companyName}}" class="logo" style="{{companyLogoStyle}}">
                                            </td>
                                            <td valign="middle">
                                                <div class="eyebrow">{{eyebrowText}}</div>
                                                <p class="brand">{{companyName}}</p>
                                                <p class="brand-subtitle">{{companySubtitle}}</p>
                                            </td>
                                        </tr>
                                    </table>
                                    <div style="height:24px;line-height:24px;font-size:24px;">&nbsp;</div>
                                    <h1 class="title">{{tripRoute}}</h1>
                                    <p class="subtitle">{{heroSubtitle}}</p>
                                </td>
                            </tr>

                            <tr>
                                <td class="section" style="padding-top:24px;">
                                    <p style="margin:0 0 16px 0;">{{greetingText}} <strong>{{passengerName}}</strong>,</p>
                                    <div style="margin:0;">{{introText}}</div>
                                </td>
                            </tr>

                            <tr>
                                <td class="section" style="padding-top:0;">
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="stack">
                                        <tr>
                                            <td valign="top" style="width:50%;padding-right:8px;">
                                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card">
                                                    <tr><td class="card-pad">
                                                        <div class="label">{{referenceLabel}}</div>
                                                        <div class="value" style="margin-top:4px;word-break:break-word;">{{reference}}</div>
                                                        <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>
                                                        <div class="label">{{companyLabel}}</div>
                                                        <div class="info-copy" style="margin-top:4px;">{{companyName}}</div>
                                                        <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>
                                                        <div class="label">{{salesChannelLabel}}</div>
                                                        <div class="info-copy" style="margin-top:4px;">{{salesChannel}}</div>
                                                    </td></tr>
                                                </table>
                                            </td>
                                            <td class="stack-gap" style="width:16px;">&nbsp;</td>
                                            <td valign="top" style="width:50%;padding-left:8px;">
                                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card">
                                                    <tr><td class="card-pad">
                                                        <div class="label">{{amountLabel}}</div>
                                                        <div class="value" style="margin-top:4px;">{{totalAmount}} {{currency}}</div>
                                                        <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>
                                                        <div class="label">{{segmentsCoveredLabel}}</div>
                                                        <div class="info-copy" style="margin-top:4px;">{{segmentLabel}}</div>
                                                        <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>
                                                        <div class="label">{{statusLabel}}</div>
                                                        <div style="margin-top:6px;"><span class="pill">{{status}}</span></div>
                                                    </td></tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                            <tr>
                                <td class="section" style="padding-top:0;">
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card">
                                        <tr>
                                            <td class="card-pad">
                                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="stack">
                                                    <tr>
                                                        <td valign="top" style="width:50%;padding-right:12px;">
                                                            <p class="info-title">{{passengerLabel}}</p>
                                                            <p class="info-copy">{{passengerName}}</p>
                                                        </td>
                                                        <td class="stack-gap" style="width:12px;">&nbsp;</td>
                                                        <td valign="top" style="width:50%;padding-left:12px;">
                                                            <p class="info-title">{{supportContactLabel}}</p>
                                                            <p class="info-copy">{{supportLine}}</p>
                                                        </td>
                                                    </tr>
                                                    <tr><td colspan="3" style="height:16px;line-height:16px;font-size:16px;">&nbsp;</td></tr>
                                                    <tr><td colspan="3" class="divider">&nbsp;</td></tr>
                                                    <tr><td colspan="3" style="height:16px;line-height:16px;font-size:16px;">&nbsp;</td></tr>
                                                    <tr>
                                                        <td valign="top" style="width:50%;padding-right:12px;">
                                                            <p class="info-title">{{pickupLabel}}</p>
                                                            <p class="info-copy">{{pickupSummary}}</p>
                                                        </td>
                                                        <td class="stack-gap" style="width:12px;">&nbsp;</td>
                                                        <td valign="top" style="width:50%;padding-left:12px;">
                                                            <p class="info-title">{{dropoffLabel}}</p>
                                                            <p class="info-copy">{{dropoffSummary}}</p>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                            <tr>
                                <td class="section" style="padding-top:0;">
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card">
                                        <tr>
                                            <td class="card-pad" align="center">
                                                <div class="qr-box">
                                                    <img src="{{qrCodeUrl}}" alt="{{ticketQrAltText}}" width="220" height="220" style="width:220px;max-width:100%;height:auto;margin:0 auto;">
                                                </div>
                                                <div class="muted" style="margin-top:10px;">{{qrHintText}}</div>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                            <tr>
                                <td class="section" style="padding-top:0;">
                                    <div class="footer">
                                        {{footerText}}
                                    </div>
                                </td>
                            </tr>
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
