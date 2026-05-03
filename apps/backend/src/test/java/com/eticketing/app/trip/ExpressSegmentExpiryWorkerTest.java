package com.eticketing.app.trip;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExpressSegmentExpiryWorkerTest {

    @Mock
    private TripInventoryReconciliationService tripInventoryReconciliationService;

    @InjectMocks
    private ExpressSegmentExpiryWorker expressSegmentExpiryWorker;

    @Test
    void deactivateStaleExpressSegmentsDelegatesToReconciliationService() {
        when(tripInventoryReconciliationService.deactivateExpiredExpressSegments()).thenReturn(2);

        expressSegmentExpiryWorker.deactivateStaleExpressSegments();

        verify(tripInventoryReconciliationService).deactivateExpiredExpressSegments();
    }
}
