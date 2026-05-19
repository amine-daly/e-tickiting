package com.eticketing.app.ticket;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.eticketing.app.common.TargetInput;
import com.eticketing.app.company.CompanyRepository;
import com.eticketing.app.company.CompanyType;
import com.eticketing.app.place.PlaceRepository;
import com.eticketing.app.place.PlaceType;
import com.eticketing.app.pos.PointOfSaleRepository;
import com.eticketing.app.trip.DropoffPointType;
import com.eticketing.app.trip.PickupPointType;
import com.eticketing.app.trip.SegmentType;
import com.eticketing.app.trip.StopType;
import com.eticketing.app.trip.TripPlaceRef;
import com.eticketing.app.trip.TripStatusEnum;
import com.eticketing.app.trip.TripType;
import com.eticketing.app.trip.TripTypeRepository;
import com.eticketing.app.user.UserType;
import com.eticketing.app.user.UserTypeRepository;

@ExtendWith(MockitoExtension.class)
class TicketDocumentServiceTest {

    @Mock
    private TripTypeRepository tripRepository;

    @Mock
    private UserTypeRepository userRepository;

    @Mock
    private PointOfSaleRepository posRepository;

    @Mock
    private CompanyRepository companyRepository;

    @Mock
    private PlaceRepository placeRepository;

    @Mock
    private TicketQrCodeService qrCodeService;

    private TicketDocumentService ticketDocumentService;

    @BeforeEach
    void setUp() {
        ticketDocumentService = new TicketDocumentService(
                tripRepository,
                userRepository,
                posRepository,
                companyRepository,
                placeRepository,
                new TicketTemplateEngine(),
                qrCodeService);
    }

    @Test
    void buildOrderDocumentIncludesIndividualPassengerTicketsInManifestOrder() {
        TripType trip = TripType.builder()
                .id("trip-1")
                .target(new TargetInput("company-1", null))
                .departureDate(Instant.parse("2026-04-15T11:00:00Z"))
                .timezone("Africa/Tunis")
                .status(TripStatusEnum.ACTIVE)
                .segments(List.of(segment("seg-1", "djerba", "sfax")))
                .build();

        UserType contactUser = new UserType();
        contactUser.setId("contact-1");
        contactUser.setFirstName("Amine");
        contactUser.setLastName("Daly1");
        contactUser.setEmail("amine@example.com");

        CompanyType company = CompanyType.builder()
                .id("company-1")
                .name("ComfortGo")
                .build();

        PlaceType origin = new PlaceType();
        origin.setId("djerba");
        origin.setCity("Djerba");

        PlaceType destination = new PlaceType();
        destination.setId("sfax");
        destination.setCity("Sfax");

        OrderType order = OrderType.builder()
                .id("order-1")
                .tripId("trip-1")
                .target(new TargetInput("company-1", null))
                .contactCustomerId("contact-1")
                .currency("TND")
                .totalPrice(new BigDecimal("45"))
                .status(OrderStatusEnum.CONFIRMED)
                .passengers(List.of(
                        OrderType.OrderPassenger.builder()
                                .ticketId("ticket-1")
                                .firstName("Amine")
                                .lastName("Daly1")
                                .seatNo("A5")
                                .build(),
                        OrderType.OrderPassenger.builder()
                                .ticketId("ticket-2")
                                .firstName("Nidhal")
                                .lastName("Sed")
                                .seatNo("B10")
                                .build()))
                .build();

        TicketType ticketOne = TicketType.builder()
                .id("ticket-1")
                .reference("TKREF001A")
                .tripId("trip-1")
                .segmentIds(List.of("seg-1"))
                .appliedPrice(new BigDecimal("20"))
                .currency("TND")
                .lang("en-gb")
                .status(TicketStatusEnum.CONFIRMED)
                .build();

        TicketType ticketTwo = TicketType.builder()
                .id("ticket-2")
                .reference("TKREF002B")
                .tripId("trip-1")
                .segmentIds(List.of("seg-1"))
                .appliedPrice(new BigDecimal("25"))
                .currency("TND")
                .lang("en-gb")
                .status(TicketStatusEnum.CONFIRMED)
                .build();

        when(tripRepository.findById("trip-1")).thenReturn(Optional.of(trip));
        when(userRepository.findById("contact-1")).thenReturn(Optional.of(contactUser));
        when(companyRepository.findById("company-1")).thenReturn(Optional.of(company));
        when(placeRepository.findById("djerba")).thenReturn(Optional.of(origin));
        when(placeRepository.findById("sfax")).thenReturn(Optional.of(destination));
        when(qrCodeService.generatePublicUrl(anyString()))
                .thenAnswer(invocation -> "https://qr.example/" + invocation.getArgument(0, String.class));
        when(qrCodeService.generateDataUri(anyString()))
                .thenAnswer(invocation -> "data:" + invocation.getArgument(0, String.class));

        TicketDocumentView document = ticketDocumentService.buildOrderDocument(order, List.of(ticketTwo, ticketOne));

        String printHtml = document.getPrintHtmlContent();
        String emailHtml = document.getEmailHtmlContent();
        assertEquals("amine@example.com", document.getPassengerEmail());
        assertEquals("TKREF002B", document.getReference());
        assertEquals(printHtml, document.getHtmlContent());
        assertTrue(printHtml.contains("Passenger ticket 1"));
        assertTrue(printHtml.contains("Passenger ticket 2"));
        assertTrue(printHtml.contains("TKREF001A"));
        assertTrue(printHtml.contains("TKREF002B"));
        assertEquals(2, printHtml.split("class=\"pdf-page\"", -1).length - 1);
        assertTrue(printHtml.contains("data:TKREF001A"));
        assertTrue(printHtml.contains("data:TKREF002B"));
        assertFalse(printHtml.contains("ticket-1"));
        assertFalse(printHtml.contains("ticket-2"));
        assertTrue(printHtml.contains("Amine Daly1"));
        assertTrue(printHtml.contains("Nidhal Sed"));
        assertTrue(printHtml.contains("A5"));
        assertTrue(printHtml.contains("B10"));
        assertFalse(printHtml.contains("Sales channel"));
        assertFalse(printHtml.contains("This QR code references the full group booking. Individual passenger tickets are listed below."));
        assertFalse(printHtml.contains("<table"));
        assertEquals(2, printHtml.split("data:TKREF", -1).length - 1);
        assertTrue(printHtml.indexOf("Amine Daly1") < printHtml.indexOf("Nidhal Sed"));
        assertTrue(emailHtml.contains("Passenger tickets"));
        assertTrue(emailHtml.contains("Passenger ticket 1"));
        assertTrue(emailHtml.contains("Passenger ticket 2"));
        assertTrue(emailHtml.contains("<table"));
        assertFalse(emailHtml.contains("Sales channel"));
        assertTrue(emailHtml.contains("https://qr.example/TKREF001A"));
        assertTrue(emailHtml.contains("https://qr.example/TKREF002B"));
        assertTrue(printHtml.contains("Powered by"));
        assertTrue(printHtml.contains("Safra"));
        assertTrue(emailHtml.contains("Powered by"));
        assertTrue(emailHtml.contains("Safra"));
    }

    @Test
    void buildDocumentHandlesMissingSegmentsAndInvalidTimezone() {
        TripType trip = TripType.builder()
                .id("trip-1")
                .departureDate(Instant.parse("2026-04-15T11:00:00Z"))
                .timezone("Invalid/Zone")
                .segments(null)
                .stopSchedule(null)
                .build();

        TicketType ticket = TicketType.builder()
                .id("ticket-1")
                .reference("TKREF003C")
                .tripId("trip-1")
                .segmentIds(List.of("seg-1"))
                .appliedPrice(new BigDecimal("20"))
                .currency("TND")
                .lang("en-gb")
                .status(TicketStatusEnum.CONFIRMED)
                .build();

        when(tripRepository.findById("trip-1")).thenReturn(Optional.of(trip));
        when(qrCodeService.generatePublicUrl(anyString()))
                .thenAnswer(invocation -> "https://qr.example/" + invocation.getArgument(0, String.class));
        when(qrCodeService.generateDataUri(anyString()))
                .thenAnswer(invocation -> "data:" + invocation.getArgument(0, String.class));

        TicketDocumentView document = ticketDocumentService.buildDocument(ticket);

        assertEquals("TKREF003C", document.getReference());
        assertTrue(document.getHtmlContent().contains(document.getReference()));
        assertTrue(document.getHtmlContent().contains("data:" + document.getReference()));
        assertTrue(document.getEmailHtmlContent().contains("<table"));
        assertTrue(document.getEmailHtmlContent().contains("https://qr.example/TKREF003C"));
        assertFalse(document.getHtmlContent().contains("Sales channel"));
        assertFalse(document.getEmailHtmlContent().contains("Sales channel"));
    }

    @Test
    void buildDocumentHandlesNullTicketStatus() {
        TripType trip = TripType.builder()
                .id("trip-1")
                .departureDate(Instant.parse("2026-04-15T11:00:00Z"))
                .timezone("Africa/Tunis")
                .segments(List.of(segment("seg-1", "djerba", "sfax")))
                .build();

        TicketType ticket = TicketType.builder()
                .id("ticket-1")
                .reference("TKREF004D")
                .tripId("trip-1")
                .segmentIds(List.of("seg-1"))
                .appliedPrice(new BigDecimal("20"))
                .currency("TND")
                .lang("en-gb")
                .status(null)
                .build();

        when(tripRepository.findById("trip-1")).thenReturn(Optional.of(trip));
        when(placeRepository.findById("djerba")).thenReturn(Optional.empty());
        when(placeRepository.findById("sfax")).thenReturn(Optional.empty());
        when(qrCodeService.generatePublicUrl(anyString()))
                .thenAnswer(invocation -> "https://qr.example/" + invocation.getArgument(0, String.class));
        when(qrCodeService.generateDataUri(anyString()))
                .thenAnswer(invocation -> "data:" + invocation.getArgument(0, String.class));

        TicketDocumentView document = ticketDocumentService.buildDocument(ticket);

        assertEquals("ticket-1", document.getTicketId());
        assertEquals("TKREF004D", document.getReference());
        assertTrue(document.getHtmlContent().contains(document.getReference()));
        assertTrue(document.getHtmlContent().contains("data:" + document.getReference()));
        assertTrue(document.getMetadata().containsKey("ticket"));
        assertFalse(document.getHtmlContent().contains("Sales channel"));
        assertFalse(document.getEmailHtmlContent().contains("Sales channel"));
        @SuppressWarnings("unchecked")
        java.util.Map<String, Object> ticketMetadata = (java.util.Map<String, Object>) document.getMetadata().get("ticket");
        assertEquals(null, ticketMetadata.get("status"));
    }

    @Test
    void buildDocumentUsesGuestPassengerNameWhenNoRegisteredUserExists() {
        TripType trip = TripType.builder()
                .id("trip-1")
                .departureDate(Instant.parse("2026-04-15T11:00:00Z"))
                .timezone("Africa/Tunis")
                .segments(List.of(segment("seg-1", "djerba", "sfax")))
                .build();

        TicketType ticket = TicketType.builder()
                .id("ticket-guest-1")
                .reference("TKREFGUEST1")
                .tripId("trip-1")
                .segmentIds(List.of("seg-1"))
                .guestFirstName("Nidhal")
                .guestLastName("Sed")
                .appliedPrice(new BigDecimal("20"))
                .currency("TND")
                .lang("en-gb")
                .status(TicketStatusEnum.CONFIRMED)
                .build();

        when(tripRepository.findById("trip-1")).thenReturn(Optional.of(trip));
        when(qrCodeService.generatePublicUrl(anyString()))
                .thenAnswer(invocation -> "https://qr.example/" + invocation.getArgument(0, String.class));
        when(qrCodeService.generateDataUri(anyString()))
                .thenAnswer(invocation -> "data:" + invocation.getArgument(0, String.class));

        TicketDocumentView document = ticketDocumentService.buildDocument(ticket);

        assertTrue(document.getPrintHtmlContent().contains("Nidhal Sed"));
        assertFalse(document.getPrintHtmlContent().contains("Client"));
    }

    @Test
    void buildDocumentHandlesEmptyEmbeddedSegmentPlaceRefs() {
        PlaceType origin = new PlaceType();
        origin.setId("698780732fe1e10ab25f7269");
        origin.setCity("Djerba");

        PlaceType destination = new PlaceType();
        destination.setId("69877b202fe1e10ab25f7265");
        destination.setCity("Sfax");

        TripType trip = TripType.builder()
                .id("trip-1")
                .departureDate(Instant.parse("2026-04-15T11:00:00Z"))
                .timezone("Africa/Tunis")
                .stopSchedule(List.of(
                        stop("698780732fe1e10ab25f7269", 0),
                        stop("69877b202fe1e10ab25f7265", 1)))
                .segments(List.of(
                        SegmentType.builder()
                                .segmentId("seg-1")
                                .sequence(1)
                                .fromPlace(TripPlaceRef.builder().build())
                                .toPlace(TripPlaceRef.builder().build())
                                .basePrice(new BigDecimal("20"))
                                .build()))
                .build();

        TicketType ticket = TicketType.builder()
                .id("ticket-1")
                .reference("TKREF005E")
                .tripId("trip-1")
                .segmentIds(List.of("seg-1"))
                .appliedPrice(new BigDecimal("20"))
                .currency("TND")
                .lang("en-gb")
                .status(TicketStatusEnum.CONFIRMED)
                .build();

        when(tripRepository.findById("trip-1")).thenReturn(Optional.of(trip));
        when(placeRepository.findById("698780732fe1e10ab25f7269")).thenReturn(Optional.of(origin));
        when(placeRepository.findById("69877b202fe1e10ab25f7265")).thenReturn(Optional.of(destination));
        when(qrCodeService.generatePublicUrl(anyString()))
                .thenAnswer(invocation -> "https://qr.example/" + invocation.getArgument(0, String.class));
        when(qrCodeService.generateDataUri(anyString()))
                .thenAnswer(invocation -> "data:" + invocation.getArgument(0, String.class));

        TicketDocumentView document = ticketDocumentService.buildDocument(ticket);

        assertEquals("ticket-1", document.getTicketId());
        assertEquals("TKREF005E", document.getReference());
        assertTrue(document.getHtmlContent().contains(document.getReference()));
        assertTrue(document.getHtmlContent().contains("data:" + document.getReference()));
        assertTrue(document.getHtmlContent().contains("Djerba &gt; Sfax"));
    }

    @Test
    void buildDocumentIncludesPickupAndDropoffTimesWhenAvailable() {
        PlaceType origin = new PlaceType();
        origin.setId("djerba");
        origin.setCity("Djerba");

        PlaceType destination = new PlaceType();
        destination.setId("sfax");
        destination.setCity("Sfax");

        Instant pickupTime = Instant.parse("2026-04-15T11:15:00Z");
        Instant dropoffTime = Instant.parse("2026-04-15T13:45:00Z");

        TripType trip = TripType.builder()
                .id("trip-1")
                .departureDate(Instant.parse("2026-04-15T11:00:00Z"))
                .timezone("Africa/Tunis")
                .pickupPoints(List.of(
                        PickupPointType.builder()
                                .pointId("pickup-1")
                                .placeId("djerba")
                                .address("Djerba Station")
                                .scheduledDepartureTime(pickupTime)
                                .active(true)
                                .build()))
                .dropoffPoints(List.of(
                        DropoffPointType.builder()
                                .pointId("dropoff-1")
                                .placeId("sfax")
                                .address("Sfax Centre")
                                .scheduledArrivalTime(dropoffTime)
                                .active(true)
                                .build()))
                .segments(List.of(segment("seg-1", "djerba", "sfax")))
                .build();

        TicketType ticket = TicketType.builder()
                .id("ticket-1")
                .reference("TKREFTIME1")
                .tripId("trip-1")
                .segmentIds(List.of("seg-1"))
                .pickupPointId("pickup-1")
                .dropoffPointId("dropoff-1")
                .appliedPrice(new BigDecimal("20"))
                .currency("TND")
                .lang("en-gb")
                .status(TicketStatusEnum.CONFIRMED)
                .build();

        when(tripRepository.findById("trip-1")).thenReturn(Optional.of(trip));
        when(placeRepository.findById("djerba")).thenReturn(Optional.of(origin));
        when(placeRepository.findById("sfax")).thenReturn(Optional.of(destination));
        when(qrCodeService.generatePublicUrl(anyString()))
                .thenAnswer(invocation -> "https://qr.example/" + invocation.getArgument(0, String.class));
        when(qrCodeService.generateDataUri(anyString()))
                .thenAnswer(invocation -> "data:" + invocation.getArgument(0, String.class));

        TicketDocumentView document = ticketDocumentService.buildDocument(ticket);

        assertTrue(document.getPrintHtmlContent().contains("Djerba Station · 12:15"));
        assertTrue(document.getPrintHtmlContent().contains("Sfax Centre · 14:45"));
        assertTrue(document.getEmailHtmlContent().contains("Djerba Station · 12:15"));
        assertTrue(document.getEmailHtmlContent().contains("Sfax Centre · 14:45"));
    }

    private SegmentType segment(String segmentId, String originPlaceId, String destinationPlaceId) {
        return SegmentType.builder()
                .segmentId(segmentId)
                .sequence(1)
                .fromPlace(TripPlaceRef.of(originPlaceId))
                .toPlace(TripPlaceRef.of(destinationPlaceId))
                .basePrice(new BigDecimal("20"))
                .build();
    }

    private StopType stop(String placeId, int sequence) {
        return StopType.builder()
                .placeId(placeId)
                .sequence(sequence)
                .boardingAllowed(true)
                .droppingAllowed(true)
                .build();
    }
}
