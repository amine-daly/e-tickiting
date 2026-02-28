import { Injectable } from "@angular/core";

export interface AmazonUploadApiResponse {
  baseUrl?: string;
  path?: string;
  key?: string;
  message?: string;
}

export interface AmazonUploadResult {
  success: boolean;
  message: string;
  baseUrl?: string;
  path?: string;
  key?: string;
}

@Injectable({ providedIn: "root" })
export class AmazonS3Helper {
  createObjectKey(
    posId: string | null | undefined,
    originalFileName: string,
    timestamp: number = Date.now(),
  ): string {
    const safePosId = posId?.trim() || "unknown-pos";
    const sanitizedName = this.sanitizeFileName(originalFileName);
    return `${safePosId}_${timestamp}_${sanitizedName}`;
  }

  uploadS3Aws(
    file: File,
    posId: string | null | undefined,
  ): { objectKey: string; request$: Promise<AmazonUploadApiResponse> } {
    const objectKey = this.createObjectKey(posId, file.name);
    const formData = new FormData();
    formData.append("file", file);
    const encodedKey = encodeURIComponent(objectKey);

    return {
      objectKey,
      request$: fetch(`/api/files?key=${encodedKey}`, {
        method: "POST",
        body: formData,
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(await response.text());
        }
        return (await response.json()) as AmazonUploadApiResponse;
      }),
    };
  }

  deleteFileFromAws(
    key: string | null | undefined,
  ): Promise<any> | null {
    if (!key || !key.trim()) {
      return null;
    }
    const encodedKey = encodeURIComponent(key);
    return fetch(`/api/files?key=${encodedKey}`, {
      method: "DELETE",
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(await response.text());
      }
      try {
        return await response.json();
      } catch {
        return null;
      }
    });
  }

  private sanitizeFileName(fileName: string): string {
    return fileName
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^A-Za-z0-9._-]/g, "");
  }
}
