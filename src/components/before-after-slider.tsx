"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";

interface BeforeAfterSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeAlt?: string;
  afterAlt?: string;
  className?: string;
}

export function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  beforeAlt = "Before restoration",
  afterAlt = "After restoration",
  className,
}: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(50); // percentage 0–100
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const clampPosition = (x: number, rect: DOMRect) => {
    const raw = ((x - rect.left) / rect.width) * 100;
    return Math.max(0, Math.min(100, raw));
  };

  const handlePointerMove = useCallback(
    (clientX: number) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setPosition(clampPosition(clientX, rect));
    },
    [isDragging]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      handlePointerMove(e.clientX);
    },
    [handlePointerMove]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();
      handlePointerMove(e.touches[0].clientX);
    },
    [handlePointerMove]
  );

  const stopDragging = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", stopDragging);
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", stopDragging);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopDragging);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", stopDragging);
    };
  }, [isDragging, handleMouseMove, handleTouchMove, stopDragging]);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setPosition(clampPosition(e.clientX, rect));
  };

  return (
    <div
      ref={containerRef}
      className={clsx(
        "relative overflow-hidden rounded-[12px] select-none cursor-col-resize",
        "bg-[#1C1410]",
        className
      )}
      onClick={handleContainerClick}
      role="slider"
      aria-label="Before and after comparison slider"
      aria-valuenow={Math.round(position)}
      aria-valuemin={0}
      aria-valuemax={100}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") setPosition((p) => Math.max(0, p - 2));
        if (e.key === "ArrowRight") setPosition((p) => Math.min(100, p + 2));
      }}
      tabIndex={0}
    >
      {/* After image (full width, beneath) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={afterSrc}
        alt={afterAlt}
        draggable={false}
        className="block w-full h-full object-cover"
      />

      {/* Before image (clipped to left side via clip-path — no DOM measurement needed) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={beforeSrc}
        alt={beforeAlt}
        draggable={false}
        className="absolute inset-0 block w-full h-full object-cover"
        style={{
          clipPath: `inset(0 ${100 - position}% 0 0)`,
          transition: isDragging ? "none" : "clip-path 600ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)]"
        style={{
          left: `${position}%`,
          transform: "translateX(-50%)",
          transition: isDragging ? "none" : "left 600ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />

      {/* Drag handle */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
        style={{
          left: `${position}%`,
          transition: isDragging ? "none" : "left 600ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          setIsDragging(true);
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          setIsDragging(true);
        }}
      >
        <div className="w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center cursor-col-resize">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M7 5l-3 5 3 5M13 5l3 5-3 5"
              stroke="#B5622A"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute bottom-3 left-3 pointer-events-none">
        <span className="px-2 py-1 rounded-[4px] text-xs font-semibold uppercase tracking-wider bg-black/60 text-white">
          Before
        </span>
      </div>
      <div className="absolute bottom-3 right-3 pointer-events-none">
        <span className="px-2 py-1 rounded-[4px] text-xs font-semibold uppercase tracking-wider bg-[#B5622A] text-[#FAF7F2]">
          Restored
        </span>
      </div>
    </div>
  );
}
