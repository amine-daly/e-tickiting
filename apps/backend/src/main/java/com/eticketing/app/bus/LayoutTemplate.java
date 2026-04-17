package com.eticketing.app.bus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Visual seat-map template for a bus. Persisted as an embedded document inside
 * {@link BusType}. Both decks share the same grid dimensions.
 * <p>
 * Only populated cells are stored — empty/aisle cells are omitted.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LayoutTemplate {

    /**
     * Column count, range [3..7].
     */
    private int gridColumns;

    /**
     * Row count, range [5..20].
     */
    private int gridRows;

    /**
     * Whether this bus has an upper deck.
     */
    private boolean hasDecks;

    /**
     * Elements on the lower (or only) deck.
     */
    @Builder.Default
    private List<LayoutElement> lowerDeck = new ArrayList<>();

    /**
     * Elements on the upper deck. Empty when {@code hasDecks == false}.
     */
    @Builder.Default
    private List<LayoutElement> upperDeck = new ArrayList<>();
}
