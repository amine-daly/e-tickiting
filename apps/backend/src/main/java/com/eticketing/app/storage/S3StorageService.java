package com.eticketing.app.storage;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

@Service
public class S3StorageService {

    private enum StorageMode {
        AUTO,
        S3,
        LOCAL
    }

    private final S3Client s3Client;
    private final String bucketName;
    private final String region;
    private final StorageMode storageMode;
    private final Path localDir;
    private final String localBaseUrl;

    public S3StorageService(
            S3Client s3Client,
            @Value("${aws.s3.bucket}") String bucketName,
            @Value("${aws.s3.region}") String region,
            @Value("${storage.mode:auto}") String storageMode,
            @Value("${storage.local.dir:/app/uploads}") String localDir,
            @Value("${storage.local.base-url:/api/files/raw}") String localBaseUrl) {
        this.s3Client = s3Client;
        this.bucketName = bucketName;
        this.region = region;
        this.storageMode = resolveStorageMode(storageMode);
        this.localDir = Paths.get(localDir).toAbsolutePath().normalize();
        this.localBaseUrl = localBaseUrl;
        if (isLocalStorageEnabled()) {
            ensureLocalDir();
        }
    }

    public String getBucketName() {
        return bucketName;
    }

    public String getRegion() {
        return region;
    }

    public String getBaseUrl() {
        if (isLocalStorageEnabled()) {
            return localBaseUrl;
        }
        return "https://" + bucketName + ".s3." + region + ".amazonaws.com";
    }

    public String upload(MultipartFile file) {
        return upload(file, null);
    }

    public String upload(MultipartFile file, String requestedKey) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File is required");
        }

        String originalFileName = Objects.requireNonNullElse(file.getOriginalFilename(), "file.bin");
        String sanitizedFileName = originalFileName.trim().replace(" ", "_");
        String key;
        if (requestedKey != null && !requestedKey.isBlank()) {
            key = requestedKey.trim().replace("\\", "_").replace(" ", "_");
        } else {
            key = Instant.now().toEpochMilli() + "-" + UUID.randomUUID() + "-" + sanitizedFileName;
        }

        if (isLocalStorageEnabled()) {
            return uploadLocal(file, key);
        }

        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .contentType(file.getContentType())
                .build();

        try {
            s3Client.putObject(request, RequestBody.fromBytes(file.getBytes()));
            return key;
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read file content", ex);
        } catch (S3Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, ex.awsErrorDetails().errorMessage(), ex);
        }
    }

    public S3ObjectData download(String key) {
        validateKey(key);

        if (isLocalStorageEnabled()) {
            return downloadLocal(key);
        }

        GetObjectRequest request = GetObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .build();

        try {
            ResponseBytes<GetObjectResponse> object = s3Client.getObjectAsBytes(request);
            GetObjectResponse response = object.response();
            return new S3ObjectData(
                    object.asByteArray(),
                    response.contentType(),
                    response.contentLength(),
                    response.eTag());
        } catch (NoSuchKeyException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found in S3", ex);
        } catch (S3Exception ex) {
            if (ex.statusCode() == 404) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found in S3", ex);
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, ex.awsErrorDetails().errorMessage(), ex);
        }
    }

    public void delete(String key) {
        validateKey(key);

        if (isLocalStorageEnabled()) {
            deleteLocal(key);
            return;
        }

        DeleteObjectRequest request = DeleteObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .build();

        try {
            s3Client.deleteObject(request);
        } catch (S3Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, ex.awsErrorDetails().errorMessage(), ex);
        }
    }

    public List<String> list(int maxKeys) {
        int boundedMaxKeys = Math.max(1, Math.min(maxKeys, 1000));

        if (isLocalStorageEnabled()) {
            return listLocal(boundedMaxKeys);
        }
        ListObjectsV2Request request = ListObjectsV2Request.builder()
                .bucket(bucketName)
                .maxKeys(boundedMaxKeys)
                .build();

        try {
            return s3Client.listObjectsV2(request)
                    .contents()
                    .stream()
                    .map(item -> item.key())
                    .toList();
        } catch (S3Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, ex.awsErrorDetails().errorMessage(), ex);
        }
    }

    private void validateKey(String key) {
        if (key == null || key.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File key is required");
        }
    }

    private StorageMode resolveStorageMode(String storageMode) {
        StorageMode mode = StorageMode.AUTO;
        if (storageMode != null && !storageMode.isBlank()) {
            try {
                mode = StorageMode.valueOf(storageMode.trim().toUpperCase());
            } catch (IllegalArgumentException ignored) {
                mode = StorageMode.AUTO;
            }
        }

        if (mode == StorageMode.S3) {
            return StorageMode.S3;
        }
        if (mode == StorageMode.LOCAL) {
            return StorageMode.LOCAL;
        }

        return hasAwsCredentials() ? StorageMode.S3 : StorageMode.LOCAL;
    }

    private boolean hasAwsCredentials() {
        try {
            DefaultCredentialsProvider.create().resolveCredentials();
            return true;
        } catch (Exception ex) {
            return false;
        }
    }

    private boolean isLocalStorageEnabled() {
        return storageMode == StorageMode.LOCAL;
    }

    private void ensureLocalDir() {
        try {
            Files.createDirectories(localDir);
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to create local upload directory", ex);
        }
    }

    private String uploadLocal(MultipartFile file, String key) {
        Path target = resolveLocalPath(key);
        try {
            Path parent = target.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            Files.write(target, file.getBytes(), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
            return key;
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not write file to local storage", ex);
        }
    }

    private S3ObjectData downloadLocal(String key) {
        Path target = resolveLocalPath(key);
        if (!Files.exists(target)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found", null);
        }
        try {
            byte[] content = Files.readAllBytes(target);
            String contentType = Files.probeContentType(target);
            String eTag = Integer.toHexString(Arrays.hashCode(content));
            return new S3ObjectData(content, contentType, (long) content.length, eTag);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not read local file", ex);
        }
    }

    private void deleteLocal(String key) {
        Path target = resolveLocalPath(key);
        try {
            Files.deleteIfExists(target);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not delete local file", ex);
        }
    }

    private List<String> listLocal(int maxKeys) {
        try (var stream = Files.walk(localDir)) {
            return stream
                    .filter(Files::isRegularFile)
                    .map(path -> localDir.relativize(path).toString().replace("\\", "/"))
                    .limit(maxKeys)
                    .toList();
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not list local files", ex);
        }
    }

    private Path resolveLocalPath(String key) {
        Path target = localDir.resolve(key).normalize();
        if (!target.startsWith(localDir)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid file key", null);
        }
        return target;
    }

    public record S3ObjectData(byte[] content, String contentType, Long contentLength, String eTag) {

    }
}
