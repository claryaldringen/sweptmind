"use client";

import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

const GET_ME_FOR_PREMIUM = gql`
  query GetMeForPremium {
    me {
      id
      isPremium
    }
  }
`;

interface GetMeForPremiumData {
  me: { id: string; isPremium: boolean } | null;
}

export function useIsPremium(): { isPremium: boolean; userId: string | null } {
  const { data } = useQuery<GetMeForPremiumData>(GET_ME_FOR_PREMIUM);
  return {
    isPremium: data?.me?.isPremium ?? false,
    userId: data?.me?.id ?? null,
  };
}
