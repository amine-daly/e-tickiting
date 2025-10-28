package com.eticketing.app.ticket;

import jakarta.validation.constraints.NotNull;
import com.eticketing.app.ticket.TicketType.TicketStatusEnum;
import org.springframework.data.annotation.Id;
import java.time.Instant;

public class TicketType {
    public enum TicketStatusEnum {
        BOOKED, PAID, CANCELLED
    }
    @Id
    private String id;
    @NotNull
    private String tripId;
    @NotNull
    private String userId;
    @NotNull
    private Integer seatNumber;
    @NotNull
    private TicketStatusEnum status; // BOOKED, PAID, CANCELLED
    private Instant createdAt = Instant.now();
    // Getters and setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getTripId() { return tripId; }
    public void setTripId(String tripId) { this.tripId = tripId; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public Integer getSeatNumber() { return seatNumber; }
    public void setSeatNumber(Integer seatNumber) { this.seatNumber = seatNumber; }
    public TicketStatusEnum getStatus() { return status; }
    public void setStatus(TicketStatusEnum status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
