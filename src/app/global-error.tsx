"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ padding: "2rem", textAlign: "center", fontFamily: "system-ui" }}>
          <h1>Something went wrong</h1>
          <p>We’ve been notified and are looking into it.</p>
        </div>
      </body>
    </html>
  );
}
