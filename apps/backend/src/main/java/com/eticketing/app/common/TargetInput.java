package com.eticketing.app.common;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Target input for Trip/Ticket documents. Contains the POS ID to scope the
 * document to a specific point of sale.
 */
public class TargetInput {

    /**
     * Point of Sale ID
     */
    @JsonProperty("pos")
    private String pos;

    public TargetInput() {
    }

    public TargetInput(String pos) {
        this.pos = pos;
    }

    public String getPos() {
        return pos;
    }

    public void setPos(String pos) {
        this.pos = pos;
    }
}
