package com.eticketing.app.web.error;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class ApiExceptions {

    private static final Pattern CODE_PATTERN = Pattern.compile("^([A-Z0-9_]+)(?::.*)?$");

    public interface CodedApiException {

        String getCode();

        List<String> getConflicts();
    }

    public static class ConflictException extends RuntimeException implements CodedApiException {

        private final String code;
        private final List<String> conflicts;

        public ConflictException(String message) {
            this(extractCode(message), message, List.of());
        }

        public ConflictException(String code, String message) {
            this(code, message, List.of());
        }

        public ConflictException(String code, String message, List<String> conflicts) {
            super(message);
            this.code = code;
            this.conflicts = conflicts;
        }

        @Override
        public String getCode() {
            return code;
        }

        @Override
        public List<String> getConflicts() {
            return conflicts;
        }
    }

    public static class UnauthorizedException extends RuntimeException {

        public UnauthorizedException(String message) {
            super(message);
        }
    }

    public static class ForbiddenException extends RuntimeException {

        public ForbiddenException(String message) {
            super(message);
        }
    }

    public static class NotFoundException extends RuntimeException {

        public NotFoundException(String message) {
            super(message);
        }
    }

    public static class BadRequestException extends RuntimeException {

        public BadRequestException(String message) {
            super(message);
        }
    }

    public static class GoneException extends RuntimeException implements CodedApiException {

        private final String code;
        private final List<String> conflicts;

        public GoneException(String message) {
            this(extractCode(message), message, List.of());
        }

        public GoneException(String code, String message) {
            this(code, message, List.of());
        }

        public GoneException(String code, String message, List<String> conflicts) {
            super(message);
            this.code = code;
            this.conflicts = conflicts;
        }

        @Override
        public String getCode() {
            return code;
        }

        @Override
        public List<String> getConflicts() {
            return conflicts;
        }
    }

    static String extractCode(String message) {
        if (message == null) {
            return null;
        }
        Matcher matcher = CODE_PATTERN.matcher(message);
        return matcher.matches() ? matcher.group(1) : null;
    }
}
