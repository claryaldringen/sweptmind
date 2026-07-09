// Shared styling for the native <select> elements and label+control rows used
// across the settings UI (settings page + sharing section).

export const SELECT_BASE_CLASS =
  "border-input bg-background ring-offset-background focus:ring-ring flex h-8 min-w-0 rounded-md border px-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none";

// A select that sits alone on its wrapped line on phones. min-w-0 lets it shrink
// below the width of its longest <option> instead of overflowing the card.
export const SELECT_CLASS = `${SELECT_BASE_CLASS} w-full sm:w-auto`;

// Label on the left, control on the right; the control drops to its own line
// rather than being squeezed when the two no longer fit.
export const ROW_CLASS = "flex flex-wrap items-center justify-between gap-x-4 gap-y-2";
