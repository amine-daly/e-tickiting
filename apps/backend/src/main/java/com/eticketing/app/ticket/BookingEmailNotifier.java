package com.eticketing.app.ticket;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Sends confirmation emails asynchronously after booking/order confirmation.
 * Failures are logged but never propagate to the caller.
 */
@Service
@RequiredArgsConstructor
public class BookingEmailNotifier {

    private static final Logger LOG = LoggerFactory.getLogger(BookingEmailNotifier.class);

    private final TicketRepository ticketRepository;
    private final OrderRepository orderRepository;
    private final TicketDocumentService ticketDocumentService;
    private final TicketEmailService ticketEmailService;

    /**
     * Sends a confirmation email for a single confirmed ticket (non-order).
     */
    @Async
    public void sendTicketConfirmationEmail(String ticketId) {
        try {
            TicketType ticket = ticketRepository.findById(ticketId).orElse(null);
            if (ticket == null) {
                LOG.warn("ASYNC_EMAIL: ticket not found: {}", ticketId);
                return;
            }

            TicketDocumentView document = ticketDocumentService.buildDocument(ticket);
            String recipient = document.getPassengerEmail();
            if (recipient == null || recipient.isBlank()) {
                LOG.info("ASYNC_EMAIL: no email for ticket {}, skipping", ticketId);
                return;
            }

            boolean sent = ticketEmailService.sendTicket(document, recipient);
            if (sent) {
                LOG.info("ASYNC_EMAIL: ticket {} confirmation sent to {}", ticketId, recipient);
            } else {
                LOG.warn("ASYNC_EMAIL: failed to send ticket {} confirmation to {}", ticketId, recipient);
            }
        } catch (Exception e) {
            LOG.error("ASYNC_EMAIL: error sending ticket {} confirmation", ticketId, e);
        }
    }

    /**
     * Sends a confirmation email for a confirmed order (master ticket with
     * passenger manifest).
     */
    @Async
    public void sendOrderConfirmationEmail(String orderId) {
        try {
            OrderType order = orderRepository.findById(orderId).orElse(null);
            if (order == null) {
                LOG.warn("ASYNC_EMAIL: order not found: {}", orderId);
                return;
            }

            List<TicketType> tickets = ticketRepository.findByOrderId(orderId);
            if (tickets.isEmpty()) {
                LOG.warn("ASYNC_EMAIL: no tickets for order {}, skipping", orderId);
                return;
            }

            TicketDocumentView document = ticketDocumentService.buildOrderDocument(order, tickets);
            String recipient = document.getPassengerEmail();
            if (recipient == null || recipient.isBlank()) {
                LOG.info("ASYNC_EMAIL: no email for order {}, skipping", orderId);
                return;
            }

            boolean sent = ticketEmailService.sendTicket(document, recipient);
            if (sent) {
                LOG.info("ASYNC_EMAIL: order {} confirmation sent to {}", orderId, recipient);
            } else {
                LOG.warn("ASYNC_EMAIL: failed to send order {} confirmation to {}", orderId, recipient);
            }
        } catch (Exception e) {
            LOG.error("ASYNC_EMAIL: error sending order {} confirmation", orderId, e);
        }
    }
}
