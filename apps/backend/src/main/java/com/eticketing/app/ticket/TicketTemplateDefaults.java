package com.eticketing.app.ticket;

public final class TicketTemplateDefaults {

    private static final String DEFAULT_EMAIL_TEMPLATE = """
                <!DOCTYPE html>
                <html lang="{{htmlLang}}" dir="{{direction}}" xmlns="http://www.w3.org/1999/xhtml">
                <head>
                <meta charset="utf-8">
                <meta name="x-apple-disable-message-reformatting">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>{{eyebrowText}}</title>
                <style>
                    body{margin:0!important;padding:0!important;background:#eef2f6!important;direction:{{direction}};text-align:{{textAlign}};}
                    table{border-collapse:collapse!important;mso-table-lspace:0pt!important;mso-table-rspace:0pt!important;}
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
                    .reference-value{font-size:13px;letter-spacing:.08em;font-weight:700;color:#0f172a;}
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
                                                        <div class="reference-value" style="margin-top:4px;word-break:break-word;">{{reference}}</div>
                                                        <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>
                                                        <div class="label">{{companyLabel}}</div>
                                                        <div class="info-copy" style="margin-top:4px;">{{companyName}}</div>
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
                                <td class="section qr-section" style="padding-top:0;page-break-inside:avoid;break-inside:avoid;{{qrSectionStyle}}">
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card qr-card" style="page-break-inside:avoid;break-inside:avoid;">
                                        <tr>
                                            <td class="card-pad" align="center">
                                                <div class="qr-box" style="page-break-inside:avoid;break-inside:avoid;">
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
                                        {{platformAttributionHtml}}
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </center>
                </body>
                </html>
                """;

    private static final String DEFAULT_PRINT_TEMPLATE = """
                <!DOCTYPE html>
                <html lang="{{htmlLang}}" dir="{{direction}}" xmlns="http://www.w3.org/1999/xhtml">
                <head>
                <meta charset="utf-8">
                <meta name="x-apple-disable-message-reformatting">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>{{eyebrowText}}</title>
                <style>
                    :root{color-scheme:light only;}
                    *{box-sizing:border-box;}
                    body{margin:0!important;padding:0!important;background:radial-gradient(circle at top,#f7fafc 0%,#edf3f8 42%,#e4ecf4 100%)!important;color:#0f172a;direction:{{direction}};text-align:{{textAlign}};font-family:Segoe UI,Arial,Helvetica,sans-serif;}
                    img{border:0;outline:none;text-decoration:none;display:block;}
                    .document-shell{max-width:none;margin:0 auto;padding:22px 0 32px;direction:{{direction}};text-align:{{textAlign}};}
                    .pdf-page{width:210mm;min-height:297mm;margin:0 auto 18px;padding:10mm;background:#ffffff;display:flex;page-break-after:always;break-after:page;}
                    .pdf-page:last-child{page-break-after:auto;break-after:auto;}
                    .ticket-sheet{position:relative;overflow:hidden;width:100%;min-height:100%;margin:0;background:#ffffff;border:1px solid #d9e3ee;border-radius:30px;padding:24px;box-shadow:0 26px 70px rgba(15,23,42,.10);page-break-inside:avoid;break-inside:avoid;display:flex;flex-direction:column;}
                    .ticket-sheet::before{content:"";position:absolute;inset:0 0 auto 0;height:6px;background:linear-gradient(90deg,#0f172a 0%,#1e3a5f 56%,#0f766e 100%);}
                    .ticket-hero{padding:24px;border-radius:24px;background:linear-gradient(135deg,#0f172a 0%,#162338 58%,#1f4f7b 100%);color:#ffffff;}
                    .brand-lockup{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;}
                    .brand-unit{display:flex;gap:16px;align-items:center;min-width:0;flex:1 1 auto;}
                    .brand-mark{width:78px;height:78px;border-radius:22px;overflow:hidden;flex:0 0 auto;background:rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;}
                    .brand-logo{width:100%;height:100%;object-fit:contain;background:#ffffff;padding:10px;}
                    .ticket-eyebrow{margin:0 0 8px 0;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#d9e7f8;}
                    .ticket-brand{margin:0;font-size:28px;line-height:1.08;font-weight:700;color:#ffffff;}
                    .ticket-company-copy{margin:6px 0 0 0;font-size:14px;line-height:1.45;color:#d5e1ef;}
                    .hero-tag{align-self:flex-start;padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.12);color:#f8fafc;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;}
                    .route-row{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;margin-top:24px;}
                    .route-title{margin:0;font-size:36px;line-height:1.02;font-weight:700;color:#ffffff;}
                    .route-copy{margin:10px 0 0 0;font-size:15px;line-height:1.5;color:#d8e4f3;}
                    .status-chip{display:inline-flex;align-items:center;justify-content:center;padding:8px 12px;border-radius:999px;background:#ffffff;color:#0f172a;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;}
                    .ticket-layout{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(240px,.82fr);gap:20px;margin-top:20px;flex:1 1 auto;}
                    .ticket-main{display:grid;gap:16px;min-width:0;}
                    .info-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;}
                    .info-card{background:linear-gradient(180deg,#f8fbfe 0%,#f2f6fb 100%);border:1px solid #dde6f0;border-radius:22px;padding:18px;min-width:0;}
                    .info-card-wide{grid-column:1 / -1;}
                    .info-label{margin:0;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#6b7a90;}
                    .info-value{margin:8px 0 0 0;font-size:20px;line-height:1.25;font-weight:800;color:#0f172a;word-break:break-word;}
                    .info-copy{margin:8px 0 0 0;font-size:14px;line-height:1.55;color:#415266;word-break:break-word;}
                    .detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;}
                    .detail-list{display:grid;gap:14px;}
                    .journey-stop{padding-top:14px;border-top:1px solid #e1e8f0;}
                    .journey-stop:first-child{padding-top:0;border-top:0;}
                    .qr-panel{display:flex;flex-direction:column;justify-content:space-between;gap:16px;padding:20px;border-radius:24px;background:#0f172a;color:#ffffff;min-width:0;}
                    .qr-badge{margin:0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#bad0ea;}
                    .qr-reference{margin:8px 0 0 0;font-size:18px;line-height:1.3;font-weight:800;color:#ffffff;word-break:break-word;}
                    .qr-frame{display:flex;align-items:center;justify-content:center;padding:18px;border-radius:22px;background:#ffffff;}
                    .qr-frame img{width:190px;height:190px;max-width:100%;object-fit:contain;}
                    .qr-hint{margin:0;font-size:13px;line-height:1.55;color:#d8e4f3;}
                    .ticket-footer{margin-top:18px;font-size:12px;line-height:1.6;color:#5c6b7e;}
                    @media screen and (max-width:780px){
                        .document-shell{padding:14px 10px 28px;}
                        .pdf-page{width:auto;min-height:auto;padding:0;margin:0 auto 16px;}
                        .ticket-sheet{padding:16px;border-radius:24px;}
                        .ticket-hero{padding:18px;border-radius:20px;}
                        .brand-lockup,.route-row,.ticket-layout,.detail-grid{display:block;}
                        .brand-unit{margin-bottom:14px;}
                        .hero-tag,.status-chip{display:inline-flex;margin-top:12px;}
                        .route-title{font-size:28px;}
                        .ticket-layout,.detail-grid{gap:14px;}
                        .info-grid{grid-template-columns:1fr;}
                        .qr-panel{margin-top:16px;}
                    }
                    @media print{
                        body{background:#ffffff!important;}
                        .document-shell{padding:0!important;}
                        .pdf-page{width:auto!important;min-height:auto!important;margin:0!important;padding:0!important;page-break-after:always;break-after:page;}
                        .pdf-page:last-child{page-break-after:auto;break-after:auto;}
                        .ticket-sheet{box-shadow:none!important;border-color:#dbe3ec!important;min-height:277mm;}
                    }
                </style>
                </head>
                <body>
                    <main class="document-shell">{{pagesHtml}}</main>
                </body>
                </html>
                """;

    private TicketTemplateDefaults() {
    }

    public static String defaultTemplate() {
        return DEFAULT_EMAIL_TEMPLATE;
    }

    public static String defaultEmailTemplate() {
        return DEFAULT_EMAIL_TEMPLATE;
    }

    public static String defaultPrintTemplate() {
        return DEFAULT_PRINT_TEMPLATE;
    }
}
