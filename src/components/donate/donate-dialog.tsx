"use client";

import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { Heart, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dictionaries, useTranslations } from "@/lib/i18n";
import { DonationPanel } from "./donation-panel";

const DONATION_INFO = gql`
  query DonationInfo {
    donationInfo {
      qrCode
      iban
    }
  }
`;

interface DonateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DonateDialog({ open, onOpenChange }: DonateDialogProps) {
  const { t, locale } = useTranslations();
  const { data, loading } = useQuery<{ donationInfo: { qrCode: string; iban: string } | null }>(
    DONATION_INFO,
    { skip: !open },
  );
  const info = data?.donationInfo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-500" />
            {t("donate.title")}
          </DialogTitle>
          <DialogDescription>{t("donate.text")}</DialogDescription>
        </DialogHeader>
        {info ? (
          <DonationPanel
            qrCode={info.qrCode}
            iban={info.iban}
            texts={dictionaries[locale].donate}
            showDomesticAccount={locale === "cs"}
            variant="dialog"
          />
        ) : (
          loading && <Loader2 className="text-muted-foreground mx-auto h-6 w-6 animate-spin" />
        )}
      </DialogContent>
    </Dialog>
  );
}
