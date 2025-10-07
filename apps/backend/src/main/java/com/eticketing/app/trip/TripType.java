package com.eticketing.app.trip;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Document("trips")
@CompoundIndexes({
    @CompoundIndex(name = "search_idx_v2", def = "{ 'source.city': 1, 'destination.city': 1, 'departureDate': 1 }", unique = false)
})
public class TripType {
    @Id
    private String id;
    @Version
    private Long version;
    @NotNull
    private PlaceType source;
    @NotNull
    private PlaceType destination;
    @NotNull
    private LocalDate departureDate;
    @NotNull
    private BigDecimal price;
    @Min(0)
    private int availableSeats;
    private List<SeatUnit> seats;

    public TripType() {}

    public TripType(PlaceType source, PlaceType destination, LocalDate departureDate, BigDecimal price, int availableSeats) {
        this.source = source;
        this.destination = destination;
        this.departureDate = departureDate;
        this.price = price;
        this.availableSeats = availableSeats;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
    public PlaceType getSource() { return source; }
    public void setSource(PlaceType source) { this.source = source; }
    public PlaceType getDestination() { return destination; }
    public void setDestination(PlaceType destination) { this.destination = destination; }
    public LocalDate getDepartureDate() { return departureDate; }
    public void setDepartureDate(LocalDate departureDate) { this.departureDate = departureDate; }
    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }
    public int getAvailableSeats() { return availableSeats; }
    public void setAvailableSeats(int availableSeats) { this.availableSeats = availableSeats; }
    public List<SeatUnit> getSeats() { return seats; }
    public void setSeats(List<SeatUnit> seats) { this.seats = seats; }
}
