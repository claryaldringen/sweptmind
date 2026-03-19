import { useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { gql } from "@apollo/client";
import { useMutation, useApolloClient } from "@apollo/client/react";
import { pickNextTagColor } from "@/lib/tag-colors";

// ---------------------------------------------------------------------------
// GraphQL operations
// ---------------------------------------------------------------------------

const CREATE_TASK = gql`
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      id
      listId
      title
      notes
      isCompleted
      dueDate
      dueDateEnd
      sortOrder
      createdAt
      steps {
        id
        taskId
        title
        isCompleted
        sortOrder
      }
    }
  }
`;

const MARK_TASKS_ACTIONABLE = gql`
  mutation MarkTasksActionable($taskIds: [String!]!) {
    markTasksActionable(taskIds: $taskIds)
  }
`;

const CREATE_TAG = gql`
  mutation CreateTag($input: CreateTagInput!) {
    createTag(input: $input) {
      id
      name
      color
    }
  }
`;

const ADD_TAG_TO_TASK = gql`
  mutation AddTagToTask($taskId: String!, $tagId: String!) {
    addTagToTask(taskId: $taskId, tagId: $tagId)
  }
`;

const UPDATE_TASK = gql`
  mutation UpdateTask($id: String!, $input: UpdateTaskInput!) {
    updateTask(id: $id, input: $input) {
      id
      title
      notes
      dueDate
      dueDateEnd
      reminderAt
      recurrence
      deviceContext
      listId
      locationId
      locationRadius
      location {
        id
        name
        latitude
        longitude
        radius
      }
      blockedByTaskId
      blockedByTask {
        id
        title
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskTag {
  id: string;
  name: string;
  color: string;
}

interface TaskStep {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  sortOrder: number;
}

interface DecompositionInput {
  projectName: string;
  steps: { title: string; listName: string | null; dependsOn: number | null }[];
}

interface UseApplyDecompositionOptions {
  task: {
    id: string;
    listId: string;
    list: { id: string; name: string } | null;
  } | null;
  allTags: TaskTag[];
  allLists: { id: string; name: string }[];
  optimisticUpdate: (input: Record<string, unknown>) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useApplyDecomposition({
  task,
  allTags,
  allLists,
  optimisticUpdate,
}: UseApplyDecompositionOptions) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const apolloClient = useApolloClient();

  const [createTag] = useMutation<{ createTag: TaskTag }>(CREATE_TAG, {
    update(cache, { data }) {
      if (!data?.createTag) return;
      cache.modify({
        fields: {
          tags(existing = []) {
            const newRef = cache.writeFragment({
              data: {
                ...data.createTag,
                taskCount: 0,
                deviceContext: null,
                locationId: null,
                location: null,
              },
              fragment: gql`
                fragment NewDecompTag on Tag {
                  id
                  name
                  color
                  taskCount
                  deviceContext
                  locationId
                  location {
                    id
                    name
                    latitude
                    longitude
                    radius
                  }
                }
              `,
            });
            return [...existing, newRef];
          },
        },
      });
    },
  });
  const [addTagToTask] = useMutation<{ addTagToTask: boolean }>(ADD_TAG_TO_TASK);
  const [createTask] = useMutation<{
    createTask: {
      id: string;
      listId: string;
      title: string;
      notes: string | null;
      isCompleted: boolean;
      dueDate: string | null;
      dueDateEnd: string | null;
      sortOrder: number;
      createdAt: string;
      steps: TaskStep[];
    };
  }>(CREATE_TASK);
  const [markTasksActionable] = useMutation(MARK_TASKS_ACTIONABLE);
  const [updateTask] = useMutation(UPDATE_TASK);

  const handleApplyDecomposition = useCallback(
    async (decomposition: DecompositionInput) => {
      if (!task || decomposition.steps.length === 0) return;
      const { projectName, steps } = decomposition;

      // Step 1: Create project tag
      let projectTag: TaskTag | null = null;
      if (projectName) {
        const existingTag = allTags.find(
          (t) => t.name.toLowerCase() === projectName.toLowerCase(),
        );
        if (existingTag) {
          projectTag = existingTag;
        } else {
          const existingColors = allTags.map((t) => t.color);
          const color = pickNextTagColor(existingColors);
          const tagResult = await createTag({ variables: { input: { name: projectName, color } } });
          if (tagResult.data?.createTag) {
            projectTag = tagResult.data.createTag;
          }
        }
      }

      // Step 2: Rename current task to first step
      optimisticUpdate({ title: steps[0].title });
      if (steps[0].listName) {
        const targetList = allLists.find((l) => l.name === steps[0].listName);
        if (targetList) optimisticUpdate({ listId: targetList.id });
      }
      // Add project tag to original task
      if (projectTag) {
        await addTagToTask({ variables: { taskId: task.id, tagId: projectTag.id } });
        apolloClient.cache.modify({
          id: apolloClient.cache.identify({ __typename: "Task", id: task.id }),
          fields: {
            tags(existing = []) {
              const newRef = apolloClient.cache.writeFragment({
                data: projectTag,
                fragment: gql`
                  fragment ProjTag on Tag {
                    id
                    name
                    color
                  }
                `,
              });
              return [...existing, newRef];
            },
          },
        });
      }

      // Step 3: Create remaining steps as new tasks
      // Map step index -> created task ID (index 0 = original task)
      const taskIdByIndex: string[] = [task.id];

      for (let i = 1; i < steps.length; i++) {
        const step = steps[i];
        const targetList = step.listName ? allLists.find((l) => l.name === step.listName) : null;
        const newId = crypto.randomUUID();
        const result = await createTask({
          variables: {
            input: {
              id: newId,
              listId: targetList?.id ?? task.listId,
              title: step.title,
            },
          },
          update(cache, { data }) {
            if (!data?.createTask) return;
            cache.modify({
              fields: {
                activeTasks(existing = []) {
                  const newRef = cache.writeFragment({
                    data: {
                      ...data.createTask,
                      __typename: "Task",
                      reminderAt: null,
                      recurrence: null,
                      locationId: null,
                      locationRadius: null,
                      location: null,
                      deviceContext: null,
                      completedAt: null,
                      tags: [],
                      attachments: [],
                      aiAnalysis: null,
                      blockedByTaskId: null,
                      blockedByTaskIsCompleted: null,
                      dependentTaskCount: 0,
                      list: targetList
                        ? { __typename: "List", id: targetList.id, name: targetList.name }
                        : task!.list,
                    },
                    fragment: gql`
                      fragment NewDecomposedTask on Task {
                        id
                        listId
                        title
                        notes
                        isCompleted
                        dueDate
                        dueDateEnd
                        reminderAt
                        recurrence
                        sortOrder
                        createdAt
                        completedAt
                        locationId
                        locationRadius
                        location {
                          id
                          name
                          latitude
                          longitude
                          radius
                        }
                        deviceContext
                        tags {
                          id
                          name
                          color
                        }
                        steps {
                          id
                          taskId
                          title
                          isCompleted
                          sortOrder
                        }
                        attachments {
                          id
                        }
                        aiAnalysis {
                          isActionable
                          suggestion
                          suggestedTitle
                          projectName
                          decomposition {
                            title
                            listName
                            dependsOn
                          }
                          duplicateTaskId
                          callIntent {
                            name
                            reason
                          }
                          analyzedTitle
                        }
                        blockedByTaskId
                        blockedByTaskIsCompleted
                        dependentTaskCount
                        list {
                          id
                          name
                        }
                      }
                    `,
                  });
                  return [...existing, newRef];
                },
              },
            });
          },
        });

        const createdId = result.data?.createTask?.id ?? newId;
        taskIdByIndex.push(createdId);

        // Add project tag
        if (projectTag) {
          await addTagToTask({
            variables: { taskId: createdId, tagId: projectTag.id },
            update(cache) {
              cache.modify({
                id: cache.identify({ __typename: "Task", id: createdId }),
                fields: {
                  tags(existing = []) {
                    const newRef = cache.writeFragment({
                      data: projectTag,
                      fragment: gql`
                        fragment ProjTag2 on Tag {
                          id
                          name
                          color
                        }
                      `,
                    });
                    return [...existing, newRef];
                  },
                },
              });
            },
          });
        }

        // Set dependency based on AI suggestion
        if (step.dependsOn !== null && step.dependsOn >= 0 && step.dependsOn < taskIdByIndex.length) {
          const blockedById = taskIdByIndex[step.dependsOn];
          await updateTask({
            variables: { id: createdId, input: { blockedByTaskId: blockedById } },
          });
          apolloClient.cache.modify({
            id: apolloClient.cache.identify({ __typename: "Task", id: createdId }),
            fields: {
              blockedByTaskId: () => blockedById,
              blockedByTaskIsCompleted: () => false,
            },
          });
          apolloClient.cache.modify({
            id: apolloClient.cache.identify({ __typename: "Task", id: blockedById }),
            fields: {
              dependentTaskCount(existing = 0) {
                return existing + 1;
              },
            },
          });
        }
      }

      // Step 4: Mark all tasks (original + created) as actionable
      const allTaskIds = taskIdByIndex;
      for (const id of allTaskIds) {
        const taskInCache = apolloClient.cache.identify({ __typename: "Task", id });
        if (taskInCache) {
          apolloClient.cache.modify({
            id: taskInCache,
            fields: {
              aiAnalysis() {
                return {
                  __typename: "TaskAiAnalysis",
                  isActionable: true,
                  suggestion: null,
                  suggestedTitle: null,
                  projectName: null,
                  decomposition: null,
                  analyzedTitle: "",
                };
              },
            },
          });
        }
      }
      markTasksActionable({ variables: { taskIds: allTaskIds } });

      // Step 5: Remove ai param from URL
      const params = new URLSearchParams(searchParams.toString());
      params.delete("ai");
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [
      task,
      allTags,
      allLists,
      optimisticUpdate,
      apolloClient,
      searchParams,
      router,
      createTag,
      addTagToTask,
      createTask,
      markTasksActionable,
      updateTask,
    ],
  );

  return { handleApplyDecomposition };
}
