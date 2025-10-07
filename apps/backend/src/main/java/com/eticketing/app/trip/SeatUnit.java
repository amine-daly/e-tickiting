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

    public SeatUnit() {}

    public SeatUnit(int row, int col, SeatStateEnum state) {
        this.row = row;
        this.col = col;
        this.state = state;
    }

    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }
    public int getCol() { return col; }
    public void setCol(int col) { this.col = col; }
    public SeatStateEnum getState() { return state; }
    public void setState(SeatStateEnum state) { this.state = state; }
}
