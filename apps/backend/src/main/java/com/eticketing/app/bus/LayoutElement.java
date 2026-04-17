package com.eticketing.app.bus;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A single element on the bus layout grid. Maps directly to a CSS Grid cell via
 * {@code gridX} (column) and {@code gridY} (row).
 * <p>
 * {@code seatNo} is required when {@code type == SEAT} and must be null for all
 * other element types.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LayoutElement {

    private LayoutElementType type;

    /**
     * Seat number string — only populated for {@link LayoutElementType#SEAT}.
     * Must be unique across both decks of the bus.
     */
    private String seatNo;

    /**
     * 1-based column index, maps to CSS {@code grid-column}.
     */
    private int gridX;

    /**
     * 1-based row index, maps to CSS {@code grid-row}.
     */
    private int gridY;
}
