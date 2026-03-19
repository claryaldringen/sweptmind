import { gql } from "@apollo/client";

/**
 * Shared GraphQL mutations for tasks.
 *
 * IMPORTANT: Only mutations that are truly identical across all consumers live
 * here.  If a component needs different return fields (e.g. for Apollo cache
 * updates), keep a local copy — Apollo relies on the exact selection set.
 */

export const TOGGLE_TASK_COMPLETED = gql`
  mutation ToggleTaskCompleted($id: String!) {
    toggleTaskCompleted(id: $id) {
      id
      isCompleted
      completedAt
      dueDate
      dueDateEnd
      reminderAt
    }
  }
`;

export const DELETE_TASK = gql`
  mutation DeleteTask($id: String!) {
    deleteTask(id: $id)
  }
`;

export const DELETE_TASKS = gql`
  mutation DeleteTasks($ids: [String!]!) {
    deleteTasks(ids: $ids)
  }
`;
