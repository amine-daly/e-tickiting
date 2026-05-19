package com.eticketing.app.ticket;

import com.eticketing.app.web.error.ApiExceptions.ConflictException;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SeatOccupancyService {

    private final SeatOccupancyRepository seatOccupancyRepository;
    private final TicketRepository ticketRepository;

    public void reserveTicketSeat(TicketType ticket) {
        String normalizedSeatNo = normalizeSeatNo(ticket.getSeatNo());
        if (normalizedSeatNo == null || ticket.getSegmentIds() == null || ticket.getSegmentIds().isEmpty()) {
            return;
        }

        ensureLegacyTicketsDoNotConflict(ticket, normalizedSeatNo);

        List<String> createdOccupancyIds = new ArrayList<>();
        try {
            for (String segmentId : ticket.getSegmentIds()) {
                SeatOccupancyType saved = seatOccupancyRepository.save(SeatOccupancyType.builder()
                        .tripId(ticket.getTripId())
                        .segmentId(segmentId)
                        .seatNo(normalizedSeatNo)
                        .ticketId(ticket.getId())
                        .orderId(ticket.getOrderId())
                        .expressSegmentId(ticket.getExpressSegmentId())
                        .sourceChannel(ticket.getSourceChannel())
                        .build());
                createdOccupancyIds.add(saved.getId());
            }
        } catch (DuplicateKeyException ex) {
            if (!createdOccupancyIds.isEmpty()) {
                seatOccupancyRepository.deleteAllById(createdOccupancyIds);
            }
            throw new ConflictException(
                    "SEAT_ALREADY_TAKEN",
                    "Seat " + normalizedSeatNo + " is already occupied on this route",
                    List.of(normalizedSeatNo));
        }
    }

    public void reserveTicketSeats(List<TicketType> tickets) {
        List<String> reservedTicketIds = new ArrayList<>();
        try {
            for (TicketType ticket : tickets) {
                reserveTicketSeat(ticket);
                reservedTicketIds.add(ticket.getId());
            }
        } catch (RuntimeException ex) {
            if (!reservedTicketIds.isEmpty()) {
                seatOccupancyRepository.deleteByTicketIdIn(reservedTicketIds);
            }
            throw ex;
        }
    }

    public List<String> findOccupiedSeatsForSegments(String tripId, List<String> segmentIds) {
        if (segmentIds == null || segmentIds.isEmpty()) {
            return List.of();
        }

        java.util.Set<String> occupiedSeats = new java.util.TreeSet<>();

        List<TicketType> activeTickets = ticketRepository.findByTripIdAndStatusIn(
                tripId,
                List.of(TicketStatusEnum.PENDING, TicketStatusEnum.CONFIRMED));
        Set<String> activeTicketIds = activeTickets.stream()
                .map(TicketType::getId)
                .filter(StringUtils::isNotBlank)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        List<SeatOccupancyType> occupancyRows = seatOccupancyRepository.findByTripIdAndSegmentIdIn(tripId, segmentIds);
        Set<String> occupancyTicketIds = occupancyRows.stream()
                .map(SeatOccupancyType::getTicketId)
                .filter(StringUtils::isNotBlank)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Map<String, TicketType> occupancyTicketsById = ticketRepository.findAllById(occupancyTicketIds).stream()
                .collect(Collectors.toMap(TicketType::getId, Function.identity()));
        List<String> staleOccupancyTicketIds = occupancyTicketsById.values().stream()
                .filter(ticket -> ticket.getStatus() != TicketStatusEnum.PENDING && ticket.getStatus() != TicketStatusEnum.CONFIRMED)
                .map(TicketType::getId)
                .distinct()
                .toList();
        if (!staleOccupancyTicketIds.isEmpty()) {
            seatOccupancyRepository.deleteByTicketIdIn(staleOccupancyTicketIds);
        }

        occupancyRows
                .stream()
                .filter(occupancy -> StringUtils.isBlank(occupancy.getTicketId())
                || !occupancyTicketsById.containsKey(occupancy.getTicketId())
                || activeTicketIds.contains(occupancy.getTicketId()))
                .map(SeatOccupancyType::getSeatNo)
                .filter(StringUtils::isNotBlank)
                .map(StringUtils::trim)
                .forEach(occupiedSeats::add);

        activeTickets
                .stream()
                .filter(ticket -> StringUtils.isNotBlank(ticket.getSeatNo()))
                .filter(ticket -> overlaps(segmentIds, ticket.getSegmentIds()))
                .map(TicketType::getSeatNo)
                .map(StringUtils::trim)
                .forEach(occupiedSeats::add);

        return occupiedSeats.stream().toList();
    }

    public void releaseTicketSeat(TicketType ticket) {
        if (ticket == null || StringUtils.isBlank(ticket.getId())) {
            return;
        }
        seatOccupancyRepository.deleteByTicketId(ticket.getId());
    }

    public void releaseTicketSeats(List<TicketType> tickets) {
        List<String> ticketIds = tickets == null
                ? List.of()
                : tickets.stream()
                        .map(TicketType::getId)
                        .filter(StringUtils::isNotBlank)
                        .distinct()
                        .toList();
        if (ticketIds.isEmpty()) {
            return;
        }
        seatOccupancyRepository.deleteByTicketIdIn(ticketIds);
    }

    private String normalizeSeatNo(String seatNo) {
        return StringUtils.trimToNull(seatNo);
    }

    private void ensureLegacyTicketsDoNotConflict(TicketType ticket, String normalizedSeatNo) {
        boolean hasConflict = ticketRepository.findByTripIdAndSeatNoAndStatusIn(
                ticket.getTripId(),
                normalizedSeatNo,
                List.of(TicketStatusEnum.PENDING, TicketStatusEnum.CONFIRMED))
                .stream()
                .filter(existingTicket -> !StringUtils.equals(existingTicket.getId(), ticket.getId()))
                .anyMatch(existingTicket -> overlaps(ticket.getSegmentIds(), existingTicket.getSegmentIds()));

        if (hasConflict) {
            throw new ConflictException(
                    "SEAT_ALREADY_TAKEN",
                    "Seat " + normalizedSeatNo + " is already occupied on this route",
                    List.of(normalizedSeatNo));
        }
    }

    private boolean overlaps(List<String> requestedSegmentIds, List<String> existingSegmentIds) {
        if (requestedSegmentIds == null || requestedSegmentIds.isEmpty()) {
            return false;
        }
        if (existingSegmentIds == null || existingSegmentIds.isEmpty()) {
            return true;
        }
        return existingSegmentIds.stream().anyMatch(requestedSegmentIds::contains);
    }
}
