package com.eticketing.app.ticket;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.eticketing.app.common.PictureType;
import com.eticketing.app.company.CompanyRepository;
import com.eticketing.app.company.CompanyType;
import com.eticketing.app.place.PlaceType;
import com.eticketing.app.place.PlaceRepository;
import com.eticketing.app.pos.PointOfSaleType;
import com.eticketing.app.pos.PointOfSaleRepository;
import com.eticketing.app.trip.SegmentType;
import com.eticketing.app.trip.StopType;
import com.eticketing.app.trip.TripPlaceRef;
import com.eticketing.app.trip.TripType;
import com.eticketing.app.trip.TripTypeRepository;
import com.eticketing.app.user.PhoneType;
import com.eticketing.app.user.UserType;
import com.eticketing.app.user.UserTypeRepository;

@Service
public class TicketDocumentService {

    private static final String SAFRA_LOGO_URL = "https://eticketing-app.s3.eu-north-1.amazonaws.com/logos/logo_white.png";
    private static final String SAFRA_BRAND_NAME = "Safra";
    private static final HttpClient LOGO_HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(4))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
    private static final Duration LOGO_REQUEST_TIMEOUT = Duration.ofSeconds(6);
    private static final int MAX_INLINE_LOGO_BYTES = 1024 * 1024;
    private static final ConcurrentMap<String, String> LOGO_DATA_URI_CACHE = new ConcurrentHashMap<>();

    private final TripTypeRepository tripRepository;
    private final UserTypeRepository userRepository;
    private final PointOfSaleRepository posRepository;
    private final CompanyRepository companyRepository;
    private final PlaceRepository placeRepository;
    private final TicketTemplateEngine templateEngine;
    private final TicketQrCodeService qrCodeService;

    public TicketDocumentService(TripTypeRepository tripRepository,
            UserTypeRepository userRepository,
            PointOfSaleRepository posRepository,
            CompanyRepository companyRepository,
            PlaceRepository placeRepository,
            TicketTemplateEngine templateEngine,
            TicketQrCodeService qrCodeService) {
        this.tripRepository = tripRepository;
        this.userRepository = userRepository;
        this.posRepository = posRepository;
        this.companyRepository = companyRepository;
        this.placeRepository = placeRepository;
        this.templateEngine = templateEngine;
        this.qrCodeService = qrCodeService;
    }

    public TicketDocumentView buildDocument(TicketType ticket) {
        if (ticket == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found");
        }
        TripType trip = tripRepository.findById(ticket.getTripId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip not found for ticket"));

        // Resolve passenger from passengerId
        UserType user = ticket.getPassengerId() != null
                ? userRepository.findById(ticket.getPassengerId()).orElse(null)
                : null;

        // Get POS for company info
        String posId = ticket.getTarget() != null ? ticket.getTarget().getPos() : null;
        PointOfSaleType pos = posId != null ? posRepository.findById(posId).orElse(null) : null;
        String companyIdValue = ticket.getTarget() != null ? ticket.getTarget().getCompany() : null;
        CompanyType company = companyIdValue != null
                ? companyRepository.findById(companyIdValue).orElse(null)
                : null;

        // Derive origin/destination from ticket segments
        String originId = resolveOriginPlaceId(trip, ticket);
        String destinationId = resolveDestinationPlaceId(trip, ticket);
        PlaceType origin = originId != null ? placeRepository.findById(originId).orElse(null) : null;
        PlaceType destination = destinationId != null ? placeRepository.findById(destinationId).orElse(null) : null;
        TicketLanguage language = TicketLanguage.fromCode(ticket.getLang());
        LocalizedEmailContent localized = LocalizedEmailContent.forLanguage(language);

        String passengerName;
        if (user != null) {
            passengerName = String.format("%s %s", defaultString(user.getFirstName()), defaultString(user.getLastName())).trim();
        } else {
            passengerName = String.format("%s %s",
                    defaultString(ticket.getGuestFirstName()),
                    defaultString(ticket.getGuestLastName())).trim();
        }
        if (passengerName.isBlank()) {
            passengerName = localized.defaultPassengerName();
        }
        String passengerEmail = user != null ? user.getEmail() : null;

        String companyName = company != null
                ? firstNonBlank(company.getName(), company.getLegalName())
                : "";
        if (companyName.isBlank()) {
            companyName = localized.defaultCompanyName();
        }

        String companySubtitle = company != null
                ? firstNonBlank(
                        !defaultString(company.getLegalName()).equals(companyName) ? company.getLegalName() : null,
                        company.getTaxId() != null && !company.getTaxId().isBlank() ? "MF " + company.getTaxId() : null)
                : "";

        String agencyName = firstNonBlank(pos != null ? pos.getTitle() : null, companyName, localized.defaultSalesChannel());
        String agencyEmail = firstNonBlank(
                pos != null ? pos.getEmail() : null,
                company != null && company.getContact() != null ? company.getContact().getEmail() : null,
                "");
        String agencyPhone = firstNonBlank(
                formatPhone(pos != null ? pos.getPhone() : null),
                formatPhone(company != null && company.getContact() != null ? company.getContact().getPhone() : null),
                "");
        String supportLine = buildSupportLine(agencyEmail, agencyPhone, localized.supportUnavailable());
        String rawCompanyLogoUrl = resolvePictureUrl(company != null ? company.getPicture() : null);
        String companyLogoUrl = resolveCompanyLogoSource(rawCompanyLogoUrl, companyName);
        String emailCompanyLogoUrl = resolveEmailLogoSource(rawCompanyLogoUrl, companyName);
        String printPoweredByHtml = buildPlatformAttributionHtml(resolveCompanyLogoSource(SAFRA_LOGO_URL, SAFRA_BRAND_NAME));
        String emailPoweredByHtml = buildPlatformAttributionHtml(resolveEmailLogoSource(SAFRA_LOGO_URL, SAFRA_BRAND_NAME));
        String companyLogoStyle = "";
        String salesChannel = pos != null ? pos.getTitle() : localized.defaultSalesChannel();
        String routeLabel = String.format("%s > %s",
                origin != null ? origin.getCity() : defaultString(originId),
                destination != null ? destination.getCity() : defaultString(destinationId));
        String pickupSummary = resolvePickupSummary(trip, ticket, origin, localized.notProvided(), language);
        String dropoffSummary = resolveDropoffSummary(trip, ticket, destination, localized.notProvided(), language);

        String totalAmount = ticket.getAppliedPrice() != null ? ticket.getAppliedPrice().toPlainString() : "-";
        String amountText = formatTicketAmount(ticket);
        String reference = firstNonBlank(ticket.getReference(), ticket.getIdempotencyKey());
        int segmentCount = ticket.getSegmentIds() != null ? ticket.getSegmentIds().size() : 0;
        String seatValue = resolveSeatLabel(null, ticket, localized);
        String qrCodeDataUri = qrCodeService.generateDataUri(reference);
        String qrCodeUrl = qrCodeService.generatePublicUrl(reference);
        String emailTemplate = company != null && company.getEmailTemplate() != null && !company.getEmailTemplate().isBlank()
                ? company.getEmailTemplate()
                : TicketTemplateDefaults.defaultEmailTemplate();
        String printTemplate = TicketTemplateDefaults.defaultPrintTemplate();
        ZoneId tripZone = resolveTripZone(trip);
        String tripDate = formatTripDate(trip.getDepartureDate(), tripZone, language);
        String tripTime = formatTripTime(trip.getDepartureDate(), tripZone, language);
        String localizedStatus = translateStatus(ticket.getStatus(), language);
        String footerText = localized.footerText(reference, companyName, supportLine);
        String pagesHtml = buildTicketSheetHtml(
                localized.eyebrowText(),
                "",
                companyName,
                companySubtitle,
                companyLogoUrl,
                routeLabel,
                localized.heroSubtitle(tripDate, tripTime, localizedStatus),
                localizedStatus,
                localized.referenceLabel(),
                reference,
                localized.amountLabel(),
                amountText,
                localized.passengerLabel(),
                passengerName,
                localized.seatLabel(),
                seatValue,
                localized.supportContactLabel(),
                supportLine,
                localized.pickupLabel(),
                pickupSummary,
                localized.dropoffLabel(),
                dropoffSummary,
                qrCodeDataUri,
                localized.ticketQrAltText(),
                localized.qrHintText(),
                footerText,
                printPoweredByHtml);

        Map<String, Object> context = new HashMap<>();
        context.put("htmlLang", language.getHtmlLang());
        context.put("direction", language.getDirection());
        context.put("textAlign", language.getTextAlign());
        context.put("heroLogoCellStyle", language.isRtl() ? "width:88px;padding-left:16px;" : "width:88px;padding-right:16px;");
        context.put("eyebrowText", localized.eyebrowText());
        context.put("reference", reference);
        context.put("bookingReference", reference);
        context.put("passengerName", passengerName);
        context.put("passengerEmail", passengerEmail != null ? passengerEmail : "");
        context.put("greetingText", localized.greetingText());
        context.put("introText", buildEmailIntroHtml(localized.introText()));
        context.put("referenceLabel", localized.referenceLabel());
        context.put("companyLabel", localized.companyLabel());
        context.put("salesChannelLabel", localized.salesChannelLabel());
        context.put("amountLabel", localized.amountLabel());
        context.put("segmentsCoveredLabel", localized.segmentsCoveredLabel());
        context.put("statusLabel", localized.statusLabel());
        context.put("passengerLabel", localized.passengerLabel());
        context.put("supportContactLabel", localized.supportContactLabel());
        context.put("pickupLabel", localized.pickupLabel());
        context.put("dropoffLabel", localized.dropoffLabel());
        context.put("ticketQrAltText", localized.ticketQrAltText());
        context.put("qrHintText", localized.qrHintText());
        context.put("footerText", footerText);
        context.put("heroSubtitle", localized.heroSubtitle(tripDate, tripTime, localizedStatus));
        context.put("seats", localized.segmentSummary(segmentCount));
        context.put("seatCount", segmentCount);
        context.put("segmentLabel", localized.segmentSummary(segmentCount));
        context.put("tripRoute", routeLabel);
        context.put("tripDate", tripDate);
        context.put("tripTime", tripTime);
        context.put("currency", ticket.getCurrency());
        context.put("totalAmount", totalAmount);
        context.put("status", localizedStatus);
        context.put("companyName", companyName);
        context.put("companySubtitle", companySubtitle);
        context.put("companyLogoUrl", companyLogoUrl);
        context.put("companyLogoStyle", companyLogoStyle);
        context.put("salesChannel", salesChannel);
        context.put("agencyName", agencyName);
        context.put("agencyEmail", agencyEmail);
        context.put("agencyPhone", agencyPhone);
        context.put("supportLine", supportLine);
        context.put("pickupSummary", pickupSummary);
        context.put("dropoffSummary", dropoffSummary);
        context.put("qrCodeUrl", qrCodeDataUri);
        context.put("qrCode", qrCodeUrl);
        context.put("qrSectionStyle", "");
        context.put("pagesHtml", pagesHtml);
        context.put("platformAttributionHtml", emailPoweredByHtml);

        Map<String, Object> emailContext = new HashMap<>(context);
        emailContext.put("companyLogoUrl", emailCompanyLogoUrl);
        emailContext.put("qrCodeUrl", qrCodeUrl);
        emailContext.put("qrCode", qrCodeUrl);

        String emailHtml = templateEngine.render(emailTemplate, emailContext);
        String printHtml = templateEngine.render(printTemplate, context);

        TicketDocumentView view = new TicketDocumentView();
        view.setTicketId(ticket.getId());
        view.setReference(reference);
        view.setQrCodeUrl(qrCodeUrl);
        view.setQrCodeDataUri(qrCodeDataUri);
        view.setHtmlContent(printHtml);
        view.setPrintHtmlContent(printHtml);
        view.setEmailHtmlContent(emailHtml);
        view.setRenderedAt(Instant.now());
        view.setPassengerEmail(passengerEmail);
        view.setSubject(localized.subject(companyName, reference));
        view.setMetadata(buildMetadata(ticket, trip, company, passengerName, passengerEmail, agencyName, routeLabel, reference, rawCompanyLogoUrl));
        return view;
    }

    // ════════════════════════════════════════════════════════════════════
    // ORDER-LEVEL MASTER DOCUMENT
    // ════════════════════════════════════════════════════════════════════
    /**
     * Builds ONE master ticket / itinerary for an entire order. Sent to the
     * contact customer with a passenger manifest table.
     */
    public TicketDocumentView buildOrderDocument(OrderType order, List<TicketType> tickets) {
        if (order == null || tickets == null || tickets.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order or tickets not found");
        }
        TicketType firstTicket = tickets.get(0);
        List<OrderTicketEntry> ticketEntries = buildOrderTicketEntries(order, tickets);
        TripType trip = tripRepository.findById(order.getTripId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Trip not found for order"));

        // Contact customer
        UserType contactUser = order.getContactCustomerId() != null
                ? userRepository.findById(order.getContactCustomerId()).orElse(null)
                : null;

        String companyIdValue = order.getTarget() != null ? order.getTarget().getCompany() : null;
        CompanyType company = companyIdValue != null
                ? companyRepository.findById(companyIdValue).orElse(null)
                : null;

        String posId = order.getTarget() != null ? order.getTarget().getPos() : null;
        PointOfSaleType pos = posId != null ? posRepository.findById(posId).orElse(null) : null;

        String originId = resolveOriginPlaceId(trip, firstTicket);
        String destinationId = resolveDestinationPlaceId(trip, firstTicket);
        PlaceType origin = originId != null ? placeRepository.findById(originId).orElse(null) : null;
        PlaceType destination = destinationId != null ? placeRepository.findById(destinationId).orElse(null) : null;
        TicketLanguage language = TicketLanguage.fromCode(firstTicket.getLang());
        LocalizedEmailContent localized = LocalizedEmailContent.forLanguage(language);

        String contactName = contactUser != null
                ? String.format("%s %s", defaultString(contactUser.getFirstName()), defaultString(contactUser.getLastName())).trim()
                : localized.defaultPassengerName();
        if (contactName.isBlank()) {
            contactName = localized.defaultPassengerName();
        }
        String contactEmail = contactUser != null ? contactUser.getEmail() : null;

        String companyName = company != null ? firstNonBlank(company.getName(), company.getLegalName()) : "";
        if (companyName.isBlank()) {
            companyName = localized.defaultCompanyName();
        }
        String companySubtitle = company != null
                ? firstNonBlank(
                        !defaultString(company.getLegalName()).equals(companyName) ? company.getLegalName() : null,
                        company.getTaxId() != null && !company.getTaxId().isBlank() ? "MF " + company.getTaxId() : null)
                : "";

        String agencyName = firstNonBlank(pos != null ? pos.getTitle() : null, companyName, localized.defaultSalesChannel());
        String agencyEmail = firstNonBlank(
                pos != null ? pos.getEmail() : null,
                company != null && company.getContact() != null ? company.getContact().getEmail() : null, "");
        String agencyPhone = firstNonBlank(
                formatPhone(pos != null ? pos.getPhone() : null),
                formatPhone(company != null && company.getContact() != null ? company.getContact().getPhone() : null), "");
        String supportLine = buildSupportLine(agencyEmail, agencyPhone, localized.supportUnavailable());
        String rawCompanyLogoUrl = resolvePictureUrl(company != null ? company.getPicture() : null);
        String companyLogoUrl = resolveCompanyLogoSource(rawCompanyLogoUrl, companyName);
        String emailCompanyLogoUrl = resolveEmailLogoSource(rawCompanyLogoUrl, companyName);
        String printPoweredByHtml = buildPlatformAttributionHtml(resolveCompanyLogoSource(SAFRA_LOGO_URL, SAFRA_BRAND_NAME));
        String emailPoweredByHtml = buildPlatformAttributionHtml(resolveEmailLogoSource(SAFRA_LOGO_URL, SAFRA_BRAND_NAME));
        String companyLogoStyle = "";
        String salesChannel = pos != null ? pos.getTitle() : localized.defaultSalesChannel();
        String routeLabel = String.format("%s > %s",
                origin != null ? origin.getCity() : defaultString(originId),
                destination != null ? destination.getCity() : defaultString(destinationId));
        String pickupSummary = resolvePickupSummary(trip, firstTicket, origin, localized.notProvided(), language);
        String dropoffSummary = resolveDropoffSummary(trip, firstTicket, destination, localized.notProvided(), language);

        String reference = firstNonBlank(firstTicket.getReference(), firstTicket.getIdempotencyKey());
        String totalAmount = order.getTotalPrice() != null ? order.getTotalPrice().toPlainString() : "-";
        int passengerCount = !ticketEntries.isEmpty() ? ticketEntries.size() : tickets.size();
        String qrCodeDataUri = qrCodeService.generateDataUri(reference);
        String qrCodeUrl = qrCodeService.generatePublicUrl(reference);
        ZoneId tripZone = resolveTripZone(trip);
        String tripDate = formatTripDate(trip.getDepartureDate(), tripZone, language);
        String tripTime = formatTripTime(trip.getDepartureDate(), tripZone, language);
        String localizedStatus = translateOrderStatus(order.getStatus(), language);
        String pagesHtml = buildOrderTicketPagesHtml(
                ticketEntries,
                localized,
                companyName,
                companySubtitle,
                companyLogoUrl,
                routeLabel,
                tripDate,
                tripTime,
                salesChannel,
                supportLine,
                pickupSummary,
                dropoffSummary,
                printPoweredByHtml);

        String emailTemplate = company != null && company.getEmailTemplate() != null && !company.getEmailTemplate().isBlank()
                ? company.getEmailTemplate()
                : TicketTemplateDefaults.defaultEmailTemplate();
        String printTemplate = TicketTemplateDefaults.defaultPrintTemplate();
        String orderIntroText = buildEmailIntroHtml(localized.orderIntroText(passengerCount))
                + buildEmailPassengerTicketCardsHtml(ticketEntries, language);

        Map<String, Object> context = new HashMap<>();
        context.put("htmlLang", language.getHtmlLang());
        context.put("direction", language.getDirection());
        context.put("textAlign", language.getTextAlign());
        context.put("heroLogoCellStyle", language.isRtl() ? "width:88px;padding-left:16px;" : "width:88px;padding-right:16px;");
        context.put("eyebrowText", localized.orderEyebrowText());
        context.put("reference", reference);
        context.put("bookingReference", reference);
        context.put("passengerName", contactName);
        context.put("passengerEmail", contactEmail != null ? contactEmail : "");
        context.put("greetingText", localized.greetingText());
        context.put("introText", orderIntroText);
        context.put("referenceLabel", localized.referenceLabel());
        context.put("companyLabel", localized.companyLabel());
        context.put("salesChannelLabel", localized.salesChannelLabel());
        context.put("amountLabel", localized.amountLabel());
        context.put("segmentsCoveredLabel", localized.passengersLabel());
        context.put("statusLabel", localized.statusLabel());
        context.put("passengerLabel", localized.passengerLabel());
        context.put("supportContactLabel", localized.supportContactLabel());
        context.put("pickupLabel", localized.pickupLabel());
        context.put("dropoffLabel", localized.dropoffLabel());
        context.put("ticketQrAltText", localized.ticketQrAltText());
        context.put("qrHintText", localized.qrHintText());
        context.put("footerText", localized.footerText(reference, companyName, supportLine));
        context.put("heroSubtitle", localized.heroSubtitle(tripDate, tripTime, localizedStatus));
        context.put("seats", passengerCount + " " + localized.passengersWord());
        context.put("seatCount", passengerCount);
        context.put("segmentLabel", passengerCount + " " + localized.passengersWord());
        context.put("tripRoute", routeLabel);
        context.put("tripDate", tripDate);
        context.put("tripTime", tripTime);
        context.put("currency", order.getCurrency());
        context.put("totalAmount", totalAmount);
        context.put("status", localizedStatus);
        context.put("companyName", companyName);
        context.put("companySubtitle", companySubtitle);
        context.put("companyLogoUrl", companyLogoUrl);
        context.put("companyLogoStyle", companyLogoStyle);
        context.put("salesChannel", salesChannel);
        context.put("agencyName", agencyName);
        context.put("agencyEmail", agencyEmail);
        context.put("agencyPhone", agencyPhone);
        context.put("supportLine", supportLine);
        context.put("pickupSummary", pickupSummary);
        context.put("dropoffSummary", dropoffSummary);
        context.put("qrCodeUrl", qrCodeDataUri);
        context.put("qrCode", qrCodeUrl);
        context.put("qrSectionStyle", "display:none;");
        context.put("pagesHtml", pagesHtml);
        context.put("platformAttributionHtml", emailPoweredByHtml);

        Map<String, Object> emailContext = new HashMap<>(context);
        emailContext.put("companyLogoUrl", emailCompanyLogoUrl);
        emailContext.put("qrCodeUrl", qrCodeUrl);
        emailContext.put("qrCode", qrCodeUrl);

        String emailHtml = templateEngine.render(emailTemplate, emailContext);
        String printHtml = templateEngine.render(printTemplate, context);

        TicketDocumentView view = new TicketDocumentView();
        view.setTicketId(order.getId());
        view.setReference(reference);
        view.setQrCodeUrl(qrCodeUrl);
        view.setQrCodeDataUri(qrCodeDataUri);
        view.setHtmlContent(printHtml);
        view.setPrintHtmlContent(printHtml);
        view.setEmailHtmlContent(emailHtml);
        view.setRenderedAt(Instant.now());
        view.setPassengerEmail(contactEmail);
        view.setSubject(localized.orderSubject(companyName, reference));
        return view;
    }

    private String buildEmailPassengerTicketCardsHtml(List<OrderTicketEntry> ticketEntries, TicketLanguage language) {
        if (ticketEntries == null || ticketEntries.isEmpty()) {
            return "";
        }

        LocalizedEmailContent localized = LocalizedEmailContent.forLanguage(language);
        StringBuilder sb = new StringBuilder();
        sb.append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-top:24px;\">");
        sb.append("<tr><td>");
        sb.append("<p style=\"margin:0 0 8px 0;font-size:18px;line-height:1.4;font-weight:700;color:#0f172a;\">")
                .append(localized.individualTicketsHeading())
                .append("</p>");
        sb.append("<p style=\"margin:0 0 16px 0;font-size:14px;line-height:1.55;color:#475569;\">")
                .append(localized.individualTicketsIntroText())
                .append("</p>");
        sb.append("</td></tr></table>");

        for (int i = 0; i < ticketEntries.size(); i++) {
            OrderTicketEntry entry = ticketEntries.get(i);
            TicketType ticket = entry.ticket();
            if (ticket == null) {
                continue;
            }

            String ticketReference = escapeHtml(firstNonBlank(ticket.getReference(), ticket.getIdempotencyKey()));
            String passengerName = escapeHtml(resolvePassengerName(entry.passenger(), ticket));
            String seat = escapeHtml(resolveSeatLabel(entry.passenger(), ticket, localized));
            String amount = escapeHtml(formatTicketAmount(ticket));
            String ticketStatus = escapeHtml(translateStatus(ticket.getStatus(), language));
            String qrCodeImage = escapeHtml(qrCodeService.generatePublicUrl(firstNonBlank(ticket.getReference(), ticket.getIdempotencyKey())));

            sb.append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-top:16px;border:1px solid #e2e8f0;border-radius:16px;background:#ffffff;overflow:hidden;\">");
            sb.append("<tr><td style=\"padding:16px 18px;background:#f8fafc;border-bottom:1px solid #e2e8f0;\">");
            sb.append("<div style=\"font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;\">")
                    .append(localized.passengerTicketLabel(i + 1))
                    .append("</div>");
            sb.append("<div style=\"margin-top:6px;font-size:13px;font-weight:700;letter-spacing:.08em;color:#0f172a;word-break:break-word;\">")
                    .append(ticketReference)
                    .append("</div>");
            sb.append("</td></tr>");
            sb.append("<tr><td style=\"padding:18px 18px 20px 18px;\">");
            sb.append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" class=\"stack\"><tr>");
            sb.append("<td valign=\"top\" style=\"padding-right:12px;\">");
            appendEmailTicketField(sb, localized.passengerLabel(), passengerName);
            appendEmailTicketField(sb, localized.seatLabel(), seat);
            appendEmailTicketField(sb, localized.amountLabel(), amount);
            appendEmailTicketField(sb, localized.statusLabel(), ticketStatus);
            sb.append("</td>");
            sb.append("<td class=\"stack-gap\" style=\"width:12px;\">&nbsp;</td>");
            sb.append("<td valign=\"top\" width=\"168\" style=\"width:168px;\">");
            sb.append("<div style=\"padding:12px;border:1px solid #e2e8f0;border-radius:14px;background:#ffffff;text-align:center;\">");
            sb.append("<img src=\"").append(qrCodeImage).append("\" alt=\"").append(escapeHtml(localized.ticketQrAltText()))
                    .append("\" width=\"120\" height=\"120\" style=\"width:120px;max-width:100%;height:auto;margin:0 auto;\">");
            sb.append("</div>");
            sb.append("<div style=\"margin-top:8px;font-size:12px;line-height:1.5;color:#64748b;text-align:center;\">")
                    .append(localized.qrHintText())
                    .append("</div>");
            sb.append("</td>");
            sb.append("</tr></table>");
            sb.append("</td></tr></table>");
        }

        return sb.toString();
    }

    private void appendEmailTicketField(StringBuilder sb, String label, String value) {
        sb.append("<div style=\"margin-bottom:14px;\">");
        sb.append("<div style=\"font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;\">")
                .append(escapeHtml(label))
                .append("</div>");
        sb.append("<div style=\"margin-top:4px;font-size:15px;font-weight:700;color:#0f172a;\">")
                .append(value)
                .append("</div>");
        sb.append("</div>");
    }

    private String buildEmailIntroHtml(String introText) {
        return "<p style=\"margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#475569;\">"
                + escapeHtml(introText)
                + "</p>";
    }

    private String buildOrderTicketPagesHtml(List<OrderTicketEntry> ticketEntries,
            LocalizedEmailContent localized,
            String companyName,
            String companySubtitle,
            String companyLogoUrl,
            String routeLabel,
            String tripDate,
            String tripTime,
            String salesChannel,
            String supportLine,
            String pickupSummary,
            String dropoffSummary,
            String platformAttributionHtml) {
        if (ticketEntries == null || ticketEntries.isEmpty()) {
            return "";
        }

        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < ticketEntries.size(); i++) {
            OrderTicketEntry entry = ticketEntries.get(i);
            TicketType ticket = entry.ticket();
            if (ticket == null) {
                continue;
            }

            String ticketReference = firstNonBlank(ticket.getReference(), ticket.getIdempotencyKey());
            String passengerName = resolvePassengerName(entry.passenger(), ticket);
            String seat = resolveSeatLabel(entry.passenger(), ticket, localized);
            String amount = formatTicketAmount(ticket);
            String ticketStatus = translateStatus(ticket.getStatus(), localized.language());
            String qrCodeImage = qrCodeService.generateDataUri(ticketReference);
            String footerText = localized.footerText(ticketReference, companyName, supportLine);
            String contextTag = localized.passengerTicketLabel(i + 1) + " · " + ticketEntries.size() + " " + localized.passengersWord();

            sb.append(buildTicketSheetHtml(
                    localized.orderEyebrowText(),
                    contextTag,
                    companyName,
                    companySubtitle,
                    companyLogoUrl,
                    routeLabel,
                    localized.heroSubtitle(tripDate, tripTime, ticketStatus),
                    ticketStatus,
                    localized.referenceLabel(),
                    ticketReference,
                    localized.amountLabel(),
                    amount,
                    localized.passengerLabel(),
                    passengerName,
                    localized.seatLabel(),
                    seat,
                    localized.supportContactLabel(),
                    supportLine,
                    localized.pickupLabel(),
                    pickupSummary,
                    localized.dropoffLabel(),
                    dropoffSummary,
                    qrCodeImage,
                    localized.ticketQrAltText(),
                    localized.qrHintText(),
                    footerText,
                    platformAttributionHtml));
        }
        return sb.toString();
    }

    private String buildTicketSheetHtml(String eyebrowText,
            String contextTag,
            String companyName,
            String companySubtitle,
            String companyLogoUrl,
            String routeLabel,
            String heroSubtitle,
            String status,
            String referenceLabel,
            String reference,
            String amountLabel,
            String amount,
            String passengerLabel,
            String passengerName,
            String seatLabel,
            String seatValue,
            String supportContactLabel,
            String supportLine,
            String pickupLabel,
            String pickupSummary,
            String dropoffLabel,
            String dropoffSummary,
            String qrCodeDataUri,
            String ticketQrAltText,
            String qrHintText,
            String footerText,
            String platformAttributionHtml) {
        StringBuilder sb = new StringBuilder();
        sb.append("<section class=\"pdf-page\"><article class=\"ticket-sheet\">");
        sb.append("<header class=\"ticket-hero\">");
        sb.append("<div class=\"brand-lockup\">");
        sb.append("<div class=\"brand-unit\">");
        sb.append("<div class=\"brand-mark\"><img class=\"brand-logo\" src=\"")
                .append(escapeHtml(companyLogoUrl))
                .append("\" alt=\"")
                .append(escapeHtml(companyName))
                .append("\"></div>");
        sb.append("<div>");
        sb.append("<p class=\"ticket-eyebrow\">").append(escapeHtml(eyebrowText)).append("</p>");
        sb.append("<h1 class=\"ticket-brand\">").append(escapeHtml(companyName)).append("</h1>");
        if (!defaultString(companySubtitle).isBlank()) {
            sb.append("<p class=\"ticket-company-copy\">").append(escapeHtml(companySubtitle)).append("</p>");
        }
        sb.append("</div></div>");
        if (!defaultString(contextTag).isBlank()) {
            sb.append("<div class=\"hero-tag\">").append(escapeHtml(contextTag)).append("</div>");
        }
        sb.append("</div>");
        sb.append("<div class=\"route-row\">");
        sb.append("<div>");
        sb.append("<p class=\"route-title\">").append(escapeHtml(routeLabel)).append("</p>");
        sb.append("<p class=\"route-copy\">").append(escapeHtml(heroSubtitle)).append("</p>");
        sb.append("</div>");
        sb.append("<div class=\"status-chip\">").append(escapeHtml(status)).append("</div>");
        sb.append("</div>");
        sb.append("</header>");

        sb.append("<div class=\"ticket-layout\">");
        sb.append("<div class=\"ticket-main\">");
        sb.append("<div class=\"info-grid\">");
        sb.append(buildInfoCard(referenceLabel, reference, "info-card info-card-wide", false));
        sb.append(buildInfoCard(amountLabel, amount, "info-card", false));
        sb.append(buildInfoCard(seatLabel, seatValue, "info-card", false));
        sb.append("</div>");

        sb.append("<div class=\"detail-grid\">");
        sb.append("<div class=\"info-card detail-list\">");
        sb.append(buildDetailItem(passengerLabel, passengerName));
        sb.append(buildDetailItem(supportContactLabel, supportLine));
        sb.append("</div>");
        sb.append("<div class=\"info-card detail-list\">");
        sb.append(buildJourneyStop(pickupLabel, pickupSummary));
        sb.append(buildJourneyStop(dropoffLabel, dropoffSummary));
        sb.append("</div>");
        sb.append("</div>");
        sb.append("</div>");

        sb.append("<aside class=\"qr-panel\">");
        sb.append("<div>");
        sb.append("<p class=\"qr-badge\">").append(escapeHtml(referenceLabel)).append("</p>");
        sb.append("<p class=\"qr-reference\">").append(escapeHtml(reference)).append("</p>");
        sb.append("</div>");
        sb.append("<div class=\"qr-frame\"><img src=\"")
                .append(escapeHtml(qrCodeDataUri))
                .append("\" alt=\"")
                .append(escapeHtml(ticketQrAltText))
                .append("\"></div>");
        sb.append("<p class=\"qr-hint\">").append(escapeHtml(qrHintText)).append("</p>");
        sb.append("</aside>");
        sb.append("</div>");

        sb.append("<footer class=\"ticket-footer\">").append(escapeHtml(footerText));
        sb.append(platformAttributionHtml);
        sb.append("</footer>");
        sb.append("</article></section>");
        return sb.toString();
    }

    private String buildInfoCard(String label, String value, String className, boolean compact) {
        StringBuilder sb = new StringBuilder();
        sb.append("<div class=\"").append(className).append("\">");
        sb.append("<p class=\"info-label\">").append(escapeHtml(label)).append("</p>");
        sb.append("<p class=\"").append(compact ? "info-copy" : "info-value").append("\">")
                .append(escapeHtml(value))
                .append("</p>");
        sb.append("</div>");
        return sb.toString();
    }

    private String buildDetailItem(String label, String value) {
        return "<div><p class=\"info-label\">" + escapeHtml(label) + "</p><p class=\"info-copy\">" + escapeHtml(value) + "</p></div>";
    }

    private String buildJourneyStop(String label, String value) {
        return "<div class=\"journey-stop\"><p class=\"info-label\">" + escapeHtml(label) + "</p><p class=\"info-copy\">" + escapeHtml(value) + "</p></div>";
    }

    private String buildPlatformAttributionHtml(String logoUrl) {
        return "<div style=\"margin-top:10px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:11px;line-height:1.4;color:#64748b;\">"
                + "<span>Powered by</span>"
                + "<img src=\"" + escapeHtml(logoUrl) + "\" alt=\"" + SAFRA_BRAND_NAME + "\" style=\"height:14px;width:auto;display:inline-block;vertical-align:middle;\">"
                + "</div>";
    }

    private List<OrderTicketEntry> buildOrderTicketEntries(OrderType order, List<TicketType> tickets) {
        List<OrderTicketEntry> entries = new ArrayList<>();
        if (tickets == null || tickets.isEmpty()) {
            return entries;
        }

        List<TicketType> remainingTickets = new ArrayList<>(tickets);
        List<OrderType.OrderPassenger> passengers = order != null ? order.getPassengers() : null;
        if (passengers != null) {
            for (OrderType.OrderPassenger passenger : passengers) {
                TicketType matchedTicket = null;
                String ticketId = passenger != null ? defaultString(passenger.getTicketId()) : "";
                if (!ticketId.isBlank()) {
                    for (TicketType candidate : remainingTickets) {
                        if (ticketId.equals(candidate.getId())) {
                            matchedTicket = candidate;
                            break;
                        }
                    }
                }
                if (matchedTicket == null && !remainingTickets.isEmpty()) {
                    matchedTicket = remainingTickets.get(0);
                }
                if (matchedTicket != null) {
                    entries.add(new OrderTicketEntry(passenger, matchedTicket));
                    remainingTickets.remove(matchedTicket);
                }
            }
        }

        for (TicketType ticket : remainingTickets) {
            entries.add(new OrderTicketEntry(null, ticket));
        }
        return entries;
    }

    private String resolvePassengerName(OrderType.OrderPassenger passenger, TicketType ticket) {
        String first = passenger != null ? defaultString(passenger.getFirstName()) : "";
        String last = passenger != null ? defaultString(passenger.getLastName()) : "";
        String combined = (first + " " + last).trim();
        if (!combined.isBlank()) {
            return combined;
        }

        // Fallback: resolve from registered user
        String passengerId = passenger != null ? passenger.getPassengerId() : null;
        if (passengerId == null && ticket != null) {
            passengerId = ticket.getPassengerId();
        }
        if (passengerId != null) {
            UserType user = userRepository.findById(passengerId).orElse(null);
            if (user != null) {
                return (defaultString(user.getFirstName()) + " " + defaultString(user.getLastName())).trim();
            }
        }

        if (ticket != null) {
            String guestFirst = defaultString(ticket.getGuestFirstName());
            String guestLast = defaultString(ticket.getGuestLastName());
            String guestName = (guestFirst + " " + guestLast).trim();
            if (!guestName.isBlank()) {
                return guestName;
            }
        }

        return "Passenger";
    }

    private String resolveSeatLabel(OrderType.OrderPassenger passenger, TicketType ticket, LocalizedEmailContent localized) {
        String seatNo = passenger != null ? defaultString(passenger.getSeatNo()) : "";
        if (seatNo.isBlank() && ticket != null) {
            seatNo = defaultString(ticket.getSeatNo());
        }
        return seatNo.isBlank() ? localized.freeSeatingLabel() : seatNo;
    }

    private String formatTicketAmount(TicketType ticket) {
        if (ticket == null || ticket.getAppliedPrice() == null) {
            return "-";
        }
        String currency = defaultString(ticket.getCurrency());
        return currency.isBlank()
                ? ticket.getAppliedPrice().toPlainString()
                : ticket.getAppliedPrice().toPlainString() + " " + currency;
    }

    private String escapeHtml(String text) {
        if (text == null) {
            return "";
        }
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    private record OrderTicketEntry(OrderType.OrderPassenger passenger, TicketType ticket) {

    }

    private String translateOrderStatus(OrderStatusEnum status, TicketLanguage language) {
        if (status == null) {
            return "";
        }
        return switch (language) {
            case EN_GB ->
                switch (status) {
                    case PENDING ->
                        "Pending";
                    case CONFIRMED ->
                        "Confirmed";
                    case CANCELLED ->
                        "Cancelled";
                    case EXPIRED ->
                        "Expired";
                };
            case AR_SA ->
                switch (status) {
                    case PENDING ->
                        "قيد الانتظار";
                    case CONFIRMED ->
                        "مؤكد";
                    case CANCELLED ->
                        "ملغى";
                    case EXPIRED ->
                        "منتهي";
                };
            case FR_FR ->
                switch (status) {
                    case PENDING ->
                        "En attente";
                    case CONFIRMED ->
                        "Confirmé";
                    case CANCELLED ->
                        "Annulé";
                    case EXPIRED ->
                        "Expiré";
                };
        };
    }

    private String resolvePickupSummary(
            TripType trip,
            TicketType ticket,
            PlaceType fallbackPlace,
            String fallbackValue,
            TicketLanguage language) {
        if (trip.getPickupPoints() != null && ticket.getPickupPointId() != null) {
            for (var pickup : trip.getPickupPoints()) {
                if (ticket.getPickupPointId().equals(pickup.getPointId())) {
                    PlaceType place = pickup.getPlaceId() != null ? placeRepository.findById(pickup.getPlaceId()).orElse(null) : null;
                    return formatPointSummary(
                            place != null ? place.getCity() : null,
                            pickup.getAddress(),
                            fallbackPlace != null ? fallbackPlace.getCity() : null,
                            pickup.getScheduledDepartureTime(),
                            fallbackPlace != null ? fallbackPlace.getId() : null,
                            trip,
                            language,
                            true,
                            fallbackValue);
                }
            }
        }
        return formatPointSummary(
                fallbackPlace != null ? fallbackPlace.getCity() : null,
                null,
                ticket.getPickupPointId(),
                null,
                fallbackPlace != null ? fallbackPlace.getId() : null,
                trip,
                language,
                true,
                fallbackValue);
    }

    private String resolveDropoffSummary(
            TripType trip,
            TicketType ticket,
            PlaceType fallbackPlace,
            String fallbackValue,
            TicketLanguage language) {
        if (trip.getDropoffPoints() != null && ticket.getDropoffPointId() != null) {
            for (var dropoff : trip.getDropoffPoints()) {
                if (ticket.getDropoffPointId().equals(dropoff.getPointId())) {
                    PlaceType place = dropoff.getPlaceId() != null ? placeRepository.findById(dropoff.getPlaceId()).orElse(null) : null;
                    return formatPointSummary(
                            place != null ? place.getCity() : null,
                            dropoff.getAddress(),
                            fallbackPlace != null ? fallbackPlace.getCity() : null,
                            dropoff.getScheduledArrivalTime(),
                            fallbackPlace != null ? fallbackPlace.getId() : null,
                            trip,
                            language,
                            false,
                            fallbackValue);
                }
            }
        }
        return formatPointSummary(
                fallbackPlace != null ? fallbackPlace.getCity() : null,
                null,
                ticket.getDropoffPointId(),
                null,
                fallbackPlace != null ? fallbackPlace.getId() : null,
                trip,
                language,
                false,
                fallbackValue);
    }

    private String formatPointSummary(
            String city,
            String address,
            String fallback,
            Instant scheduledTime,
            String stopPlaceId,
            TripType trip,
            TicketLanguage language,
            boolean departureTime,
            String emptyValue) {
        String primary = firstNonBlank(city, fallback, emptyValue);
        String secondary = defaultString(address);
        String locationSummary = secondary.isBlank() ? primary : primary + " - " + secondary;
        String scheduledTimeLabel = resolvePointTimeLabel(scheduledTime, stopPlaceId, trip, language, departureTime);
        return scheduledTimeLabel.isBlank() ? locationSummary : locationSummary + " · " + scheduledTimeLabel;
    }

    private String resolvePointTimeLabel(
            Instant scheduledTime,
            String stopPlaceId,
            TripType trip,
            TicketLanguage language,
            boolean departureTime) {
        Instant effectiveTime = scheduledTime;
        if (effectiveTime == null && stopPlaceId != null && trip != null && trip.getStopSchedule() != null) {
            effectiveTime = trip.getStopSchedule().stream()
                    .filter(stop -> stop != null && stopPlaceId.equals(stop.getPlaceId()))
                    .map(stop -> departureTime ? stop.getDepartureTime() : stop.getArrivalTime())
                    .filter(Objects::nonNull)
                    .findFirst()
                    .orElse(null);
        }
        if (effectiveTime == null) {
            return "";
        }
        return formatTripTime(effectiveTime, resolveTripZone(trip), language);
    }

    private String resolveOriginPlaceId(TripType trip, TicketType ticket) {
        List<String> segmentIds = ticket != null ? ticket.getSegmentIds() : null;
        List<SegmentType> segments = trip != null ? trip.getSegments() : null;
        String originPlaceId = resolveSegmentPlaceId(segmentIds, segments, true);
        if (originPlaceId != null) {
            return originPlaceId;
        }
        List<StopType> stops = trip != null ? trip.getStopSchedule() : null;
        return stops != null && !stops.isEmpty() ? stops.get(0).getPlaceId() : null;
    }

    private String resolveDestinationPlaceId(TripType trip, TicketType ticket) {
        List<String> segmentIds = ticket != null ? ticket.getSegmentIds() : null;
        List<SegmentType> segments = trip != null ? trip.getSegments() : null;
        String destinationPlaceId = resolveSegmentPlaceId(segmentIds, segments, false);
        if (destinationPlaceId != null) {
            return destinationPlaceId;
        }
        List<StopType> stops = trip != null ? trip.getStopSchedule() : null;
        return stops != null && !stops.isEmpty() ? stops.get(stops.size() - 1).getPlaceId() : null;
    }

    private String resolveSegmentPlaceId(List<String> segmentIds, List<SegmentType> segments, boolean origin) {
        if (segmentIds == null || segmentIds.isEmpty() || segments == null || segments.isEmpty()) {
            return null;
        }

        String segmentId = origin ? segmentIds.get(0) : segmentIds.get(segmentIds.size() - 1);
        return segments.stream()
                .filter(segment -> segment != null && segmentId.equals(segment.getSegmentId()))
                .map(segment -> origin ? segment.getFromPlace() : segment.getToPlace())
                .map(TripPlaceRef::idOf)
                .filter(placeId -> placeId != null && !placeId.isBlank())
                .findFirst()
                .orElse(null);
    }

    private ZoneId resolveTripZone(TripType trip) {
        String timezone = trip != null ? defaultString(trip.getTimezone()) : "";
        if (timezone.isBlank()) {
            return ZoneOffset.UTC;
        }
        try {
            return ZoneId.of(timezone);
        } catch (DateTimeException ex) {
            return ZoneOffset.UTC;
        }
    }

    private Map<String, Object> buildMetadata(TicketType ticket,
            TripType trip,
            CompanyType company,
            String passengerName,
            String passengerEmail,
            String agencyName,
            String routeLabel,
            String reference,
            String companyLogoUrl) {
        Map<String, Object> ticketMeta = new HashMap<>();
        ticketMeta.put("id", ticket.getId());
        ticketMeta.put("lang", TicketLanguage.fromCode(ticket.getLang()).getCode());
        ticketMeta.put("status", ticket.getStatus() != null ? ticket.getStatus().name() : null);
        ticketMeta.put("reference", reference);
        ticketMeta.put("appliedPrice", ticket.getAppliedPrice());
        ticketMeta.put("currency", ticket.getCurrency());

        Map<String, Object> passengerMeta = new HashMap<>();
        passengerMeta.put("name", passengerName);
        passengerMeta.put("email", passengerEmail);

        Map<String, Object> tripMeta = new HashMap<>();
        tripMeta.put("id", trip.getId());
        tripMeta.put("route", routeLabel);
        tripMeta.put("date", trip.getDepartureDate());
        tripMeta.put("time", trip.getDepartureDate() != null
                ? trip.getDepartureDate().atZone(resolveTripZone(trip)).toLocalTime()
                : null);

        String posIdValue = ticket.getTarget() != null ? ticket.getTarget().getPos() : null;
        Map<String, Object> agencyMeta = new HashMap<>();
        agencyMeta.put("id", posIdValue);
        agencyMeta.put("name", agencyName);

        Map<String, Object> companyMeta = new HashMap<>();
        companyMeta.put("id", ticket.getTarget() != null ? ticket.getTarget().getCompany() : null);
        companyMeta.put("name", company != null ? company.getName() : null);
        companyMeta.put("legalName", company != null ? company.getLegalName() : null);
        companyMeta.put("logoUrl", companyLogoUrl);

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("ticket", ticketMeta);
        metadata.put("passenger", passengerMeta);
        metadata.put("trip", tripMeta);
        metadata.put("agency", agencyMeta);
        metadata.put("company", companyMeta);
        return metadata;
    }

    private String defaultString(String value) {
        return value != null ? value.trim() : "";
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            String trimmed = defaultString(value);
            if (!trimmed.isBlank()) {
                return trimmed;
            }
        }
        return "";
    }

    private String formatPhone(PhoneType phone) {
        if (phone == null) {
            return "";
        }
        String countryCode = defaultString(phone.getCountryCode());
        String number = defaultString(phone.getNumber());
        if (countryCode.isBlank() && number.isBlank()) {
            return "";
        }
        if (countryCode.isBlank()) {
            return number;
        }
        if (number.isBlank()) {
            return countryCode.startsWith("+") ? countryCode : "+" + countryCode;
        }
        String normalizedCode = countryCode.startsWith("+") ? countryCode : "+" + countryCode;
        return normalizedCode + " " + number;
    }

    private String buildSupportLine(String email, String phone, String emptyValue) {
        String cleanEmail = defaultString(email);
        String cleanPhone = defaultString(phone);
        if (!cleanEmail.isBlank() && !cleanPhone.isBlank()) {
            return cleanEmail + " · " + cleanPhone;
        }
        if (!cleanEmail.isBlank()) {
            return cleanEmail;
        }
        if (!cleanPhone.isBlank()) {
            return cleanPhone;
        }
        return emptyValue;
    }

    private String resolvePictureUrl(PictureType picture) {
        if (picture == null) {
            return "";
        }
        String baseUrl = defaultString(picture.getBaseUrl()).replaceAll("/+$", "");
        String path = defaultString(picture.getPath());
        if (path.isBlank()) {
            return "";
        }
        if (path.startsWith("http://") || path.startsWith("https://")) {
            return path;
        }
        path = path.replaceAll("^/+", "");
        if (baseUrl.isBlank()) {
            return "";
        }
        return baseUrl + "/" + path;
    }

    private String resolveCompanyLogoSource(String pictureUrl, String companyName) {
        String inlinePicture = inlineRemoteImage(pictureUrl);
        if (!inlinePicture.isBlank()) {
            return inlinePicture;
        }
        return buildFallbackLogoDataUri(companyName);
    }

    private String resolveEmailLogoSource(String pictureUrl, String companyName) {
        String cleanUrl = defaultString(pictureUrl);
        if (!cleanUrl.isBlank()) {
            return cleanUrl;
        }
        return buildFallbackLogoDataUri(companyName);
    }

    private String inlineRemoteImage(String pictureUrl) {
        String cleanUrl = defaultString(pictureUrl);
        if (cleanUrl.isBlank()) {
            return "";
        }
        if (cleanUrl.startsWith("data:")) {
            return cleanUrl;
        }
        if (!(cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://"))) {
            return cleanUrl;
        }
        return LOGO_DATA_URI_CACHE.computeIfAbsent(cleanUrl, this::downloadImageAsDataUri);
    }

    private String downloadImageAsDataUri(String pictureUrl) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(pictureUrl))
                    .GET()
                    .timeout(LOGO_REQUEST_TIMEOUT)
                    .header("Accept", "image/*")
                    .build();
            HttpResponse<byte[]> response = LOGO_HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofByteArray());
            byte[] body = response.body();
            if (response.statusCode() < 200 || response.statusCode() >= 300 || body == null || body.length == 0 || body.length > MAX_INLINE_LOGO_BYTES) {
                return "";
            }

            String contentType = response.headers()
                    .firstValue("Content-Type")
                    .map(String::trim)
                    .filter(value -> !value.isBlank())
                    .orElseGet(() -> guessImageMimeType(pictureUrl));
            if (!contentType.startsWith("image/")) {
                contentType = guessImageMimeType(pictureUrl);
            }
            return "data:" + contentType + ";base64," + Base64.getEncoder().encodeToString(body);
        } catch (IOException ex) {
            return "";
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return "";
        } catch (IllegalArgumentException ex) {
            return "";
        }
    }

    private String guessImageMimeType(String pictureUrl) {
        String lowerUrl = defaultString(pictureUrl).toLowerCase();
        if (lowerUrl.endsWith(".svg")) {
            return "image/svg+xml";
        }
        if (lowerUrl.endsWith(".webp")) {
            return "image/webp";
        }
        if (lowerUrl.endsWith(".gif")) {
            return "image/gif";
        }
        if (lowerUrl.endsWith(".jpg") || lowerUrl.endsWith(".jpeg")) {
            return "image/jpeg";
        }
        return "image/png";
    }

    private String buildFallbackLogoDataUri(String companyName) {
        String initials = resolveCompanyInitials(companyName);
        String svg = "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'>"
                + "<defs><linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='#f8fbff'/><stop offset='100%' stop-color='#dbe8f4'/></linearGradient></defs>"
                + "<rect width='160' height='160' rx='36' fill='url(#g)'/>"
                + "<rect x='14' y='14' width='132' height='132' rx='28' fill='#ffffff' stroke='#d8e3ef'/>"
                + "<text x='50%' y='54%' text-anchor='middle' font-family='Arial,Helvetica,sans-serif' font-size='56' font-weight='700' fill='#0f172a'>"
                + initials
                + "</text></svg>";
        return "data:image/svg+xml;base64," + Base64.getEncoder().encodeToString(svg.getBytes(StandardCharsets.UTF_8));
    }

    private String resolveCompanyInitials(String companyName) {
        String cleanName = defaultString(companyName);
        if (cleanName.isBlank()) {
            return "ET";
        }

        StringBuilder initials = new StringBuilder();
        for (String part : cleanName.split("\\s+")) {
            if (part.isBlank()) {
                continue;
            }
            initials.append(Character.toUpperCase(part.charAt(0)));
            if (initials.length() == 2) {
                break;
            }
        }

        if (initials.length() == 0) {
            initials.append(cleanName.substring(0, Math.min(2, cleanName.length())).toUpperCase());
        }
        return initials.toString();
    }

    private String formatTripDate(Instant departureDate, ZoneId tripZone, TicketLanguage language) {
        if (departureDate == null) {
            return "";
        }
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd MMM uuuu", language.getLocale());
        return formatter.format(departureDate.atZone(tripZone));
    }

    private String formatTripTime(Instant departureDate, ZoneId tripZone, TicketLanguage language) {
        if (departureDate == null) {
            return "";
        }
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("HH:mm", language.getLocale());
        return formatter.format(departureDate.atZone(tripZone));
    }

    private String translateStatus(TicketStatusEnum status, TicketLanguage language) {
        if (status == null) {
            return LocalizedEmailContent.forLanguage(language).unknownStatus();
        }
        return switch (language) {
            case EN_GB ->
                switch (status) {
                    case PENDING ->
                        "Pending";
                    case CONFIRMED ->
                        "Confirmed";
                    case CANCELLED ->
                        "Cancelled";
                    case EXPIRED ->
                        "Expired";
                };
            case AR_SA ->
                switch (status) {
                    case PENDING ->
                        "قيد الانتظار";
                    case CONFIRMED ->
                        "مؤكد";
                    case CANCELLED ->
                        "ملغى";
                    case EXPIRED ->
                        "منتهي";
                };
            case FR_FR ->
                switch (status) {
                    case PENDING ->
                        "En attente";
                    case CONFIRMED ->
                        "Confirmé";
                    case CANCELLED ->
                        "Annulé";
                    case EXPIRED ->
                        "Expiré";
                };
        };
    }

    private record LocalizedEmailContent(
            TicketLanguage language,
            String defaultPassengerName,
            String defaultCompanyName,
            String defaultSalesChannel,
            String supportUnavailable,
            String notProvided,
            String unknownStatus,
            String eyebrowText,
            String greetingText,
            String introText,
            String referenceLabel,
            String companyLabel,
            String salesChannelLabel,
            String amountLabel,
            String segmentsCoveredLabel,
            String statusLabel,
            String passengerLabel,
            String supportContactLabel,
            String pickupLabel,
            String dropoffLabel,
            String qrHintText,
            String ticketQrAltText,
            String heroSubtitlePattern,
            String subjectPattern,
            String footerPattern) {

        static LocalizedEmailContent forLanguage(TicketLanguage language) {
            return switch (language) {
                case EN_GB ->
                    new LocalizedEmailContent(
                    language,
                    "Customer",
                    "Operator",
                    "Operator",
                    "Support not available",
                    "Not provided",
                    "Unknown",
                    "Travel ticket",
                    "Hello",
                    "Your ticket has been generated successfully. Keep this email and present the QR code during inspection.",
                    "Reference",
                    "Company",
                    "Sales channel",
                    "Amount",
                    "Covered segments",
                    "Status",
                    "Passenger",
                    "Support contact",
                    "Boarding",
                    "Drop-off",
                    "Present this QR code during inspection.",
                    "Ticket QR code",
                    "Departure on %s at %s · Status %s",
                    "Your ticket with %s - %s",
                    "This ticket is personal and linked to booking %s. If needed, contact %s via %s.");
                case AR_SA ->
                    new LocalizedEmailContent(
                    language,
                    "العميل",
                    "شركة النقل",
                    "الشركة",
                    "الدعم غير متوفر",
                    "غير متوفر",
                    "غير معروف",
                    "تذكرة سفر",
                    "مرحباً",
                    "تم إصدار تذكرتك بنجاح. احتفظ بهذا البريد الإلكتروني وقدّم رمز QR عند التفقد.",
                    "المرجع",
                    "الشركة",
                    "قناة البيع",
                    "المبلغ",
                    "المقاطع المشمولة",
                    "الحالة",
                    "المسافر",
                    "معلومات الدعم",
                    "الصعود",
                    "النزول",
                    "اعرض رمز QR هذا عند التفقد.",
                    "رمز QR للتذكرة",
                    "المغادرة يوم %s الساعة %s · الحالة %s",
                    "تذكرتك مع %s - %s",
                    "هذه التذكرة شخصية ومرتبطة بالحجز %s. عند الحاجة، تواصل مع %s عبر %s.");
                case FR_FR ->
                    new LocalizedEmailContent(
                    language,
                    "Client",
                    "Compagnie",
                    "Compagnie",
                    "Support non renseigné",
                    "Non renseigné",
                    "Inconnu",
                    "Billet de voyage",
                    "Bonjour",
                    "Votre billet a bien été généré. Conservez cet e-mail et présentez le QR code lors du contrôle.",
                    "Référence",
                    "Compagnie",
                    "Canal d'origine",
                    "Montant",
                    "Segments couverts",
                    "État",
                    "Passager",
                    "Contact support",
                    "Embarquement",
                    "Descente",
                    "Présentez ce QR code lors du contrôle.",
                    "QR code du billet",
                    "Départ le %s à %s · Statut %s",
                    "Votre billet %s - %s",
                    "Ce billet est personnel et lié à la réservation %s. En cas de besoin, contactez %s via %s.");
            };
        }

        String heroSubtitle(String tripDate, String tripTime, String status) {
            return String.format(heroSubtitlePattern, tripDate, tripTime, status);
        }

        String subject(String companyName, String reference) {
            return String.format(subjectPattern, companyName, reference);
        }

        String footerText(String reference, String companyName, String supportLine) {
            return String.format(footerPattern, reference, companyName, supportLine);
        }

        String segmentSummary(int segmentCount) {
            return switch (language) {
                case EN_GB ->
                    segmentCount + (segmentCount == 1 ? " segment" : " segments");
                case AR_SA ->
                    segmentCount == 1 ? "مقطع واحد" : segmentCount + " مقاطع";
                case FR_FR ->
                    segmentCount + (segmentCount > 1 ? " segments" : " segment");
            };
        }

        String orderEyebrowText() {
            return switch (language) {
                case EN_GB ->
                    "Group Booking Confirmation";
                case AR_SA ->
                    "تأكيد الحجز الجماعي";
                case FR_FR ->
                    "Confirmation de réservation groupe";
            };
        }

        String orderSubject(String companyName, String reference) {
            return switch (language) {
                case EN_GB ->
                    String.format("Your group booking with %s - %s", companyName, reference);
                case AR_SA ->
                    String.format("حجزك الجماعي مع %s - %s", companyName, reference);
                case FR_FR ->
                    String.format("Votre réservation groupe %s - %s", companyName, reference);
            };
        }

        String orderIntroText(int passengerCount) {
            return switch (language) {
                case EN_GB ->
                    String.format("Your group booking for %d passenger(s) has been generated successfully. Below is the passenger manifest. Present the QR code during inspection.", passengerCount);
                case AR_SA ->
                    String.format("تم إصدار حجزك الجماعي لـ %d مسافر(ين) بنجاح. فيما يلي قائمة المسافرين. اعرض رمز QR عند التفقد.", passengerCount);
                case FR_FR ->
                    String.format("Votre réservation groupe pour %d passager(s) a bien été générée. Voici la liste des passagers. Présentez le QR code lors du contrôle.", passengerCount);
            };
        }

        String seatLabel() {
            return switch (language) {
                case EN_GB ->
                    "Seat";
                case AR_SA ->
                    "المقعد";
                case FR_FR ->
                    "Siège";
            };
        }

        String passengersLabel() {
            return switch (language) {
                case EN_GB ->
                    "Passengers";
                case AR_SA ->
                    "المسافرون";
                case FR_FR ->
                    "Passagers";
            };
        }

        String passengersWord() {
            return switch (language) {
                case EN_GB ->
                    "passengers";
                case AR_SA ->
                    "مسافرين";
                case FR_FR ->
                    "passagers";
            };
        }

        String freeSeatingLabel() {
            return switch (language) {
                case EN_GB ->
                    "Free seating";
                case AR_SA ->
                    "مقعد حر";
                case FR_FR ->
                    "Libre";
            };
        }

        String individualTicketsHeading() {
            return switch (language) {
                case EN_GB ->
                    "Passenger tickets";
                case AR_SA ->
                    "تذاكر المسافرين";
                case FR_FR ->
                    "Billets des passagers";
            };
        }

        String individualTicketsIntroText() {
            return switch (language) {
                case EN_GB ->
                    "Each passenger ticket below has its own reference and QR code for inspection.";
                case AR_SA ->
                    "كل تذكرة مسافر أدناه تحتوي على مرجع خاص بها ورمز QR خاص بالتفقد.";
                case FR_FR ->
                    "Chaque billet passager ci-dessous possède sa propre référence et son propre QR code pour le contrôle.";
            };
        }

        String passengerTicketLabel(int index) {
            return switch (language) {
                case EN_GB ->
                    "Passenger ticket " + index;
                case AR_SA ->
                    "تذكرة المسافر " + index;
                case FR_FR ->
                    "Billet passager " + index;
            };
        }

        String orderQrHintText() {
            return switch (language) {
                case EN_GB ->
                    "This QR code references the full group booking. Individual passenger tickets are listed below.";
                case AR_SA ->
                    "يشير رمز QR هذا إلى الحجز الجماعي بالكامل. تذاكر المسافرين الفردية مدرجة أدناه.";
                case FR_FR ->
                    "Ce QR code correspond à la réservation groupe complète. Les billets individuels des passagers sont listés ci-dessous.";
            };
        }

        String orderQrAltText() {
            return switch (language) {
                case EN_GB ->
                    "Group booking QR code";
                case AR_SA ->
                    "رمز QR للحجز الجماعي";
                case FR_FR ->
                    "QR code de la réservation groupe";
            };
        }
    }
}
