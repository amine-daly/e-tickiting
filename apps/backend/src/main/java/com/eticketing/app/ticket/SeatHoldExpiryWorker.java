package com.eticketing.app.ticket;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

/**
 * Periodic worker that expires PENDING tickets past their hold time and
 * releases held seats back to inventory — TRIP_SPEC section 10.1.
 * <p>
 * Runs every 60 seconds. Idempotent: safe to run on already-expired tickets.
 */
@Component
@RequiredArgsConstructor
public class SeatHoldExpiryWorker {

    private static final Logger LOG = LoggerFactory.getLogger(SeatHoldExpiryWorker.class);

    private final TicketRepository ticketRepository;
    private final SeatReservationService seatReservationService;

    @Scheduled(fixedRate = 60_000)
    public void expirePendingTickets() {
        List<TicketType> expired = ticketRepository.findExpiredPendingTickets(Instant.now());
        if (expired.isEmpty()) {
            return;
        }

        LOG.info("SeatHoldExpiryWorker: found {} expired PENDING tickets", expired.size());

        for (TicketType ticket : expired) {
            // Double-check status (idempotency guard)
            if (ticket.getStatus() != TicketStatusEnum.PENDING) {
                continue;
            }

            ticket.setStatus(TicketStatusEnum.EXPIRED);
            ticketRepository.save(ticket);

            // Release seats
            seatReservationService.releaseSeats(ticket.getTripId(), ticket.getSegmentIds());

            LOG.info("Expired ticket {} — released {} segments on trip {}",
                    ticket.getId(), ticket.getSegmentIds().size(), ticket.getTripId());
        }
    }
}
