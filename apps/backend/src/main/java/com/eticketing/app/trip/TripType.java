package com.eticketing.app.trip;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonCreator;
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
    @NotNull
    @JsonProperty("agencyId")
    private String agencyId; // Reference to the agency providing the bus
    @Id
    @JsonProperty("id")
    private String id;
    @Version
    @JsonProperty("version")
    private Long version;
    @NotNull
    @JsonProperty("originId")
    private String originId; // Place ID for origin
    @NotNull
    @JsonProperty("destinationId")
    private String destinationId; // Place ID for destination
    @NotNull
    @JsonProperty("departureDate")
    @com.fasterxml.jackson.annotation.JsonFormat(shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    private LocalDate departureDate;
    @NotNull
    @JsonProperty("price")
    @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = com.fasterxml.jackson.databind.deser.std.NumberDeserializers.BigDecimalDeserializer.class)
    private BigDecimal price;
    @Min(0)
    @JsonProperty("availableSeats")
    private int availableSeats;
    @JsonProperty("seats")
    private List<SeatUnit> seats;


    public TripType() {}

    public String getAgencyId() { return agencyId; }
    public void setAgencyId(String agencyId) { this.agencyId = agencyId; }
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public Long getVersion() { return version; }
    @JsonProperty("version")
    public void setVersion(Long version) { this.version = version; }
    public String getOriginId() { return originId; }
    @JsonProperty("originId")
    public void setOriginId(String originId) { this.originId = originId; }
    public String getDestinationId() { return destinationId; }
    @JsonProperty("destinationId")
    public void setDestinationId(String destinationId) { this.destinationId = destinationId; }
    public LocalDate getDepartureDate() { return departureDate; }
    @JsonProperty("departureDate")
    public void setDepartureDate(LocalDate departureDate) { this.departureDate = departureDate; }
    public BigDecimal getPrice() { return price; }
    @JsonProperty("price")
    public void setPrice(BigDecimal price) { this.price = price; }
    public int getAvailableSeats() { return availableSeats; }
    @JsonProperty("availableSeats")
    public void setAvailableSeats(int availableSeats) { this.availableSeats = availableSeats; }
    public List<SeatUnit> getSeats() { return seats; }
    @JsonProperty("seats")
    public void setSeats(List<SeatUnit> seats) { this.seats = seats; }
}
