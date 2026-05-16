package com.eticketing.app.ticket;

import com.eticketing.app.ticket.dto.FrontofficeCreateHoldRequest;
import com.eticketing.app.ticket.dto.FrontofficeHoldResponse;
import com.eticketing.app.ticket.dto.FrontofficeTargetRequest;
import com.eticketing.app.ticket.dto.OperationSuccessResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/frontoffice/bookings")
@RequiredArgsConstructor
public class FrontofficeBookingController {

    private final FrontofficeBookingService frontofficeBookingService;

    @PostMapping
    public ResponseEntity<FrontofficeHoldResponse> createBooking(
            @Valid @RequestBody FrontofficeCreateHoldRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(frontofficeBookingService.createBooking(req));
    }

    @PostMapping("/group")
    public ResponseEntity<FrontofficeHoldResponse> createGroupBooking(
            @Valid @RequestBody FrontofficeCreateHoldRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(frontofficeBookingService.createGroupBooking(req));
    }

    @PostMapping("/{ticketId}/confirm")
    public ResponseEntity<FrontofficeHoldResponse> confirmBooking(
            @PathVariable String ticketId,
            @RequestBody(required = false) FrontofficeTargetRequest req) {
        return ResponseEntity.ok(frontofficeBookingService.confirmBooking(
                ticketId,
                req != null ? req.getTarget() : null));
    }

    @PostMapping("/{ticketId}/cancel")
    public ResponseEntity<OperationSuccessResponse> cancelBooking(@PathVariable String ticketId) {
        frontofficeBookingService.cancelBooking(ticketId);
        return ResponseEntity.ok(new OperationSuccessResponse(true));
    }

    @PostMapping("/group/{orderId}/confirm")
    public ResponseEntity<FrontofficeHoldResponse> confirmOrder(
            @PathVariable String orderId,
            @RequestBody(required = false) FrontofficeTargetRequest req) {
        return ResponseEntity.ok(frontofficeBookingService.confirmOrder(
                orderId,
                req != null ? req.getTarget() : null));
    }

    @PostMapping("/group/{orderId}/cancel")
    public ResponseEntity<OperationSuccessResponse> cancelOrder(@PathVariable String orderId) {
        frontofficeBookingService.cancelOrder(orderId);
        return ResponseEntity.ok(new OperationSuccessResponse(true));
    }

    @PostMapping("/holds")
    public ResponseEntity<FrontofficeHoldResponse> createHold(
            @Valid @RequestBody FrontofficeCreateHoldRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(frontofficeBookingService.createHold(req));
    }

    @GetMapping("/holds/{holdToken}")
    public ResponseEntity<FrontofficeHoldResponse> getHold(@PathVariable String holdToken) {
        return ResponseEntity.ok(frontofficeBookingService.getHold(holdToken));
    }

    @PostMapping("/holds/{holdToken}/confirm")
    public ResponseEntity<FrontofficeHoldResponse> confirmHold(
            @PathVariable String holdToken,
            @RequestBody(required = false) FrontofficeTargetRequest req) {
        return ResponseEntity.ok(frontofficeBookingService.confirmHold(
                holdToken,
                req != null ? req.getTarget() : null));
    }

    @PostMapping("/holds/{holdToken}/cancel")
    public ResponseEntity<OperationSuccessResponse> cancelHold(@PathVariable String holdToken) {
        frontofficeBookingService.cancelHold(holdToken);
        return ResponseEntity.ok(new OperationSuccessResponse(true));
    }

    @GetMapping("/occupied-seats")
    public ResponseEntity<List<String>> getOccupiedSeats(
            @RequestParam String tripId,
            @RequestParam String originPlaceId,
            @RequestParam String destinationPlaceId) {
        return ResponseEntity.ok(frontofficeBookingService.getOccupiedSeats(tripId, originPlaceId, destinationPlaceId));
    }

    @GetMapping("/route-occupied-seats")
    public ResponseEntity<List<String>> getRouteOccupiedSeats(
            @RequestParam String tripId,
            @RequestParam String originPlaceId,
            @RequestParam String destinationPlaceId) {
        return ResponseEntity.ok(frontofficeBookingService.getRouteOccupiedSeats(tripId, originPlaceId, destinationPlaceId));
    }
}
