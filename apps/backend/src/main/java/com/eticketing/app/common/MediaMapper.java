package com.eticketing.app.common;

import java.util.List;

/**
 * Shared mapper helpers for media objects to avoid duplicated null/empty logic
 * across controllers and services.
 */
public final class MediaMapper {

    private MediaMapper() {
    }

    public static List<PictureType> picturesOrEmpty(MediaType media) {
        if (media == null || media.getPictures() == null) {
            return List.of();
        }
        return media.getPictures();
    }

    public static MediaType fromPictures(List<PictureType> pictures) {
        return MediaType.builder()
                .pictures(pictures != null ? pictures : List.of())
                .build();
    }
}
