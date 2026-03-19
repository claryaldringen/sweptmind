"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ResizeHandleProps {
  /** Which side of the handle is the resizable panel on */
  side: "left" | "right";
  /** Current width in px */
  width: number;
  /** Callback when width changes */
  onWidthChange: (width: number) => void;
  /** Min width in px */
  minWidth?: number;
  /** Max width in px */
  maxWidth?: number;
}

export function ResizeHandle({
  side,
  width,
  onWidthChange,
  minWidth = 150,
  maxWidth = 600,
}: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startXRef.current = e.clientX;
      startWidthRef.current = width;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [width],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const delta = e.clientX - startXRef.current;
      const newWidth =
        side === "left" ? startWidthRef.current + delta : startWidthRef.current - delta;
      onWidthChange(Math.min(maxWidth, Math.max(minWidth, newWidth)));
    },
    [isDragging, side, onWidthChange, minWidth, maxWidth],
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Prevent text selection while dragging
  useEffect(() => {
    if (isDragging) {
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
      return () => {
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      };
    }
  }, [isDragging]);

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="after:bg-border hover:after:bg-primary/30 active:after:bg-primary/40 relative w-0 shrink-0 cursor-col-resize before:absolute before:inset-y-0 before:-left-[3px] before:z-10 before:w-[7px] after:absolute after:inset-y-0 after:left-0 after:w-px after:transition-colors"
    />
  );
}
