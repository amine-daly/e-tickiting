package com.eticketing.app.ticket;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("seat_occupancies")
@CompoundIndex(name = "trip_segment_seat_unique_idx", def = "{ 'tripId': 1, 'segmentId': 1, 'seatNo': 1 }", unique = true)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SeatOccupancyType {

    @Id
    private String id;

    private String tripId;

    private String segmentId;

    private String seatNo;

    private String ticketId;

    private String orderId;

    private String expressSegmentId;

    private String sourceChannel;

    @CreatedDate
    private Instant createdAt;
}
