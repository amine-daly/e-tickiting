package com.eticketing.app.ticket;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
import com.eticketing.app.trip.SegmentType;
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
                .tripId("trip-1")
                .segmentIds(List.of("seg-1"))
                .appliedPrice(new BigDecimal("20"))
                .currency("TND")
                .lang("en-gb")
                .status(TicketStatusEnum.CONFIRMED)
                .build();

        TicketType ticketTwo = TicketType.builder()
                .id("ticket-2")
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

        String html = document.getHtmlContent();
        assertEquals("amine@example.com", document.getPassengerEmail());
        assertTrue(html.contains("Passenger tickets"));
        assertTrue(html.contains("Passenger ticket 1"));
        assertTrue(html.contains("Passenger ticket 2"));
        assertTrue(html.contains("ticket-1"));
        assertTrue(html.contains("ticket-2"));
        assertTrue(html.contains("https://qr.example/ticket-1"));
        assertTrue(html.contains("https://qr.example/ticket-2"));
        assertTrue(html.contains("Amine Daly1"));
        assertTrue(html.contains("Nidhal Sed"));
        assertTrue(html.contains("A5"));
        assertTrue(html.contains("B10"));
        assertTrue(html.contains("This QR code references the full group booking. Individual passenger tickets are listed below."));
        assertTrue(html.indexOf("ticket-1") < html.indexOf("ticket-2"));
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
}