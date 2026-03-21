"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { UploadZone } from "@/components/upload-zone";

/**
 * UploadSection — client component extracted from the home page server wrapper.
 *
 * Only rendered when the user is authenticated (the server wrapper checks
 * auth() before deciding whether to show this or the hero CTA). Owns the
 * upload state machine: idle → uploading → navigating to /restore/[id].
 */
export function UploadSection() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setUploadError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("preset", "standard");

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Upload failed. Please try again.");
        }

        const { restorationId } = (await res.json()) as { restorationId: string };
        router.push(`/restore/${restorationId}`);
      } catch (err) {
        setUploadError(
          err instanceof Error ? err.message : "Something went wrong."
        );
        setUploading(false);
      }
    },
    [router]
  );

  return (
    <div className="flex flex-col gap-4">
      <UploadZone onUpload={handleUpload} disabled={uploading} />

      {uploadError && (
        <p className="text-sm" style={{ color: "#B83B3B" }}>
          {uploadError}
        </p>
      )}

      {uploading && (
        <div className="flex items-center gap-3">
          <svg
            className="animate-spin"
            width="18"
            height="18"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="8" cy="8" r="6" stroke="#D9CDB8" strokeWidth="2" />
            <path
              d="M14 8a6 6 0 0 0-6-6"
              stroke="#B5622A"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <p className="text-sm" style={{ color: "#6B5D52" }}>
            Uploading your photo…
          </p>
        </div>
      )}
    </div>
  );
}
