package com.eticketing.app.bus;

/**
 * Types of elements that can be placed on a bus seat layout grid. Only
 * {@link #SEAT} elements carry a {@code seatNo}.
 */
public enum LayoutElementType {
    SEAT,
    DRIVER,
    DOOR,
    STAIRS,
    TOILET
}
