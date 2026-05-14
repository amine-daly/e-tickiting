package com.eticketing.app.ticket;

import com.eticketing.app.ticket.dto.FrontofficeCreateHoldRequest;
import com.eticketing.app.ticket.dto.FrontofficeHoldResponse;
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
    public ResponseEntity<FrontofficeHoldResponse> confirmBooking(@PathVariable String ticketId) {
        return ResponseEntity.ok(frontofficeBookingService.confirmBooking(ticketId));
    }

    @PostMapping("/{ticketId}/cancel")
    public ResponseEntity<FrontofficeHoldResponse> cancelBooking(@PathVariable String ticketId) {
        return ResponseEntity.ok(frontofficeBookingService.cancelBooking(ticketId));
    }

    @PostMapping("/group/{orderId}/confirm")
    public ResponseEntity<FrontofficeHoldResponse> confirmOrder(@PathVariable String orderId) {
        return ResponseEntity.ok(frontofficeBookingService.confirmOrder(orderId));
    }

    @PostMapping("/group/{orderId}/cancel")
    public ResponseEntity<FrontofficeHoldResponse> cancelOrder(@PathVariable String orderId) {
        return ResponseEntity.ok(frontofficeBookingService.cancelOrder(orderId));
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
    public ResponseEntity<FrontofficeHoldResponse> confirmHold(@PathVariable String holdToken) {
        return ResponseEntity.ok(frontofficeBookingService.confirmHold(holdToken));
    }

    @PostMapping("/holds/{holdToken}/cancel")
    public ResponseEntity<FrontofficeHoldResponse> cancelHold(@PathVariable String holdToken) {
        return ResponseEntity.ok(frontofficeBookingService.cancelHold(holdToken));
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
