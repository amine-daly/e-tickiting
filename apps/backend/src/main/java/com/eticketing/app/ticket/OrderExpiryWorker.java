package com.eticketing.app.ticket;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Background worker that sweeps expired PENDING orders and standalone tickets
 * every 60 seconds. Releases held seats back to segment capacity.
 */
@Component
@RequiredArgsConstructor
public class OrderExpiryWorker {

    private static final Logger LOG = LoggerFactory.getLogger(OrderExpiryWorker.class);

    private final OrderRepository orderRepository;
    private final TicketRepository ticketRepository;
    private final SeatReservationService seatReservationService;
    private final SeatOccupancyService seatOccupancyService;

    /**
     * Runs every 60 seconds. Finds all PENDING orders whose expiresAt has
     * passed, expires them, and releases the held seats.
     */
    @Scheduled(fixedRate = 60_000)
    public void expireStaleOrders() {
        Instant now = Instant.now();

        // ── 1. Expire PENDING orders ────────────────────────────────────
        List<OrderType> expiredOrders = orderRepository.findExpiredPendingOrders(now);
        for (OrderType order : expiredOrders) {
            try {
                expireOrder(order, now);
            } catch (Exception e) {
                LOG.error("EXPIRY_WORKER: failed to expire order {}", order.getId(), e);
            }
        }

        // ── 2. Expire standalone PENDING tickets (no orderId) ───────────
        List<TicketType> expiredTickets = ticketRepository.findExpiredPendingTickets(now);
        List<TicketType> standaloneTickets = expiredTickets.stream()
                .filter(t -> t.getOrderId() == null || t.getOrderId().isBlank())
                .toList();

        for (TicketType ticket : standaloneTickets) {
            try {
                expireStandaloneTicket(ticket, now);
            } catch (Exception e) {
                LOG.error("EXPIRY_WORKER: failed to expire standalone ticket {}", ticket.getId(), e);
            }
        }

        int total = expiredOrders.size() + standaloneTickets.size();
        if (total > 0) {
            LOG.info("EXPIRY_WORKER: expired {} orders and {} standalone tickets",
                    expiredOrders.size(), standaloneTickets.size());
        }
    }

    private void expireOrder(OrderType order, Instant now) {
        List<TicketType> tickets = ticketRepository.findByOrderId(order.getId());
        List<TicketType> expiredTickets = new java.util.ArrayList<>();

        // Expire all PENDING child tickets
        for (TicketType ticket : tickets) {
            if (ticket.getStatus() == TicketStatusEnum.PENDING) {
                ticket.setStatus(TicketStatusEnum.EXPIRED);
                ticket.setExpiresAt(now);
                expiredTickets.add(ticket);
            }
        }
        ticketRepository.saveAll(tickets);

        if (!expiredTickets.isEmpty()) {
            seatOccupancyService.releaseTicketSeats(expiredTickets);
            seatReservationService.releaseReservations(order.getTripId(), expiredTickets);
            LOG.info("EXPIRY_WORKER: released {} seats on trip {} for expired order {}",
                    expiredTickets.size(), order.getTripId(), order.getId());
        }

        // Mark order as expired
        order.setStatus(OrderStatusEnum.EXPIRED);
        order.setExpiresAt(now);
        orderRepository.save(order);
    }

    private void expireStandaloneTicket(TicketType ticket, Instant now) {
        ticket.setStatus(TicketStatusEnum.EXPIRED);
        ticket.setExpiresAt(now);
        ticketRepository.save(ticket);

        seatOccupancyService.releaseTicketSeat(ticket);
        seatReservationService.releaseSeats(ticket.getTripId(), ticket.getSegmentIds(), ticket.getExpressSegmentId());
        LOG.info("EXPIRY_WORKER: expired standalone ticket {} and released seats on trip {}",
                ticket.getId(), ticket.getTripId());
    }
}
