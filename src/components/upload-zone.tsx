"use client";

import { useCallback, useRef, useState } from "react";
import { clsx } from "clsx";

interface UploadZoneProps {
  onUpload: (file: File) => void;
  disabled?: boolean;
}

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/tiff", "image/heic"];

export function UploadZone({ onUpload, disabled = false }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type) && !file.type.startsWith("image/")) {
      return "Please upload an image file (JPEG, PNG, WebP, TIFF, or HEIC).";
    }
    if (file.size > MAX_SIZE_BYTES) {
      return "File is too large. Maximum size is 20 MB.";
    }
    return null;
  };

  const processFile = useCallback(
    (file: File) => {
      setError(null);
      const validationError = validate(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      onUpload(file);
    },
    [onUpload]
  );

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload a photo"
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleClick();
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={clsx(
          "relative flex flex-col items-center justify-center min-h-56 rounded-[12px] border-2 border-dashed cursor-pointer",
          "transition-all duration-[200ms]",
          "focus-visible:outline-2 focus-visible:outline-[#B5622A] focus-visible:outline-offset-2",
          isDragging
            ? "border-[#B5622A] bg-[#E8C5A8]/20"
            : "border-[#C9BAA8] bg-[#F2EDE5] hover:border-[#B5622A] hover:bg-[#EAE3D8]",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none"
        )}
      >
        {preview ? (
          <div className="flex flex-col items-center gap-3 p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Selected photo preview"
              className="max-h-40 max-w-full rounded-[8px] object-contain shadow-sm"
            />
            <p className="text-sm text-[#6B5D52] font-medium text-center">{fileName}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 p-8 text-center select-none">
            <div
              className={clsx(
                "w-14 h-14 rounded-full flex items-center justify-center transition-colors duration-[200ms]",
                isDragging ? "bg-[#B5622A]/20" : "bg-[#E8C5A8]"
              )}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke={isDragging ? "#B5622A" : "#8A4520"}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-[#1C1410]">
                {isDragging ? "Drop your photo here" : "Upload a photo"}
              </p>
              <p className="mt-1 text-sm text-[#8A7A6E]">
                Drag and drop, or click to browse
              </p>
              <p className="mt-1 text-xs text-[#A89380]">
                JPEG, PNG, WebP, TIFF or HEIC · Max 20 MB
              </p>
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleChange}
          disabled={disabled}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-[#B83B3B]">
          {error}
        </p>
      )}
    </div>
  );
}
