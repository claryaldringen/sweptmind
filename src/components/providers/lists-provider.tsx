"use client";

import { createContext, useContext, type ReactNode } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

// Full query with all fields needed across the app
export const GET_LISTS = gql`
  query GetLists {
    lists {
      id
      name
      icon
      themeColor
      isDefault
      sortOrder
      groupId
      taskCount
      visibleTaskCount
      locationId
      location {
        id
        name
        latitude
        longitude
      }
      deviceContext
    }
  }
`;

export interface ListLocationInfo {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface ListItem {
  id: string;
  name: string;
  icon: string | null;
  themeColor: string | null;
  isDefault: boolean;
  sortOrder: number;
  groupId: string | null;
  taskCount: number;
  visibleTaskCount: number;
  locationId: string | null;
  location: ListLocationInfo | null;
  deviceContext: string | null;
}

interface GetListsData {
  lists: ListItem[];
}

interface ListsContextValue {
  lists: ListItem[];
  loading: boolean;
  refetch: () => void;
}

const ListsContext = createContext<ListsContextValue | null>(null);

export function ListsProvider({ children }: { children: ReactNode }) {
  const { data, loading, refetch } = useQuery<GetListsData>(GET_LISTS);

  return (
    <ListsContext.Provider
      value={{
        lists: data?.lists ?? [],
        loading,
        refetch,
      }}
    >
      {children}
    </ListsContext.Provider>
  );
}

export function useLists(): ListsContextValue {
  const ctx = useContext(ListsContext);
  if (!ctx) throw new Error("useLists must be used within ListsProvider");
  return ctx;
}
