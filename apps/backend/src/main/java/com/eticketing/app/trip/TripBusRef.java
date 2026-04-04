package com.eticketing.app.trip;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Pure bus reference embedded in Trip. Only stores busId — totalSeats is always
 * read live from the Bus entity.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TripBusRef {

    private String busId;
}
