package com.eticketing.app.ticket;

import com.eticketing.app.ticket.dto.FrontofficeCreateHoldRequest;
import com.eticketing.app.ticket.dto.FrontofficeHoldResponse;
import com.eticketing.app.ticket.dto.GroupBookingRequest;
import com.eticketing.app.user.AppEnum;
import com.eticketing.app.user.RoleEnum;
import com.eticketing.app.user.UserType;
import com.eticketing.app.user.UserTypeRepository;
import com.eticketing.app.web.error.ApiExceptions.BadRequestException;
import com.eticketing.app.web.error.ApiExceptions.NotFoundException;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FrontofficeBookingService {

    private final BookingService bookingService;
    private final TicketRepository ticketRepository;
    private final OrderRepository orderRepository;
    private final RefundRepository refundRepository;
    private final UserTypeRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public FrontofficeHoldResponse createBooking(FrontofficeCreateHoldRequest req) {
        validateSeatSelections(req);

        UserType contactUser = resolveOrCreateContactUser(req.getContact());
        TicketType ticket = bookingService.createBooking(
                req.getTripId(),
                req.getOriginPlaceId(),
                req.getDestinationPlaceId(),
                req.getPickupPointId(),
                req.getDropoffPointId(),
                contactUser.getId(),
                req.getHoldToken(),
                req.getLang(),
                normalizeSeatNo(req.getContact().getSeatNo()),
                null,
                null,
                BookingCreateOptions.frontoffice());
        return toSingleHoldResponse(ticket, contactUser);
    }

    public FrontofficeHoldResponse createGroupBooking(FrontofficeCreateHoldRequest req) {
        validateSeatSelections(req);

        UserType contactUser = resolveOrCreateContactUser(req.getContact());
        GroupBookingRequest groupReq = new GroupBookingRequest();
        groupReq.setTripId(req.getTripId());
        groupReq.setOriginPlaceId(req.getOriginPlaceId());
        groupReq.setDestinationPlaceId(req.getDestinationPlaceId());
        groupReq.setPickupPointId(req.getPickupPointId());
        groupReq.setDropoffPointId(req.getDropoffPointId());
        groupReq.setContactCustomerId(contactUser.getId());
        groupReq.setIdempotencyKey(req.getHoldToken());
        groupReq.setLang(req.getLang());
        groupReq.setPassengers(buildPassengers(req, contactUser));

        OrderType order = bookingService.createGroupBooking(groupReq, null, null, BookingCreateOptions.frontoffice());
        List<TicketType> tickets = ticketRepository.findByOrderId(order.getId());
        return toGroupHoldResponse(order, tickets, contactUser);
    }

    public FrontofficeHoldResponse createHold(FrontofficeCreateHoldRequest req) {
        if (req.getPassengers() == null || req.getPassengers().isEmpty()) {
            return createBooking(req);
        }
        return createGroupBooking(req);
    }

    public FrontofficeHoldResponse getHold(String holdToken) {
        ResolvedHold resolvedHold = resolveHold(holdToken);
        if (resolvedHold.isGroup()) {
            UserType contactUser = getUserById(resolvedHold.order().getContactCustomerId());
            return toGroupHoldResponse(resolvedHold.order(), resolvedHold.tickets(), contactUser);
        }
        UserType contactUser = getUserById(resolvedHold.ticket().getPassengerId());
        return toSingleHoldResponse(resolvedHold.ticket(), contactUser);
    }

    public FrontofficeHoldResponse confirmHold(String holdToken) {
        ResolvedHold resolvedHold = resolveHold(holdToken);
        if (resolvedHold.isGroup()) {
            return confirmOrder(resolvedHold.order().getId());
        }
        return confirmBooking(resolvedHold.ticket().getId());
    }

    public FrontofficeHoldResponse cancelHold(String holdToken) {
        ResolvedHold resolvedHold = resolveHold(holdToken);
        if (resolvedHold.isGroup()) {
            return cancelOrder(resolvedHold.order().getId());
        }
        return cancelBooking(resolvedHold.ticket().getId());
    }

    public List<String> getOccupiedSeats(String tripId, String originPlaceId, String destinationPlaceId) {
        return ticketRepository.findOccupiedSeatsByTripId(tripId)
                .stream()
                .filter(ticket -> StringUtils.isNotBlank(ticket.getSeatNo()))
                .map(TicketType::getSeatNo)
                .map(StringUtils::trim)
                .distinct()
                .sorted()
                .toList();
    }

    public List<String> getRouteOccupiedSeats(String tripId, String originPlaceId, String destinationPlaceId) {
        return bookingService.getRouteOccupiedSeats(tripId, originPlaceId, destinationPlaceId);
    }

    public FrontofficeHoldResponse confirmBooking(String ticketId) {
        TicketType savedTicket = bookingService.confirmBooking(ticketId);
        UserType contactUser = getUserById(savedTicket.getPassengerId());
        return toSingleHoldResponse(savedTicket, contactUser);
    }

    public FrontofficeHoldResponse confirmOrder(String orderId) {
        OrderType savedOrder = bookingService.confirmOrder(orderId);
        List<TicketType> tickets = ticketRepository.findByOrderId(savedOrder.getId());
        UserType contactUser = getUserById(savedOrder.getContactCustomerId());
        return toGroupHoldResponse(savedOrder, tickets, contactUser);
    }

    public FrontofficeHoldResponse cancelBooking(String ticketId) {
        TicketType savedTicket = bookingService.cancelBooking(ticketId, refundRepository);
        UserType contactUser = getUserById(savedTicket.getPassengerId());
        return toSingleHoldResponse(savedTicket, contactUser);
    }

    public FrontofficeHoldResponse cancelOrder(String orderId) {
        OrderType savedOrder = bookingService.cancelOrder(orderId, refundRepository);
        List<TicketType> tickets = ticketRepository.findByOrderId(savedOrder.getId());
        UserType contactUser = getUserById(savedOrder.getContactCustomerId());
        return toGroupHoldResponse(savedOrder, tickets, contactUser);
    }

    private List<GroupBookingRequest.PassengerEntry> buildPassengers(
            FrontofficeCreateHoldRequest req,
            UserType contactUser) {
        List<GroupBookingRequest.PassengerEntry> passengers = new ArrayList<>();

        GroupBookingRequest.PassengerEntry contactPassenger = new GroupBookingRequest.PassengerEntry();
        contactPassenger.setPassengerId(contactUser.getId());
        contactPassenger.setFirstName(StringUtils.trim(req.getContact().getFirstName()));
        contactPassenger.setLastName(StringUtils.trim(req.getContact().getLastName()));
        contactPassenger.setSeatNo(normalizeSeatNo(req.getContact().getSeatNo()));
        passengers.add(contactPassenger);

        for (FrontofficeCreateHoldRequest.GuestPassenger guest : req.getPassengers()) {
            GroupBookingRequest.PassengerEntry passenger = new GroupBookingRequest.PassengerEntry();
            passenger.setFirstName(StringUtils.trim(guest.getFirstName()));
            passenger.setLastName(StringUtils.trim(guest.getLastName()));
            passenger.setSeatNo(normalizeSeatNo(guest.getSeatNo()));
            passengers.add(passenger);
        }

        return passengers;
    }

    private void validateSeatSelections(FrontofficeCreateHoldRequest req) {
        Set<String> seenSeatNos = new HashSet<>();
        addSeat(seenSeatNos, req.getContact() != null ? req.getContact().getSeatNo() : null);
        if (req.getPassengers() == null || req.getPassengers().isEmpty()) {
            return;
        }
        for (FrontofficeCreateHoldRequest.GuestPassenger passenger : req.getPassengers()) {
            addSeat(seenSeatNos, passenger.getSeatNo());
        }
    }

    private void addSeat(Set<String> seenSeatNos, String seatNo) {
        String normalizedSeatNo = normalizeSeatNo(seatNo);
        if (normalizedSeatNo == null) {
            return;
        }
        if (!seenSeatNos.add(normalizedSeatNo)) {
            throw new BadRequestException("DUPLICATE_SEAT_ASSIGNMENT: seat " + normalizedSeatNo + " is assigned more than once");
        }
    }

    private String normalizeSeatNo(String seatNo) {
        return StringUtils.trimToNull(seatNo);
    }

    private UserType resolveOrCreateContactUser(FrontofficeCreateHoldRequest.ContactPassenger contact) {
        String normalizedEmail = StringUtils.lowerCase(StringUtils.trimToNull(contact.getEmail()));
        if (normalizedEmail == null) {
            throw new BadRequestException("INVALID_CONTACT_EMAIL: email is required");
        }

        Optional<UserType> existing = userRepository.findByEmailAndApp(normalizedEmail, AppEnum.FRONT);
        if (existing.isPresent()) {
            return existing.get();
        }

        UserType user = new UserType();
        user.setFirstName(StringUtils.trim(contact.getFirstName()));
        user.setLastName(StringUtils.trim(contact.getLastName()));
        user.setEmail(normalizedEmail);
        user.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
        user.setRole(RoleEnum.CUSTOMER);
        user.setApp(AppEnum.FRONT);
        return userRepository.save(user);
    }

    private FrontofficeHoldResponse toSingleHoldResponse(TicketType ticket, UserType contactUser) {
        return FrontofficeHoldResponse.builder()
                .holdToken(ticket.getIdempotencyKey())
                .orderId(ticket.getOrderId())
                .groupBooking(false)
                .tripId(ticket.getTripId())
                .companyId(ticket.getTarget() != null ? ticket.getTarget().getCompany() : null)
                .pickupPointId(ticket.getPickupPointId())
                .dropoffPointId(ticket.getDropoffPointId())
                .segmentIds(ticket.getSegmentIds())
                .status(ticket.getStatus() != null ? ticket.getStatus().name() : null)
                .totalPrice(ticket.getAppliedPrice())
                .currency(ticket.getCurrency())
                .expiresAt(ticket.getExpiresAt())
                .createdAt(ticket.getCreatedAt())
                .confirmedAt(ticket.getConfirmedAt())
                .cancelledAt(ticket.getCancelledAt())
                .contact(toContactSummary(contactUser))
                .passengers(List.of(toPassengerSummary(ticket, contactUser, contactUser != null ? contactUser.getEmail() : null)))
                .build();
    }

    private FrontofficeHoldResponse toGroupHoldResponse(OrderType order, List<TicketType> tickets, UserType contactUser) {
        Map<String, TicketType> ticketsById = new HashMap<>();
        for (TicketType ticket : tickets) {
            ticketsById.put(ticket.getId(), ticket);
        }

        TicketType firstTicket = tickets.stream()
                .min(Comparator.comparing(TicketType::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(null);

        List<FrontofficeHoldResponse.PassengerSummary> passengers = new ArrayList<>();
        for (OrderType.OrderPassenger passenger : order.getPassengers()) {
            TicketType ticket = ticketsById.get(passenger.getTicketId());
            UserType passengerUser = StringUtils.isNotBlank(passenger.getPassengerId())
                    ? getUserById(passenger.getPassengerId())
                    : null;

            String firstName = StringUtils.firstNonBlank(
                    passenger.getFirstName(),
                    passengerUser != null ? passengerUser.getFirstName() : null,
                    ticket != null ? ticket.getGuestFirstName() : null);
            String lastName = StringUtils.firstNonBlank(
                    passenger.getLastName(),
                    passengerUser != null ? passengerUser.getLastName() : null,
                    ticket != null ? ticket.getGuestLastName() : null);

            passengers.add(FrontofficeHoldResponse.PassengerSummary.builder()
                    .ticketId(passenger.getTicketId())
                    .passengerId(passenger.getPassengerId())
                    .firstName(firstName)
                    .lastName(lastName)
                    .email(passengerUser != null ? passengerUser.getEmail() : null)
                    .seatNo(StringUtils.firstNonBlank(
                            passenger.getSeatNo(),
                            ticket != null ? ticket.getSeatNo() : null))
                    .appliedPrice(ticket != null ? ticket.getAppliedPrice() : null)
                    .currency(ticket != null ? ticket.getCurrency() : order.getCurrency())
                    .status(ticket != null && ticket.getStatus() != null ? ticket.getStatus().name() : order.getStatus().name())
                    .build());
        }

        return FrontofficeHoldResponse.builder()
                .holdToken(order.getIdempotencyKey())
                .orderId(order.getId())
                .groupBooking(true)
                .tripId(order.getTripId())
                .companyId(order.getTarget() != null ? order.getTarget().getCompany() : null)
                .pickupPointId(firstTicket != null ? firstTicket.getPickupPointId() : null)
                .dropoffPointId(firstTicket != null ? firstTicket.getDropoffPointId() : null)
                .segmentIds(firstTicket != null ? firstTicket.getSegmentIds() : List.of())
                .status(order.getStatus() != null ? order.getStatus().name() : null)
                .totalPrice(order.getTotalPrice())
                .currency(order.getCurrency())
                .expiresAt(order.getExpiresAt())
                .createdAt(order.getCreatedAt())
                .confirmedAt(order.getConfirmedAt())
                .cancelledAt(order.getCancelledAt())
                .contact(toContactSummary(contactUser))
                .passengers(passengers)
                .build();
    }

    private FrontofficeHoldResponse.ContactSummary toContactSummary(UserType contactUser) {
        if (contactUser == null) {
            return null;
        }
        return FrontofficeHoldResponse.ContactSummary.builder()
                .passengerId(contactUser.getId())
                .firstName(contactUser.getFirstName())
                .lastName(contactUser.getLastName())
                .email(contactUser.getEmail())
                .build();
    }

    private FrontofficeHoldResponse.PassengerSummary toPassengerSummary(
            TicketType ticket,
            UserType passengerUser,
            String email) {
        return FrontofficeHoldResponse.PassengerSummary.builder()
                .ticketId(ticket.getId())
                .passengerId(ticket.getPassengerId())
                .firstName(passengerUser != null ? passengerUser.getFirstName() : ticket.getGuestFirstName())
                .lastName(passengerUser != null ? passengerUser.getLastName() : ticket.getGuestLastName())
                .email(email)
                .seatNo(ticket.getSeatNo())
                .appliedPrice(ticket.getAppliedPrice())
                .currency(ticket.getCurrency())
                .status(ticket.getStatus() != null ? ticket.getStatus().name() : null)
                .build();
    }

    private ResolvedHold resolveHold(String holdToken) {
        Optional<OrderType> order = orderRepository.findByIdempotencyKey(holdToken);
        if (order.isPresent()) {
            List<TicketType> tickets = ticketRepository.findByOrderId(order.get().getId());
            return new ResolvedHold(order.get(), null, tickets);
        }

        TicketType ticket = ticketRepository.findByIdempotencyKey(holdToken)
                .orElseThrow(() -> new NotFoundException("Frontoffice hold not found: " + holdToken));
        return new ResolvedHold(null, ticket, List.of(ticket));
    }

    private UserType getUserById(String userId) {
        if (StringUtils.isBlank(userId)) {
            return null;
        }
        return userRepository.findById(userId).orElse(null);
    }

    private record ResolvedHold(OrderType order, TicketType ticket, List<TicketType> tickets) {

        private boolean isGroup() {
            return order != null;
        }
    }
}
