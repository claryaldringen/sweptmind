export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-xs text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mx-auto mb-4 text-muted-foreground"
          aria-hidden="true"
        >
          <path d="M12 20h.01" />
          <path d="M8.5 16.429a5 5 0 0 1 7 0" />
          <path d="M5 12.859a10 10 0 0 1 5.17-2.69" />
          <path d="M13.83 10.17A10 10 0 0 1 19 12.859" />
          <path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
          <path d="M10.66 5a15 15 0 0 1 11.34 3.82" />
          <line x1="2" x2="22" y1="2" y2="22" />
        </svg>
        <h1 className="text-xl font-semibold">Jsi offline</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tuto stránku nemáme v mezipaměti. Jakmile se připojíš k internetu,
          aplikace se automaticky obnoví.
        </p>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.addEventListener("online",()=>location.reload())`,
        }}
      />
    </div>
  );
}
