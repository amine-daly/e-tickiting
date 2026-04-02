package com.eticketing.app.bus;

import com.eticketing.app.common.MediaType;
import com.eticketing.app.common.TargetInput;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Bus document — represents a physical vehicle. Holds only data that belongs to
 * the vehicle itself. No trip data (pickup/dropoff, pricing, cancellation) is
 * stored here.
 * <p>
 * Trip references bus by {@code busId} only — {@code totalSeats} is read live.
 */
@Document("buses")
@CompoundIndex(name = "target_company_idx", def = "{ 'target.company': 1 }")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BusType {

    @Id
    private String id;

    /**
     * Marketplace scope — which operator owns this bus.
     */
    private TargetInput target;

    /**
     * Operator/line display name, e.g. "Express Lines".
     */
    private String name;

    /**
     * Absolute seat ceiling. Segments on trips referencing this bus cannot
     * exceed this value. LOCKED when bus is in any SCHEDULED or ACTIVE trip.
     */
    private int totalSeats;

    /**
     * Enum-only amenities — never free text.
     */
    @Builder.Default
    private List<AmenityEnum> amenities = new ArrayList<>();

    /**
     * Bus pictures (baseUrl + path pattern).
     */
    @Builder.Default
    private MediaType media = new MediaType();

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
