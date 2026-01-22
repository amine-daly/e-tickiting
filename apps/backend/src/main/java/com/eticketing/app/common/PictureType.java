package com.eticketing.app.common;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Picture type for profile images, logos, etc.
 */
public class PictureType {

    @JsonProperty("baseUrl")
    private String baseUrl;

    @JsonProperty("path")
    private String path;

    public PictureType() {
    }

    public PictureType(String baseUrl, String path) {
        this.baseUrl = baseUrl;
        this.path = path;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }
}
