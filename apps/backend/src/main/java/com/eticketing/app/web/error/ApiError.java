package com.eticketing.app.web.error;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public class ApiError {

    private final Instant timestamp = Instant.now();
    private final int status;
    private final String error;
    private final String message;
    private final String path;
    private final Map<String, ?> details;
    private final String code;
    private final List<String> conflicts;

    public ApiError(int status, String error, String message, String path, Map<String, ?> details) {
        this(status, error, message, path, details, null, null);
    }

    public ApiError(
            int status,
            String error,
            String message,
            String path,
            Map<String, ?> details,
            String code,
            List<String> conflicts) {
        this.status = status;
        this.error = error;
        this.message = message;
        this.path = path;
        this.details = details;
        this.code = code;
        this.conflicts = conflicts;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public int getStatus() {
        return status;
    }

    public String getError() {
        return error;
    }

    public String getMessage() {
        return message;
    }

    public String getPath() {
        return path;
    }

    public Map<String, ?> getDetails() {
        return details;
    }

    public String getCode() {
        return code;
    }

    public List<String> getConflicts() {
        return conflicts;
    }
}
