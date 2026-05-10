package com.eticketing.app.storage;

import java.util.List;
import java.util.Map;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/files")
public class S3Controller {

    private final S3StorageService storageService;

    public S3Controller(S3StorageService storageService) {
        this.storageService = storageService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> upload(
            @RequestPart("file") MultipartFile file,
            @RequestParam(name = "key", required = false) String key) {
        String objectKey = storageService.upload(file, key);
        String baseUrl = storageService.getBaseUrl();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of(
                        "message", "Uploaded",
                        "bucket", storageService.getBucketName(),
                        "path", objectKey,
                        "baseUrl", baseUrl));
    }

    @GetMapping
    public ResponseEntity<byte[]> download(@RequestParam("key") String key) {
        S3StorageService.S3ObjectData object = storageService.download(key);

        String fileName = key.contains("/") ? key.substring(key.lastIndexOf('/') + 1) : key;
        MediaType mediaType = MediaType.APPLICATION_OCTET_STREAM;
        if (object.contentType() != null && !object.contentType().isBlank()) {
            mediaType = MediaType.parseMediaType(object.contentType());
        }
        long contentLength = object.contentLength() != null ? object.contentLength().longValue() : object.content().length;

        return ResponseEntity.ok()
                .contentType(mediaType)
                .contentLength(contentLength)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(fileName).build().toString())
                .header("ETag", object.eTag() != null ? object.eTag() : "")
                .body(object.content());
    }

    @GetMapping("/raw/{key:.+}")
    public ResponseEntity<byte[]> downloadRaw(@PathVariable("key") String key) {
        return download(key);
    }

    @DeleteMapping
    public ResponseEntity<Map<String, String>> delete(@RequestParam("key") String key) {
        storageService.delete(key);
        return ResponseEntity.ok(Map.of("message", "Deleted", "key", key));
    }

    @GetMapping("/list")
    public ResponseEntity<Map<String, Object>> list(@RequestParam(name = "maxKeys", defaultValue = "100") int maxKeys) {
        List<String> objects = storageService.list(maxKeys);
        return ResponseEntity.ok(Map.of(
                "bucket", storageService.getBucketName(),
                "count", objects.size(),
                "items", objects));
    }
}
