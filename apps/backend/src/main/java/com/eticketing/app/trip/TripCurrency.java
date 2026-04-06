package com.eticketing.app.trip;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Pure currency reference embedded in Trip. Only stores currencyId — display
 * fields are always read live from the Currency entity.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TripCurrency {

    private String currencyId;
}
