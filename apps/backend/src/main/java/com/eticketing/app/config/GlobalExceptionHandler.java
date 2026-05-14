package com.eticketing.app.config;

import java.util.HashMap;
import java.util.Map;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;

import com.eticketing.app.web.error.ApiError;
import com.eticketing.app.web.error.ApiExceptions.*;
import com.eticketing.app.web.error.ApiExceptions.BadRequestException;
import com.eticketing.app.web.error.ApiExceptions.ConflictException;
import com.eticketing.app.web.error.ApiExceptions.ForbiddenException;
import com.eticketing.app.web.error.ApiExceptions.NotFoundException;
import com.eticketing.app.web.error.ApiExceptions.UnauthorizedException;

import jakarta.servlet.http.HttpServletRequest;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest req) {
        Map<String, String> errors = new HashMap<>();
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            errors.put(fe.getField(), fe.getDefaultMessage());
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiError(400, "Bad Request", "Validation failed", req.getRequestURI(), errors));
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ApiError> handleConflict(ConflictException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiError(409, "Conflict", ex.getMessage(), req.getRequestURI(), null, ex.getCode(), ex.getConflicts()));
    }

    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<ApiError> handleUnauthorized(UnauthorizedException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiError(401, "Unauthorized", ex.getMessage(), req.getRequestURI(), null));
    }

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<ApiError> handleForbidden(ForbiddenException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ApiError(403, "Forbidden", ex.getMessage(), req.getRequestURI(), null));
    }

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ApiError> handleNotFound(NotFoundException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiError(404, "Not Found", ex.getMessage(), req.getRequestURI(), null));
    }

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<ApiError> handleBadRequest(BadRequestException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiError(400, "Bad Request", ex.getMessage(), req.getRequestURI(), null));
    }

    @ExceptionHandler(GoneException.class)
    public ResponseEntity<ApiError> handleGone(GoneException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.GONE)
                .body(new ApiError(410, "Gone", ex.getMessage(), req.getRequestURI(), null, ex.getCode(), ex.getConflicts()));
    }

    @ExceptionHandler(DuplicateKeyException.class)
    public ResponseEntity<ApiError> handleDuplicateKey(DuplicateKeyException ex, HttpServletRequest req) {
        String raw = ex.getMessage() != null ? ex.getMessage() : "Duplicate key";
        String friendly = raw;
        // Try to infer which field collided
        if (raw.contains(" index: email") || raw.contains(" dup key: { email")) {
            friendly = "Email already exists";
        } else if (raw.contains("phone.countryCode") || raw.contains("phone.number") || raw.contains(" index: unique_phone")) {
            friendly = "Phone number already exists";
        } else if (raw.contains(" index: user_company_idx")
                || raw.contains("target.company.id")
                || raw.contains("target.company.taxId")) {
            friendly = "User already has an account with this company";
        }
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiError(409, "Conflict", friendly, req.getRequestURI(), null));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> handleMaxUploadSize(MaxUploadSizeExceededException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(new ApiError(413, "Payload Too Large", "Maximum upload size exceeded", req.getRequestURI(), null));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiError> handleResponseStatus(ResponseStatusException ex, HttpServletRequest req) {
        int statusCode = ex.getStatusCode().value();
        HttpStatus status = HttpStatus.resolve(statusCode);
        String error = status != null ? status.getReasonPhrase() : "Error";
        String message = ex.getReason() != null ? ex.getReason() : error;

        return ResponseEntity.status(ex.getStatusCode())
                .body(new ApiError(statusCode, error, message, req.getRequestURI(), null));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleGeneric(Exception ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiError(500, "Internal Server Error", ex.getMessage(), req.getRequestURI(), null));
    }
}
