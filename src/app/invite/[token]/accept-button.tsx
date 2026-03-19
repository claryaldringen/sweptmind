"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { Button } from "@/components/ui/button";
import type {
  AcceptConnectionInviteMutation,
  AcceptConnectionInviteMutationVariables,
} from "@/__generated__/graphql";

const ACCEPT_CONNECTION_INVITE = gql`
  mutation AcceptConnectionInvite($token: String!) {
    acceptConnectionInvite(token: $token)
  }
`;

interface AcceptButtonProps {
  token: string;
  label: string;
  loadingLabel: string;
}

export function AcceptButton({ token, label, loadingLabel }: AcceptButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const [acceptInvite, { loading }] = useMutation<
    AcceptConnectionInviteMutation,
    AcceptConnectionInviteMutationVariables
  >(ACCEPT_CONNECTION_INVITE, {
    onCompleted: () => {
      router.push("/settings");
      router.refresh();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-destructive/10 text-destructive rounded-lg px-4 py-3 text-sm text-center">
          {error}
        </div>
      )}
      <Button
        className="h-11 w-full text-base font-semibold"
        disabled={loading}
        onClick={() => {
          setError(null);
          void acceptInvite({ variables: { token } });
        }}
      >
        {loading ? loadingLabel : label}
      </Button>
    </div>
  );
}
