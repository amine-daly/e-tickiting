package com.eticketing.app.storage;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

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

    private final S3Client s3Client;
    private final String bucketName;
    private final String region;

    public S3StorageService(
            S3Client s3Client,
            @Value("${aws.s3.bucket}") String bucketName,
            @Value("${aws.s3.region}") String region) {
        this.s3Client = s3Client;
        this.bucketName = bucketName;
        this.region = region;
    }

    public String getBucketName() {
        return bucketName;
    }

    public String getRegion() {
        return region;
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

    public record S3ObjectData(byte[] content, String contentType, Long contentLength, String eTag) {

    }
}
