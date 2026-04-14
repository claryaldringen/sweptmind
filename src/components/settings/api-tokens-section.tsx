"use client";

import { useState } from "react";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import { Key, Copy, Trash2, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const GET_API_TOKENS = gql`
  query GetApiTokens {
    apiTokens {
      id
      name
      lastUsedAt
      createdAt
    }
  }
`;

const CREATE_API_TOKEN = gql`
  mutation CreateApiToken($name: String!) {
    createApiToken(name: $name) {
      rawToken
      id
      name
    }
  }
`;

const REVOKE_API_TOKEN = gql`
  mutation RevokeApiToken($id: String!) {
    revokeApiToken(id: $id)
  }
`;

export function ApiTokensSection() {
  const [tokenName, setTokenName] = useState("CLI");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data, refetch } = useQuery<{
    apiTokens: Array<{
      id: string;
      name: string;
      lastUsedAt: string | null;
      createdAt: string;
    }>;
  }>(GET_API_TOKENS);
  const [createToken, { loading: creating }] = useMutation<{
    createApiToken: { rawToken: string; id: string; name: string };
  }>(CREATE_API_TOKEN);
  const [revokeToken] = useMutation(REVOKE_API_TOKEN);

  const handleCreate = async () => {
    const result = await createToken({ variables: { name: tokenName } });
    setNewToken(result.data?.createApiToken?.rawToken ?? null);
    setTokenName("CLI");
    refetch();
  };

  const handleRevoke = async (id: string) => {
    await revokeToken({ variables: { id } });
    refetch();
  };

  const handleCopy = async () => {
    if (newToken) {
      await navigator.clipboard.writeText(newToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const tokens = data?.apiTokens ?? [];

  return (
    <section className="rounded-lg border p-5">
      <div className="mb-4 flex items-center gap-2">
        <Key className="h-4 w-4" />
        <div>
          <h2 className="text-sm font-semibold">API Tokeny</h2>
          <p className="text-muted-foreground text-xs">
            Tokeny pro přístup přes CLI (sm login --token ...)
          </p>
        </div>
      </div>

      {/* Create new token */}
      <div className="mb-4 flex gap-2">
        <Input
          value={tokenName}
          onChange={(e) => setTokenName(e.target.value)}
          placeholder="Název tokenu"
          className="max-w-xs"
        />
        <Button onClick={handleCreate} disabled={creating || !tokenName}>
          <Plus className="mr-1 h-4 w-4" />
          Vytvořit
        </Button>
      </div>

      {/* Show newly created token */}
      {newToken && (
        <div className="bg-muted mb-4 flex items-center gap-2 rounded-md p-3">
          <code className="flex-1 break-all text-sm">{newToken}</code>
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}

      {/* Token list */}
      <div className="space-y-2">
        {tokens.map(
          (token: {
            id: string;
            name: string;
            lastUsedAt: string | null;
            createdAt: string;
          }) => (
            <div
              key={token.id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div>
                <p className="font-medium">{token.name}</p>
                <p className="text-muted-foreground text-xs">
                  Vytvořen:{" "}
                  {new Date(token.createdAt).toLocaleDateString("cs")}
                  {token.lastUsedAt &&
                    ` · Naposledy použit: ${new Date(token.lastUsedAt).toLocaleDateString("cs")}`}
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Trash2 className="text-destructive h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Odvolat token?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Token &quot;{token.name}&quot; bude trvale smazán.
                      Všechna zařízení používající tento token se odpojí.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Zrušit</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleRevoke(token.id)}
                    >
                      Odvolat
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
