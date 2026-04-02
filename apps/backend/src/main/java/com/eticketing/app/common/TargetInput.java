package com.eticketing.app.common;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Target input for Trip/Ticket/Bus documents. Contains the Company and POS IDs
 * to scope the document within the company/POS hierarchy.
 */
public class TargetInput {

    /**
     * Company ID
     */
    @JsonProperty("company")
    private String company;

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

    public TargetInput(String company, String pos) {
        this.company = company;
        this.pos = pos;
    }

    public String getCompany() {
        return company;
    }

    public void setCompany(String company) {
        this.company = company;
    }

    public String getPos() {
        return pos;
    }

    public void setPos(String pos) {
        this.pos = pos;
    }
}
