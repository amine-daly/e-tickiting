package com.eticketing.app.trip;

import com.eticketing.app.common.TargetInput;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Trip document — the 9-layer schema per TRIP_SPEC.
 * <p>
 * Layers: Identity → Bus ref → Currency ref → Seat hold → Stop schedule →
 * Pickup points → Dropoff points → Segments → Express segments.
 */
@Document("trips")
@CompoundIndexes({
    @CompoundIndex(name = "target_company_idx", def = "{ 'target.company': 1 }"),
    @CompoundIndex(name = "target_company_status_idx", def = "{ 'target.company': 1, 'status': 1 }"),
    @CompoundIndex(name = "target_company_date_idx", def = "{ 'target.company': 1, 'departureDate': 1 }"),
    @CompoundIndex(name = "bus_status_idx", def = "{ 'bus.busId': 1, 'status': 1 }")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TripType {

    // ── Layer 1 — Identity ──────────────────────────────────────────────
    @Id
    private String id;

    @Version
    private Long version;

    /**
     * Company-scoped ownership.
     */
    private TargetInput target;

    /**
     * ISO date, must be future, UTC.
     */
    private Instant departureDate;

    /**
     * IANA timezone e.g. "Africa/Tunis" — mandatory.
     */
    private String timezone;

    /**
     * Default: SCHEDULED.
     */
    @Builder.Default
    private TripStatusEnum status = TripStatusEnum.SCHEDULED;

    // ── Layer 2 — Bus (pure reference) ──────────────────────────────────
    /**
     * Bus reference — totalSeats read live from Bus entity.
     */
    private TripBusRef bus;

    // ── Layer 3 — Global Currency ───────────────────────────────────────
    /**
     * Currency reference. Display code/name are read live from the Currency
     * entity.
     */
    private TripCurrency currency;

    // ── Layer 5 — Stop Schedule ─────────────────────────────────────────
    @Builder.Default
    private List<StopType> stopSchedule = new ArrayList<>();

    // ── Layer 6 — Pickup Points ─────────────────────────────────────────
    @Builder.Default
    private List<PickupPointType> pickupPoints = new ArrayList<>();

    // ── Layer 7 — Dropoff Points ────────────────────────────────────────
    @Builder.Default
    private List<DropoffPointType> dropoffPoints = new ArrayList<>();

    // ── Layer 8 — Segments (frozen after creation) ──────────────────────
    @Builder.Default
    private List<SegmentType> segments = new ArrayList<>();

    // ── Layer 9 — Express Segments (route-level contract) ───────────────
    @Builder.Default
    private List<ExpressSegmentType> expressSegments = new ArrayList<>();

    // ── Audit ───────────────────────────────────────────────────────────
    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
