package com.eticketing.app.web;

/**
 * Simple pagination payload included in list responses.
 */
public record PaginationType(int page, int limit) {}
