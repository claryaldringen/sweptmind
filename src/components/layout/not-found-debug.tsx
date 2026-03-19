"use client";

import { useState } from "react";

export function NotFoundDebug() {
  const [showDetails, setShowDetails] = useState(false);

  if (!showDetails) {
    return (
      <button
        onClick={() => setShowDetails(true)}
        className="text-muted-foreground mt-4 text-xs underline"
      >
        Debug info
      </button>
    );
  }

  return (
    <div className="text-muted-foreground mt-4 space-y-1 rounded border p-3 text-left text-xs">
      <p>
        <span className="font-medium">URL:</span> {window.location.href}
      </p>
      <p>
        <span className="font-medium">Path:</span> {window.location.pathname}
      </p>
      <p>
        <span className="font-medium">Build:</span> {process.env.NEXT_PUBLIC_BUILD_ID ?? "unknown"}
      </p>
      <p>
        <span className="font-medium">Standalone:</span>{" "}
        {window.matchMedia("(display-mode: standalone)").matches ? "yes" : "no"}
      </p>
      <p>
        <span className="font-medium">Referrer:</span> {document.referrer || "none"}
      </p>
    </div>
  );
}
