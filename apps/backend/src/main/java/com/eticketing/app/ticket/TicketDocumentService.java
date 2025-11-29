package com.eticketing.app.ticket;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.eticketing.app.agency.AgencyRepository;
import com.eticketing.app.agency.AgencyType;
import com.eticketing.app.place.PlaceDocument;
import com.eticketing.app.place.PlaceRepository;
import com.eticketing.app.ticket.TicketType.SeatAssignment;
import com.eticketing.app.ticket.TicketType.TicketUserSnapshot;
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
    private final AgencyRepository agencyRepository;
    private final PlaceRepository placeRepository;
    private final TicketTemplateEngine templateEngine;
    private final TicketQrCodeService qrCodeService;

    public TicketDocumentService(TripTypeRepository tripRepository,
            UserTypeRepository userRepository,
            AgencyRepository agencyRepository,
            PlaceRepository placeRepository,
            TicketTemplateEngine templateEngine,
            TicketQrCodeService qrCodeService) {
        this.tripRepository = tripRepository;
        this.userRepository = userRepository;
        this.agencyRepository = agencyRepository;
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
        UserType user = userRepository.findById(ticket.getUserId()).orElse(null);
        TicketUserSnapshot snapshot = ticket.getUser();
        AgencyType agency = trip.getAgencyId() != null ? agencyRepository.findById(trip.getAgencyId()).orElse(null) : null;
        PlaceDocument origin = trip.getOriginId() != null ? placeRepository.findById(trip.getOriginId()).orElse(null) : null;
        PlaceDocument destination = trip.getDestinationId() != null ? placeRepository.findById(trip.getDestinationId()).orElse(null) : null;

        String passengerFirstName = user != null ? user.getFirstName() : snapshot != null ? snapshot.getFirstName() : null;
        String passengerLastName = user != null ? user.getLastName() : snapshot != null ? snapshot.getLastName() : null;
        String passengerName = String.format("%s %s",
                defaultString(passengerFirstName),
                defaultString(passengerLastName)).trim();
        if (passengerName.isBlank()) {
            passengerName = "Client";
        }
        String passengerEmail = user != null ? user.getEmail() : snapshot != null ? snapshot.getEmail() : null;
        String agencyName = agency != null ? agency.getName() : "Agence";
        String agencyEmail = agency != null ? defaultString(agency.getEmail()) : "";
        String agencyPhone = agency != null && agency.getPhone() != null
                ? String.format("+%s %s", defaultString(agency.getPhone().getCountryCode()), defaultString(agency.getPhone().getNumber()))
                : "";
        String routeLabel = String.format("%s → %s",
                origin != null ? origin.getCity() : defaultString(trip.getOriginId()),
                destination != null ? destination.getCity() : defaultString(trip.getDestinationId()));
        String seatList = ticket.getSeats() == null || ticket.getSeats().isEmpty()
                ? "Non assigné"
                : ticket.getSeats().stream()
                        .map(this::formatSeat)
                        .collect(Collectors.joining(", "));
        String totalAmount = ticket.getTotalAmount() != null ? ticket.getTotalAmount().toPlainString() : "-";
        String reference = ticket.getReference();
        String qrCodeDataUri = qrCodeService.generateDataUri(reference);
        String qrCodeUrl = qrCodeService.generatePublicUrl(reference);
        String template = agency != null && agency.getTemplate() != null ? agency.getTemplate() : TicketTemplateDefaults.defaultTemplate();

        Map<String, Object> context = new HashMap<>();
        context.put("reference", reference);
        context.put("bookingReference", reference);
        context.put("passengerName", passengerName);
        context.put("passengerEmail", passengerEmail != null ? passengerEmail : "");
        context.put("seats", seatList);
        context.put("seatCount", ticket.getSeats().size());
        context.put("tripRoute", routeLabel);
        context.put("tripDate", trip.getDepartureDate() != null ? DATE_FORMAT.format(trip.getDepartureDate()) : "");
        context.put("tripTime", trip.getDepartureDateTime() != null ? TIME_FORMAT.format(trip.getDepartureDateTime()) : "");
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
        ticketMeta.put("totalAmount", ticket.getTotalAmount());
        ticketMeta.put("currency", ticket.getCurrency());

        Map<String, Object> passengerMeta = new HashMap<>();
        passengerMeta.put("name", passengerName);
        passengerMeta.put("email", passengerEmail);

        Map<String, Object> tripMeta = new HashMap<>();
        tripMeta.put("id", trip.getId());
        tripMeta.put("route", routeLabel);
        tripMeta.put("date", trip.getDepartureDate());
        tripMeta.put("time", trip.getDepartureDateTime());

        Map<String, Object> agencyMeta = new HashMap<>();
        agencyMeta.put("id", trip.getAgencyId());
        agencyMeta.put("name", agencyName);

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("ticket", ticketMeta);
        metadata.put("passenger", passengerMeta);
        metadata.put("trip", tripMeta);
        metadata.put("agency", agencyMeta);
        return metadata;
    }

    private String formatSeat(SeatAssignment seat) {
        if (seat == null) {
            return "-";
        }
        if (seat.getLabel() != null && !seat.getLabel().isBlank()) {
            return seat.getLabel();
        }
        return String.format("%s-%s", seat.getRow(), seat.getCol());
    }

    private String defaultString(String value) {
        return value != null ? value : "";
    }

    private String translateStatus(TicketType.TicketStatusEnum status) {
        if (status == null) {
            return "Inconnu";
        }
        return switch (status) {
            case BOOKED ->
                "Réservé";
            case PAID ->
                "Payé";
            case CANCELLED ->
                "Annulé";
            case EXPIRED ->
                "Expiré";
        };
    }
}
