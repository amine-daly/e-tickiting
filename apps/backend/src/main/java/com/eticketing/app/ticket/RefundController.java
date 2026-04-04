package com.eticketing.app.ticket;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Refund REST API — approve, reject, complete refund records.
 */
@RestController
@RequestMapping("/api/refunds")
@RequiredArgsConstructor
public class RefundController {

    private final RefundService refundService;

    @PostMapping("/{refundId}/approve")
    public ResponseEntity<RefundType> approve(@PathVariable String refundId) {
        return ResponseEntity.ok(refundService.approve(refundId));
    }

    @PostMapping("/{refundId}/reject")
    public ResponseEntity<RefundType> reject(@PathVariable String refundId) {
        return ResponseEntity.ok(refundService.reject(refundId));
    }

    @PostMapping("/{refundId}/complete")
    public ResponseEntity<RefundType> complete(@PathVariable String refundId) {
        return ResponseEntity.ok(refundService.complete(refundId));
    }
}
