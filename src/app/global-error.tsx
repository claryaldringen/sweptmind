"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="cs">
      <body className="flex min-h-screen items-center justify-center bg-neutral-50 p-4 dark:bg-neutral-950">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            Something went wrong
          </h1>
          <p className="mt-2 text-neutral-500">An unexpected error occurred. Please try again.</p>
          <button
            onClick={reset}
            className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
