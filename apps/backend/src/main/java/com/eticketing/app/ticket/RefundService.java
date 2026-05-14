package com.eticketing.app.ticket;

import com.eticketing.app.web.error.ApiExceptions.ConflictException;
import com.eticketing.app.web.error.ApiExceptions.NotFoundException;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;

/**
 * Refund lifecycle — TRIP_SPEC section 9. Seats are normally decremented on
 * REQUESTED → APPROVED, but order-member cancellation can pre-release the seat
 * and mark the refund accordingly.
 */
@Service
@RequiredArgsConstructor
public class RefundService {

    private static final Logger LOG = LoggerFactory.getLogger(RefundService.class);

    private final RefundRepository refundRepository;
    private final TicketRepository ticketRepository;
    private final SeatReservationService seatReservationService;
    private final SeatOccupancyService seatOccupancyService;

    /**
     * REQUESTED → APPROVED: releases seats on refunded segments.
     */
    public RefundType approve(String refundId) {
        RefundType refund = refundRepository.findById(refundId)
                .orElseThrow(() -> new NotFoundException("Refund not found: " + refundId));

        if (refund.getStatus() != RefundStatusEnum.REQUESTED) {
            throw new ConflictException("INVALID_REFUND_TRANSITION: expected REQUESTED, got " + refund.getStatus());
        }

        Instant now = Instant.now();
        if (!refund.isSeatReleased()) {
            TicketType ticket = ticketRepository.findById(refund.getTicketId())
                    .orElseThrow(() -> new NotFoundException("Ticket not found for refund: " + refund.getTicketId()));

            seatOccupancyService.releaseTicketSeat(ticket);
            seatReservationService.releaseSeats(ticket.getTripId(), refund.getSegmentsRefunded(), ticket.getExpressSegmentId());
            refund.setSeatReleased(true);
            refund.setSeatReleasedAt(now);
        }

        refund.setStatus(RefundStatusEnum.APPROVED);
        refund.setProcessedAt(now);
        RefundType saved = refundRepository.save(refund);

        LOG.info("Refund {} APPROVED - seatReleased={} for ticket {}",
                refundId, refund.isSeatReleased(), refund.getTicketId());
        return saved;
    }

    /**
     * REQUESTED → REJECTED: no seat release.
     */
    public RefundType reject(String refundId) {
        RefundType refund = refundRepository.findById(refundId)
                .orElseThrow(() -> new NotFoundException("Refund not found: " + refundId));

        if (refund.getStatus() != RefundStatusEnum.REQUESTED) {
            throw new ConflictException("INVALID_REFUND_TRANSITION: expected REQUESTED, got " + refund.getStatus());
        }

        refund.setStatus(RefundStatusEnum.REJECTED);
        refund.setProcessedAt(Instant.now());
        return refundRepository.save(refund);
    }

    /**
     * APPROVED → COMPLETED: no further seat action.
     */
    public RefundType complete(String refundId) {
        RefundType refund = refundRepository.findById(refundId)
                .orElseThrow(() -> new NotFoundException("Refund not found: " + refundId));

        if (refund.getStatus() != RefundStatusEnum.APPROVED) {
            throw new ConflictException("INVALID_REFUND_TRANSITION: expected APPROVED, got " + refund.getStatus());
        }

        refund.setStatus(RefundStatusEnum.COMPLETED);
        refund.setProcessedAt(Instant.now());
        return refundRepository.save(refund);
    }
}
