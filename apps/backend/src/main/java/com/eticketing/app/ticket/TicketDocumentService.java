package com.eticketing.app.ticket;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.eticketing.app.company.CompanyRepository;
import com.eticketing.app.company.CompanyType;
import com.eticketing.app.place.PlaceType;
import com.eticketing.app.place.PlaceRepository;
import com.eticketing.app.pos.PointOfSaleType;
import com.eticketing.app.pos.PointOfSaleRepository;
import com.eticketing.app.trip.SegmentType;
import com.eticketing.app.trip.StopType;
import com.eticketing.app.trip.TripType;
import com.eticketing.app.trip.TripTypeRepository;
import com.eticketing.app.user.UserType;
import com.eticketing.app.user.UserTypeRepository;

@Service
public class TicketDocumentService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd MMM uuuu", Locale.FRENCH);
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm", Locale.FRENCH);

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

        String passengerName = user != null
                ? String.format("%s %s", defaultString(user.getFirstName()), defaultString(user.getLastName())).trim()
                : "Client";
        if (passengerName.isBlank()) passengerName = "Client";
        String passengerEmail = user != null ? user.getEmail() : null;

        String agencyName = pos != null ? pos.getTitle() : "Agence";
        String agencyEmail = pos != null ? defaultString(pos.getEmail()) : "";
        String agencyPhone = pos != null && pos.getPhone() != null
                ? String.format("+%s %s", defaultString(pos.getPhone().getCountryCode()), defaultString(pos.getPhone().getNumber()))
                : "";
        String routeLabel = String.format("%s > %s",
                origin != null ? origin.getCity() : defaultString(originId),
                destination != null ? destination.getCity() : defaultString(destinationId));

        String totalAmount = ticket.getAppliedPrice() != null ? ticket.getAppliedPrice().toPlainString() : "-";
        String reference = ticket.getId();
        int segmentCount = ticket.getSegmentIds() != null ? ticket.getSegmentIds().size() : 0;
        String qrCodeDataUri = qrCodeService.generateDataUri(reference);
        String qrCodeUrl = qrCodeService.generatePublicUrl(reference);
        String template = company != null && company.getEmailTemplate() != null
                ? company.getEmailTemplate()
                : TicketTemplateDefaults.defaultTemplate();

        Map<String, Object> context = new HashMap<>();
        context.put("reference", reference);
        context.put("bookingReference", reference);
        context.put("passengerName", passengerName);
        context.put("passengerEmail", passengerEmail != null ? passengerEmail : "");
        context.put("seats", segmentCount + " segment(s)");
        context.put("seatCount", segmentCount);
        context.put("tripRoute", routeLabel);
        ZoneId tripZone = trip.getTimezone() != null ? ZoneId.of(trip.getTimezone()) : ZoneOffset.UTC;
        context.put("tripDate", trip.getDepartureDate() != null ? DATE_FORMAT.format(trip.getDepartureDate().atZone(tripZone)) : "");
        context.put("tripTime", trip.getDepartureDate() != null ? TIME_FORMAT.format(trip.getDepartureDate().atZone(tripZone)) : "");
        context.put("currency", ticket.getCurrency());
        context.put("totalAmount", totalAmount);
        context.put("status", translateStatus(ticket.getStatus()));
        context.put("agencyName", agencyName);
        context.put("agencyEmail", agencyEmail);
        context.put("agencyPhone", agencyPhone);
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
        view.setSubject(String.format("Votre billet %s", reference));
        view.setMetadata(buildMetadata(ticket, trip, passengerName, passengerEmail, agencyName, routeLabel, reference));
        return view;
    }

    private String resolveOriginPlaceId(TripType trip, TicketType ticket) {
        if (ticket.getSegmentIds() == null || ticket.getSegmentIds().isEmpty()) {
            List<StopType> stops = trip.getStopSchedule();
            return stops != null && !stops.isEmpty() ? stops.get(0).getPlaceId() : null;
        }
        String firstSegId = ticket.getSegmentIds().get(0);
        return trip.getSegments().stream()
                .filter(s -> s.getSegmentId().equals(firstSegId))
                .map(SegmentType::getFromPlaceId)
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
                .map(SegmentType::getToPlaceId)
                .findFirst()
                .orElse(null);
    }

    private Map<String, Object> buildMetadata(TicketType ticket,
            TripType trip,
            String passengerName,
            String passengerEmail,
            String agencyName,
            String routeLabel,
            String reference) {
        Map<String, Object> ticketMeta = new HashMap<>();
        ticketMeta.put("id", ticket.getId());
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

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("ticket", ticketMeta);
        metadata.put("passenger", passengerMeta);
        metadata.put("trip", tripMeta);
        metadata.put("agency", agencyMeta);
        return metadata;
    }

    private String defaultString(String value) {
        return value != null ? value : "";
    }

    private String translateStatus(TicketStatusEnum status) {
        if (status == null) {
            return "Inconnu";
        }
        return switch (status) {
            case PENDING -> "En attente";
            case CONFIRMED -> "Confirme";
            case CANCELLED -> "Annule";
            case EXPIRED -> "Expire";
        };
    }
}
