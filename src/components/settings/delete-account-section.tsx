"use client";

import { useState } from "react";
import { gql } from "@apollo/client";
import { useApolloClient, useMutation } from "@apollo/client/react";
import { signOut } from "next-auth/react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n";
import { CACHE_KEY } from "@/lib/apollo/client";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const DELETE_ACCOUNT = gql`
  mutation DeleteAccount($email: String!) {
    deleteAccount(email: $email)
  }
`;

/** Deletes the account with all data; the user confirms by typing their email. */
export function DeleteAccountSection({ email }: { email: string }) {
  const { t } = useTranslations();
  const client = useApolloClient();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleteAccount, { loading }] = useMutation<{ deleteAccount: boolean }>(DELETE_ACCOUNT);

  const matches = confirmation.trim().toLowerCase() === email.trim().toLowerCase();

  const handleDelete = async () => {
    setError(null);
    try {
      await deleteAccount({ variables: { email: confirmation } });
    } catch (err) {
      const mismatch = err instanceof Error && err.message.includes("Email does not match");
      setError(mismatch ? t("deleteAccount.emailMismatch") : t("deleteAccount.error"));
      return;
    }
    // Drop the cached data of the deleted account, including the copy kept for offline use
    await client.clearStore().catch(() => {});
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      // Storage unavailable — nothing persisted
    }
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <div id="delete-account" className="border-destructive/40 rounded-lg border p-5">
      <h2 className="mb-1 text-sm font-semibold">{t("deleteAccount.title")}</h2>
      <p className="text-muted-foreground mb-3 text-xs">{t("deleteAccount.description")}</p>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (loading) return;
          setOpen(next);
          setConfirmation("");
          setError(null);
        }}
      >
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm">
            <Trash2 className="mr-2 h-4 w-4" />
            {t("deleteAccount.button")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteAccount.dialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteAccount.dialogDescription", { email })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            type="email"
            autoComplete="off"
            autoCapitalize="none"
            placeholder={t("deleteAccount.emailPlaceholder")}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            disabled={loading}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>
              {t("common.deleteConfirmCancel")}
            </AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={!matches || loading}>
              {loading ? t("deleteAccount.deleting") : t("deleteAccount.confirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
