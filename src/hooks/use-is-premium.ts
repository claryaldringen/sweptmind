"use client";

import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

const GET_ME_FOR_PREMIUM = gql`
  query GetMeForPremium {
    me {
      id
      isPremium
      aiEnabled
    }
  }
`;

interface GetMeForPremiumData {
  me: { id: string; isPremium: boolean; aiEnabled: boolean } | null;
}

export function useIsPremium(): {
  isPremium: boolean;
  aiEnabled: boolean;
  userId: string | null;
  refetch: () => void;
} {
  const { data, refetch } = useQuery<GetMeForPremiumData>(GET_ME_FOR_PREMIUM);
  return {
    isPremium: data?.me?.isPremium ?? false,
    aiEnabled: data?.me?.aiEnabled ?? true,
    userId: data?.me?.id ?? null,
    refetch,
  };
}
