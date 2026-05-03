package com.eticketing.app.trip;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ExpressSegmentExpiryWorker {

    private static final Logger LOG = LoggerFactory.getLogger(ExpressSegmentExpiryWorker.class);

    private final TripInventoryReconciliationService tripInventoryReconciliationService;

    @Scheduled(
            fixedRateString = "${app.trip.express-segment-expiry-worker.fixed-rate-ms:300000}",
            initialDelayString = "${app.trip.express-segment-expiry-worker.initial-delay-ms:300000}")
    public void deactivateStaleExpressSegments() {
        try {
            int deactivatedExpressSegments = tripInventoryReconciliationService.deactivateExpiredExpressSegments();
            if (deactivatedExpressSegments > 0) {
                LOG.info("EXPRESS_SEGMENT_EXPIRY_WORKER: deactivated {} stale express segments",
                        deactivatedExpressSegments);
            }
        } catch (Exception exception) {
            LOG.error("EXPRESS_SEGMENT_EXPIRY_WORKER: failed to deactivate stale express segments", exception);
        }
    }
}
