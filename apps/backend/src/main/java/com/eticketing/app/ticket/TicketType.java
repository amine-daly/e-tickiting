package com.eticketing.app.ticket;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.mapping.Document;

import com.fasterxml.jackson.annotation.JsonIgnore;

@Document("tickets")
public class TicketType {

    public enum TicketStatusEnum {
        BOOKED,
        PAID,
        CANCELLED,
        EXPIRED
    }

    public enum PaymentState {
        PENDING,
        AUTHORIZED,
        CAPTURED,
        FAILED,
        REFUNDED
    }

    public static class SeatAssignment {

        @NotNull
        private Integer row;
        @NotNull
        private Integer col;
        private String label;

        public SeatAssignment() {
        }

        public SeatAssignment(Integer row, Integer col, String label) {
            this.row = row;
            this.col = col;
            this.label = label;
        }

        public Integer getRow() {
            return row;
        }

        public void setRow(Integer row) {
            this.row = row;
        }

        public Integer getCol() {
            return col;
        }

        public void setCol(Integer col) {
            this.col = col;
        }

        public String getLabel() {
            return label;
        }

        public void setLabel(String label) {
            this.label = label;
        }
    }

    public static class TicketUserSnapshot {

        private String id;
        private String firstName;
        private String lastName;
        private String email;

        public TicketUserSnapshot() {
        }

        public TicketUserSnapshot(String id, String firstName, String lastName, String email) {
            this.id = id;
            this.firstName = firstName;
            this.lastName = lastName;
            this.email = email;
        }

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }

        public String getFirstName() {
            return firstName;
        }

        public void setFirstName(String firstName) {
            this.firstName = firstName;
        }

        public String getLastName() {
            return lastName;
        }

        public void setLastName(String lastName) {
            this.lastName = lastName;
        }

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }
    }

    public static class PaymentSnapshot {

        private BigDecimal amount;
        private String currency;
        private String method;
        private String provider;
        private String reference;
        private PaymentState status = PaymentState.PENDING;
        private Instant processedAt;

        public BigDecimal getAmount() {
            return amount;
        }

        public void setAmount(BigDecimal amount) {
            this.amount = amount;
        }

        public String getCurrency() {
            return currency;
        }

        public void setCurrency(String currency) {
            this.currency = currency;
        }

        public String getMethod() {
            return method;
        }

        public void setMethod(String method) {
            this.method = method;
        }

        public String getProvider() {
            return provider;
        }

        public void setProvider(String provider) {
            this.provider = provider;
        }

        public String getReference() {
            return reference;
        }

        public void setReference(String reference) {
            this.reference = reference;
        }

        public PaymentState getStatus() {
            return status;
        }

        public void setStatus(PaymentState status) {
            this.status = status;
        }

        public Instant getProcessedAt() {
            return processedAt;
        }

        public void setProcessedAt(Instant processedAt) {
            this.processedAt = processedAt;
        }
    }

    @Id
    private String id;
    @Version
    private Long version;
    @NotNull
    private String tripId;
    @NotNull
    private String userId;
    private TicketUserSnapshot user;
    @NotEmpty
    private List<SeatAssignment> seats = new ArrayList<>();
    @NotNull
    private TicketStatusEnum status = TicketStatusEnum.BOOKED;
    private BigDecimal unitPrice;
    private BigDecimal totalAmount;
    private String currency = "TND";
    private PaymentSnapshot payment;
    private String reference;
    @JsonIgnore
    private String bookingReference;
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();
    private Instant expiresAt;
    private Instant paidAt;
    private Instant cancelledAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public Long getVersion() {
        return version;
    }

    public void setVersion(Long version) {
        this.version = version;
    }

    public String getTripId() {
        return tripId;
    }

    public void setTripId(String tripId) {
        this.tripId = tripId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public TicketUserSnapshot getUser() {
        return user;
    }

    public void setUser(TicketUserSnapshot user) {
        this.user = user;
    }

    public List<SeatAssignment> getSeats() {
        return seats;
    }

    public void setSeats(List<SeatAssignment> seats) {
        this.seats = seats != null ? seats : new ArrayList<>();
    }

    public TicketStatusEnum getStatus() {
        return status;
    }

    public void setStatus(TicketStatusEnum status) {
        this.status = status;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public void setUnitPrice(BigDecimal unitPrice) {
        this.unitPrice = unitPrice;
    }

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(BigDecimal totalAmount) {
        this.totalAmount = totalAmount;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public PaymentSnapshot getPayment() {
        return payment;
    }

    public void setPayment(PaymentSnapshot payment) {
        this.payment = payment;
    }

    public String getReference() {
        if (reference != null && !reference.isBlank()) {
            return reference;
        }
        return bookingReference;
    }

    public void setReference(String reference) {
        this.reference = reference;
    }

    public String getBookingReference() {
        return bookingReference;
    }

    public void setBookingReference(String bookingReference) {
        this.bookingReference = bookingReference;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public Instant getPaidAt() {
        return paidAt;
    }

    public void setPaidAt(Instant paidAt) {
        this.paidAt = paidAt;
    }

    public Instant getCancelledAt() {
        return cancelledAt;
    }

    public void setCancelledAt(Instant cancelledAt) {
        this.cancelledAt = cancelledAt;
    }
}
