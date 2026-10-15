import { Heart } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/types";
import { czechAccountFromIban, formatIban } from "@/lib/bank-account";
import { cn } from "@/lib/utils";

interface DonationPanelProps {
  qrCode: string;
  iban: string;
  texts: Dictionary["donate"];
  /** The Czech account number next to the IBAN (Czech UI). */
  showDomesticAccount: boolean;
  /** "card": title and text beside the QR code; "dialog": stacked, the dialog has the title. */
  variant: "card" | "dialog";
}

/** Donation QR code with the account to send to — the landing page footer and the menu dialog. */
export function DonationPanel({
  qrCode,
  iban,
  texts,
  showDomesticAccount,
  variant,
}: DonationPanelProps) {
  const card = variant === "card";
  const domesticAccount = showDomesticAccount ? czechAccountFromIban(iban) : null;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-5",
        card && "sm:flex-row sm:items-start sm:gap-6",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL, next/image ho neoptimalizuje */}
      <img
        src={qrCode}
        alt={texts.qrAlt}
        width={128}
        height={128}
        className="h-32 w-32 shrink-0 rounded-md bg-white"
      />
      <div className={cn("text-center", card && "sm:text-left")}>
        {card && (
          <>
            <h2 className="flex items-center justify-center gap-2 text-base font-semibold sm:justify-start">
              <Heart className="h-4 w-4 text-rose-500" />
              {texts.title}
            </h2>
            <p className="text-muted-foreground mt-1 mb-2 text-sm">{texts.text}</p>
          </>
        )}
        <p className="text-muted-foreground text-sm">{texts.scan}</p>
        <dl className="text-muted-foreground mt-3 space-y-0.5 text-xs">
          {domesticAccount && (
            <div>
              <dt className="inline">{texts.account}: </dt>
              <dd className="text-foreground inline font-mono select-all">{domesticAccount}</dd>
            </div>
          )}
          <div>
            <dt className="inline">IBAN: </dt>
            <dd className="text-foreground inline font-mono select-all">{formatIban(iban)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
