import { gql } from "@apollo/client";

/**
 * Shared GraphQL mutations for locations.
 *
 * IMPORTANT: Only mutations that are truly identical across all consumers live
 * here.  If a component needs different return fields (e.g. for Apollo cache
 * updates), keep a local copy — Apollo relies on the exact selection set.
 */

export const DELETE_LOCATION = gql`
  mutation DeleteLocation($id: String!) {
    deleteLocation(id: $id)
  }
`;

/**
 * CreateLocation with the full field set (including radius).
 * Used by task-detail-panel and list page.
 * Note: tags/[tagId]/page.tsx uses a slimmer version without `radius`.
 */
export const CREATE_LOCATION = gql`
  mutation CreateLocation($input: CreateLocationInput!) {
    createLocation(input: $input) {
      id
      name
      latitude
      longitude
      radius
      address
    }
  }
`;
