package com.eticketing.app.trip;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public class SeatUnit {

    @Min(1)
    private int row; // 1..N as shown on UI
    @Min(1)
    private int col; // 1..M per row
    @NotNull
    private SeatStateEnum state;
    // Human-friendly label like A1, B2
    private String label;

    public SeatUnit() {
    }

    public SeatUnit(int row, int col, SeatStateEnum state) {
        this.row = row;
        this.col = col;
        this.state = state;
    }

    public SeatUnit(int row, int col, SeatStateEnum state, String label) {
        this.row = row;
        this.col = col;
        this.state = state;
        this.label = label;
    }

    public int getRow() {
        return row;
    }

    public void setRow(int row) {
        this.row = row;
    }

    public int getCol() {
        return col;
    }

    public void setCol(int col) {
        this.col = col;
    }

    public SeatStateEnum getState() {
        return state;
    }

    public void setState(SeatStateEnum state) {
        this.state = state;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }
}
