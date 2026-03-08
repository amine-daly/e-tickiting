package com.eticketing.app.common;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Generic embedded media object reusable across entities. Full URL is
 * constructed on the frontend as: baseUrl + path.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MediaType {

    @Builder.Default
    private List<PictureType> pictures = new ArrayList<>();
}
