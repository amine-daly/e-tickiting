package com.eticketing.app.web;

import java.util.List;

/**
 * Generic pagination response wrapper used by list endpoints.
 */
public record PaginateResponseType<T>(List<T> objects, long count, boolean isLast) {}
