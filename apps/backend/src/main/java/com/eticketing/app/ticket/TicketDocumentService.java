package com.eticketing.app.ticket;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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

        String passengerName = user != null
                ? String.format("%s %s", defaultString(user.getFirstName()), defaultString(user.getLastName())).trim()
                : localized.defaultPassengerName();
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
        String companyLogoUrl = resolvePictureUrl(company != null ? company.getPicture() : null);
        String companyLogoStyle = companyLogoUrl.isBlank() ? "display:none;" : "";
        String salesChannel = pos != null ? pos.getTitle() : localized.defaultSalesChannel();
        String routeLabel = String.format("%s > %s",
                origin != null ? origin.getCity() : defaultString(originId),
                destination != null ? destination.getCity() : defaultString(destinationId));
        String pickupSummary = resolvePickupSummary(trip, ticket, origin, localized.notProvided());
        String dropoffSummary = resolveDropoffSummary(trip, ticket, destination, localized.notProvided());

        String totalAmount = ticket.getAppliedPrice() != null ? ticket.getAppliedPrice().toPlainString() : "-";
        String reference = ticket.getId();
        int segmentCount = ticket.getSegmentIds() != null ? ticket.getSegmentIds().size() : 0;
        String qrCodeDataUri = qrCodeService.generateDataUri(reference);
        String qrCodeUrl = qrCodeService.generatePublicUrl(reference);
        String template = company != null && company.getEmailTemplate() != null && !company.getEmailTemplate().isBlank()
                ? company.getEmailTemplate()
                : TicketTemplateDefaults.defaultTemplate();
        ZoneId tripZone = trip.getTimezone() != null ? ZoneId.of(trip.getTimezone()) : ZoneOffset.UTC;
        String tripDate = formatTripDate(trip.getDepartureDate(), tripZone, language);
        String tripTime = formatTripTime(trip.getDepartureDate(), tripZone, language);
        String localizedStatus = translateStatus(ticket.getStatus(), language);

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
        context.put("introText", localized.introText());
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
        context.put("footerText", localized.footerText(reference, companyName, supportLine));
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
        context.put("qrCodeUrl", qrCodeUrl);
        context.put("qrCode", qrCodeUrl);

        String html = templateEngine.render(template, context);

        TicketDocumentView view = new TicketDocumentView();
        view.setTicketId(ticket.getId());
        view.setReference(reference);
        view.setQrCodeUrl(qrCodeUrl);
        view.setQrCodeDataUri(qrCodeDataUri);
        view.setHtmlContent(html);
        view.setRenderedAt(Instant.now());
        view.setPassengerEmail(passengerEmail);
        view.setSubject(localized.subject(companyName, reference));
        view.setMetadata(buildMetadata(ticket, trip, company, passengerName, passengerEmail, agencyName, routeLabel, reference, companyLogoUrl));
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
        String companyLogoUrl = resolvePictureUrl(company != null ? company.getPicture() : null);
        String companyLogoStyle = companyLogoUrl.isBlank() ? "display:none;" : "";
        String salesChannel = pos != null ? pos.getTitle() : localized.defaultSalesChannel();
        String routeLabel = String.format("%s > %s",
                origin != null ? origin.getCity() : defaultString(originId),
                destination != null ? destination.getCity() : defaultString(destinationId));
        String pickupSummary = resolvePickupSummary(trip, firstTicket, origin, localized.notProvided());
        String dropoffSummary = resolveDropoffSummary(trip, firstTicket, destination, localized.notProvided());

        String reference = order.getId();
        String totalAmount = order.getTotalPrice() != null ? order.getTotalPrice().toPlainString() : "-";
        int passengerCount = !ticketEntries.isEmpty() ? ticketEntries.size() : tickets.size();
        String qrCodeDataUri = qrCodeService.generateDataUri(reference);
        String qrCodeUrl = qrCodeService.generatePublicUrl(reference);
        ZoneId tripZone = trip.getTimezone() != null ? ZoneId.of(trip.getTimezone()) : ZoneOffset.UTC;
        String tripDate = formatTripDate(trip.getDepartureDate(), tripZone, language);
        String tripTime = formatTripTime(trip.getDepartureDate(), tripZone, language);
        String localizedStatus = translateOrderStatus(order.getStatus(), language);

        // Build passenger manifest HTML table
        String passengerTableHtml = buildPassengerManifestHtml(ticketEntries, language);
        String individualTicketCardsHtml = buildIndividualTicketCardsHtml(ticketEntries, language);

        String template = company != null && company.getEmailTemplate() != null && !company.getEmailTemplate().isBlank()
                ? company.getEmailTemplate()
                : TicketTemplateDefaults.defaultTemplate();

        String orderIntroText = localized.orderIntroText(passengerCount) + passengerTableHtml + individualTicketCardsHtml;

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
        context.put("ticketQrAltText", localized.orderQrAltText());
        context.put("qrHintText", localized.orderQrHintText());
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
        context.put("qrCodeUrl", qrCodeUrl);
        context.put("qrCode", qrCodeUrl);

        String html = templateEngine.render(template, context);

        TicketDocumentView view = new TicketDocumentView();
        view.setTicketId(order.getId());
        view.setReference(reference);
        view.setQrCodeUrl(qrCodeUrl);
        view.setQrCodeDataUri(qrCodeDataUri);
        view.setHtmlContent(html);
        view.setRenderedAt(Instant.now());
        view.setPassengerEmail(contactEmail);
        view.setSubject(localized.orderSubject(companyName, reference));
        return view;
    }

    private String buildPassengerManifestHtml(List<OrderTicketEntry> ticketEntries, TicketLanguage language) {
        if (ticketEntries == null || ticketEntries.isEmpty()) {
            return "";
        }

        LocalizedEmailContent localized = LocalizedEmailContent.forLanguage(language);
        StringBuilder sb = new StringBuilder();
        sb.append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-top:16px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;\">");
        sb.append("<tr style=\"background:#f1f5f9;\"><td style=\"padding:8px 12px;font-size:13px;font-weight:700;color:#0f172a;\">#</td>");
        sb.append("<td style=\"padding:8px 12px;font-size:13px;font-weight:700;color:#0f172a;\">").append(localized.passengerLabel()).append("</td>");
        sb.append("<td style=\"padding:8px 12px;font-size:13px;font-weight:700;color:#0f172a;\">").append(localized.seatLabel()).append("</td>");
        sb.append("<td style=\"padding:8px 12px;font-size:13px;font-weight:700;color:#0f172a;text-align:right;\">").append(localized.amountLabel()).append("</td></tr>");

        for (int i = 0; i < ticketEntries.size(); i++) {
            OrderTicketEntry entry = ticketEntries.get(i);
            String name = resolvePassengerName(entry.passenger(), entry.ticket());
            String seat = resolveSeatLabel(entry.passenger(), entry.ticket(), localized);
            String price = formatTicketAmount(entry.ticket());
            String bgColor = i % 2 == 0 ? "#ffffff" : "#f8fafc";
            sb.append("<tr style=\"background:").append(bgColor).append(";\">");
            sb.append("<td style=\"padding:8px 12px;font-size:14px;color:#334155;\">").append(i + 1).append("</td>");
            sb.append("<td style=\"padding:8px 12px;font-size:14px;color:#334155;\">").append(escapeHtml(name)).append("</td>");
            sb.append("<td style=\"padding:8px 12px;font-size:14px;color:#334155;\">").append(escapeHtml(seat)).append("</td>");
            sb.append("<td style=\"padding:8px 12px;font-size:14px;color:#334155;text-align:right;\">").append(escapeHtml(price)).append("</td>");
            sb.append("</tr>");
        }
        sb.append("</table>");
        return sb.toString();
    }

    private String buildIndividualTicketCardsHtml(List<OrderTicketEntry> ticketEntries, TicketLanguage language) {
        if (ticketEntries == null || ticketEntries.isEmpty()) {
            return "";
        }

        LocalizedEmailContent localized = LocalizedEmailContent.forLanguage(language);
        StringBuilder sb = new StringBuilder();
        sb.append("<div style=\"margin-top:24px;\">");
        sb.append("<p style=\"margin:0 0 8px 0;font-size:18px;line-height:1.4;font-weight:700;color:#0f172a;\">")
                .append(localized.individualTicketsHeading())
                .append("</p>");
        sb.append("<p style=\"margin:0 0 16px 0;font-size:14px;line-height:1.55;color:#475569;\">")
                .append(localized.individualTicketsIntroText())
                .append("</p>");

        for (int i = 0; i < ticketEntries.size(); i++) {
            OrderTicketEntry entry = ticketEntries.get(i);
            TicketType ticket = entry.ticket();
            if (ticket == null) {
                continue;
            }

            String ticketReference = escapeHtml(firstNonBlank(ticket.getId(), ticket.getIdempotencyKey(), "-"));
            String passengerName = escapeHtml(resolvePassengerName(entry.passenger(), ticket));
            String seat = escapeHtml(resolveSeatLabel(entry.passenger(), ticket, localized));
            String amount = escapeHtml(formatTicketAmount(ticket));
            String ticketStatus = escapeHtml(translateStatus(ticket.getStatus(), language));
            String qrCodeUrl = escapeHtml(qrCodeService.generatePublicUrl(ticket.getId()));

            sb.append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-top:16px;border:1px solid #e2e8f0;border-radius:16px;background:#ffffff;overflow:hidden;\">");
            sb.append("<tr><td style=\"padding:16px 18px;background:#f8fafc;border-bottom:1px solid #e2e8f0;\">");
            sb.append("<div style=\"font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;\">")
                    .append(localized.passengerTicketLabel(i + 1))
                    .append("</div>");
            sb.append("<div style=\"margin-top:6px;font-size:16px;font-weight:700;color:#0f172a;word-break:break-word;\">")
                    .append(ticketReference)
                    .append("</div>");
            sb.append("</td></tr>");
            sb.append("<tr><td style=\"padding:18px 18px 20px 18px;\">");
            sb.append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" class=\"stack\"><tr>");
            sb.append("<td valign=\"top\" style=\"padding-right:12px;\">");
            appendTicketField(sb, localized.passengerLabel(), passengerName);
            appendTicketField(sb, localized.seatLabel(), seat);
            appendTicketField(sb, localized.amountLabel(), amount);
            appendTicketField(sb, localized.statusLabel(), ticketStatus);
            sb.append("</td>");
            sb.append("<td class=\"stack-gap\" style=\"width:12px;\">&nbsp;</td>");
            sb.append("<td valign=\"top\" width=\"168\" style=\"width:168px;\">");
            sb.append("<div style=\"padding:12px;border:1px solid #e2e8f0;border-radius:14px;background:#ffffff;text-align:center;\">");
            sb.append("<img src=\"").append(qrCodeUrl).append("\" alt=\"").append(escapeHtml(localized.ticketQrAltText()))
                    .append("\" width=\"132\" height=\"132\" style=\"width:132px;max-width:100%;height:auto;margin:0 auto;\">");
            sb.append("</div>");
            sb.append("<div style=\"margin-top:8px;font-size:12px;line-height:1.5;color:#64748b;text-align:center;\">")
                    .append(localized.qrHintText())
                    .append("</div>");
            sb.append("</td>");
            sb.append("</tr></table>");
            sb.append("</td></tr></table>");
        }

        sb.append("</div>");
        return sb.toString();
    }

    private void appendTicketField(StringBuilder sb, String label, String value) {
        sb.append("<div style=\"margin-bottom:14px;\">");
        sb.append("<div style=\"font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;\">")
                .append(escapeHtml(label))
                .append("</div>");
        sb.append("<div style=\"margin-top:4px;font-size:15px;font-weight:700;color:#0f172a;\">")
                .append(value)
                .append("</div>");
        sb.append("</div>");
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

    private String resolvePickupSummary(TripType trip, TicketType ticket, PlaceType fallbackPlace, String fallbackValue) {
        if (trip.getPickupPoints() != null && ticket.getPickupPointId() != null) {
            for (var pickup : trip.getPickupPoints()) {
                if (ticket.getPickupPointId().equals(pickup.getPointId())) {
                    PlaceType place = pickup.getPlaceId() != null ? placeRepository.findById(pickup.getPlaceId()).orElse(null) : null;
                    return formatPointSummary(place != null ? place.getCity() : null, pickup.getAddress(), fallbackPlace != null ? fallbackPlace.getCity() : null, fallbackValue);
                }
            }
        }
        return formatPointSummary(fallbackPlace != null ? fallbackPlace.getCity() : null, null, ticket.getPickupPointId(), fallbackValue);
    }

    private String resolveDropoffSummary(TripType trip, TicketType ticket, PlaceType fallbackPlace, String fallbackValue) {
        if (trip.getDropoffPoints() != null && ticket.getDropoffPointId() != null) {
            for (var dropoff : trip.getDropoffPoints()) {
                if (ticket.getDropoffPointId().equals(dropoff.getPointId())) {
                    PlaceType place = dropoff.getPlaceId() != null ? placeRepository.findById(dropoff.getPlaceId()).orElse(null) : null;
                    return formatPointSummary(place != null ? place.getCity() : null, dropoff.getAddress(), fallbackPlace != null ? fallbackPlace.getCity() : null, fallbackValue);
                }
            }
        }
        return formatPointSummary(fallbackPlace != null ? fallbackPlace.getCity() : null, null, ticket.getDropoffPointId(), fallbackValue);
    }

    private String formatPointSummary(String city, String address, String fallback, String emptyValue) {
        String primary = firstNonBlank(city, fallback, emptyValue);
        String secondary = defaultString(address);
        return secondary.isBlank() ? primary : primary + " - " + secondary;
    }

    private String resolveOriginPlaceId(TripType trip, TicketType ticket) {
        if (ticket.getSegmentIds() == null || ticket.getSegmentIds().isEmpty()) {
            List<StopType> stops = trip.getStopSchedule();
            return stops != null && !stops.isEmpty() ? stops.get(0).getPlaceId() : null;
        }
        String firstSegId = ticket.getSegmentIds().get(0);
        return trip.getSegments().stream()
                .filter(s -> s.getSegmentId().equals(firstSegId))
                .map(SegmentType::getFromPlace)
                .map(TripPlaceRef::idOf)
                .findFirst()
                .orElse(null);
    }

    private String resolveDestinationPlaceId(TripType trip, TicketType ticket) {
        if (ticket.getSegmentIds() == null || ticket.getSegmentIds().isEmpty()) {
            List<StopType> stops = trip.getStopSchedule();
            return stops != null && !stops.isEmpty() ? stops.get(stops.size() - 1).getPlaceId() : null;
        }
        String lastSegId = ticket.getSegmentIds().get(ticket.getSegmentIds().size() - 1);
        return trip.getSegments().stream()
                .filter(s -> s.getSegmentId().equals(lastSegId))
                .map(SegmentType::getToPlace)
                .map(TripPlaceRef::idOf)
                .findFirst()
                .orElse(null);
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
        ticketMeta.put("status", ticket.getStatus().name());
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
                ? trip.getDepartureDate().atZone(trip.getTimezone() != null ? ZoneId.of(trip.getTimezone()) : ZoneOffset.UTC).toLocalTime()
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
