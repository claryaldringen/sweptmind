import { useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { gql } from "@apollo/client";
import { useMutation, useApolloClient } from "@apollo/client/react";

// ---------------------------------------------------------------------------
// GraphQL operations
// ---------------------------------------------------------------------------

const CREATE_STEP = gql`
  mutation CreateStepForShopping($input: CreateStepInput!) {
    createStep(input: $input) {
      id
      taskId
      title
      isCompleted
      sortOrder
    }
  }
`;

const DELETE_STEP = gql`
  mutation DeleteStepForShopping($id: String!) {
    deleteStep(id: $id)
  }
`;

const CREATE_TASK = gql`
  mutation CreateTaskForShopping($input: CreateTaskInput!) {
    createTask(input: $input) {
      id
      listId
      title
    }
  }
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShoppingItemSuggestion {
  action: string;
  target: string;
  targetId: string | null;
  confidence: number;
  reason: string;
}

interface ShoppingItem {
  stepId: string | null;
  stepTitle: string;
  suggestions: ShoppingItemSuggestion[];
}

interface UseApplyShoppingDistributionParams {
  taskId: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useApplyShoppingDistribution({ taskId }: UseApplyShoppingDistributionParams) {
  const client = useApolloClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [createStep] = useMutation(CREATE_STEP);
  const [deleteStep] = useMutation(DELETE_STEP);
  const [createTask] = useMutation(CREATE_TASK);

  const applyItem = useCallback(
    async (item: ShoppingItem, suggestion: ShoppingItemSuggestion) => {
      if (!suggestion.targetId) return;

      if (suggestion.action === "add_to_task") {
        // Create step on target task
        await createStep({
          variables: { input: { taskId: suggestion.targetId, title: item.stepTitle } },
        });
      } else {
        // Create new task in target list
        await createTask({
          variables: { input: { listId: suggestion.targetId, title: item.stepTitle } },
        });
      }

      // Delete step from source task
      if (item.stepId) {
        const stepRef = client.cache.identify({ __typename: "Step", id: item.stepId });
        await deleteStep({ variables: { id: item.stepId } });
        // Update cache — remove step from source task
        client.cache.modify({
          id: client.cache.identify({ __typename: "Task", id: taskId }),
          fields: {
            steps(existing: readonly { __ref: string }[] = []) {
              return existing.filter((ref) => ref.__ref !== stepRef);
            },
          },
        });
      }
    },
    [createStep, deleteStep, createTask, client, taskId],
  );

  const handleApplyShoppingItem = useCallback(
    async (item: ShoppingItem, suggestion: ShoppingItemSuggestion) => {
      await applyItem(item, suggestion);
    },
    [applyItem],
  );

  const handleApplyAllShopping = useCallback(
    async (items: ShoppingItem[]) => {
      for (const item of items) {
        const primary = item.suggestions[0];
        if (primary?.targetId) {
          await applyItem(item, primary);
        }
      }
      // Dismiss AI panel
      const params = new URLSearchParams(searchParams.toString());
      params.delete("ai");
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [applyItem, searchParams, router],
  );

  return { handleApplyShoppingItem, handleApplyAllShopping };
}
