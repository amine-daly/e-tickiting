package com.eticketing.app.ticket;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Handles side effects when a trip transitions ACTIVE → CANCELLED. Per
 * TRIP_SPEC section 11:
 * <ul>
 * <li>PENDING tickets → EXPIRED (seats released immediately)</li>
 * <li>CONFIRMED tickets → CANCELLED (Refund REQUESTED created, seats NOT
 * released)</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class TripCancellationHandler {

    private static final Logger LOG = LoggerFactory.getLogger(TripCancellationHandler.class);

    private final TicketRepository ticketRepository;
    private final RefundRepository refundRepository;
    private final SeatReservationService seatReservationService;

    /**
     * Processes all tickets for a cancelled trip.
     *
     * @param tripId the trip being cancelled
     */
    public void handleTripCancellation(String tripId) {
        LOG.info("Processing trip cancellation side effects for trip {}", tripId);

        // ── 1. Expire PENDING tickets and release seats ─────────────────
        List<TicketType> pendingTickets = ticketRepository.findByTripIdAndStatus(tripId, TicketStatusEnum.PENDING);
        for (TicketType ticket : pendingTickets) {
            ticket.setStatus(TicketStatusEnum.EXPIRED);
        }
        if (!pendingTickets.isEmpty()) {
            ticketRepository.saveAll(pendingTickets);
            seatReservationService.releaseReservations(tripId, pendingTickets);
        }
        for (TicketType ticket : pendingTickets) {
            LOG.info("Trip cancellation: expired PENDING ticket {}", ticket.getId());
        }

        // ── 2. Cancel CONFIRMED tickets and create refund records ───────
        List<TicketType> confirmedTickets = ticketRepository.findByTripIdAndStatus(tripId, TicketStatusEnum.CONFIRMED);
        for (TicketType ticket : confirmedTickets) {
            ticket.setStatus(TicketStatusEnum.CANCELLED);
            ticket.setCancelledAt(Instant.now());
            ticketRepository.save(ticket);

            RefundType refund = RefundType.builder()
                    .ticketId(ticket.getId())
                    .segmentsRefunded(new ArrayList<>(ticket.getSegmentIds()))
                    .amount(ticket.getAppliedPrice())
                    .currency(ticket.getCurrency())
                    .status(RefundStatusEnum.REQUESTED)
                    .build();
            refundRepository.save(refund);

            LOG.info("Trip cancellation: cancelled CONFIRMED ticket {}, refund created for {} {}",
                    ticket.getId(), ticket.getAppliedPrice(), ticket.getCurrency());
        }

        LOG.info("Trip cancellation complete for trip {}: {} PENDING expired, {} CONFIRMED cancelled with refunds",
                tripId, pendingTickets.size(), confirmedTickets.size());
    }
}
