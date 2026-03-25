export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = {
  [_ in K]?: never;
};
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
};

export type CompleteOnboardingInput = {
  lists: Array<OnboardingListInput>;
};

export type CompletedTasksConnection = {
  __typename?: "CompletedTasksConnection";
  hasMore: Maybe<Scalars["Boolean"]["output"]>;
  tasks: Maybe<Array<Task>>;
};

export type CreateListGroupInput = {
  name: Scalars["String"]["input"];
};

export type CreateListInput = {
  groupId: InputMaybe<Scalars["String"]["input"]>;
  icon: InputMaybe<Scalars["String"]["input"]>;
  id: InputMaybe<Scalars["String"]["input"]>;
  name: Scalars["String"]["input"];
  themeColor: InputMaybe<Scalars["String"]["input"]>;
};

export type CreateLocationInput = {
  address: InputMaybe<Scalars["String"]["input"]>;
  id: InputMaybe<Scalars["String"]["input"]>;
  latitude: Scalars["Float"]["input"];
  longitude: Scalars["Float"]["input"];
  name: Scalars["String"]["input"];
  radius: InputMaybe<Scalars["Float"]["input"]>;
};

export type CreateStepInput = {
  id: InputMaybe<Scalars["String"]["input"]>;
  taskId: Scalars["String"]["input"];
  title: Scalars["String"]["input"];
};

export type CreateTagInput = {
  color: InputMaybe<Scalars["String"]["input"]>;
  deviceContext: InputMaybe<Scalars["String"]["input"]>;
  id: InputMaybe<Scalars["String"]["input"]>;
  locationId: InputMaybe<Scalars["String"]["input"]>;
  locationRadius: InputMaybe<Scalars["Float"]["input"]>;
  name: Scalars["String"]["input"];
};

export type CreateTaskInput = {
  deviceContext: InputMaybe<Scalars["String"]["input"]>;
  dueDate: InputMaybe<Scalars["String"]["input"]>;
  id: InputMaybe<Scalars["String"]["input"]>;
  listId: Scalars["String"]["input"];
  locationId: InputMaybe<Scalars["String"]["input"]>;
  locationRadius: InputMaybe<Scalars["Float"]["input"]>;
  notes: InputMaybe<Scalars["String"]["input"]>;
  title: Scalars["String"]["input"];
};

export type ImportTaskInput = {
  dueDate: InputMaybe<Scalars["String"]["input"]>;
  isCompleted: InputMaybe<Scalars["Boolean"]["input"]>;
  listName: InputMaybe<Scalars["String"]["input"]>;
  notes: InputMaybe<Scalars["String"]["input"]>;
  title: Scalars["String"]["input"];
};

export type ImportTasksResult = {
  __typename?: "ImportTasksResult";
  createdLists: Maybe<Array<Scalars["String"]["output"]>>;
  importedCount: Maybe<Scalars["Int"]["output"]>;
};

export type List = {
  __typename?: "List";
  createdAt: Maybe<Scalars["String"]["output"]>;
  deviceContext: Maybe<Scalars["String"]["output"]>;
  groupId: Maybe<Scalars["String"]["output"]>;
  icon: Maybe<Scalars["String"]["output"]>;
  id: Maybe<Scalars["String"]["output"]>;
  isDefault: Maybe<Scalars["Boolean"]["output"]>;
  location: Maybe<Location>;
  locationId: Maybe<Scalars["String"]["output"]>;
  locationRadius: Maybe<Scalars["Float"]["output"]>;
  name: Maybe<Scalars["String"]["output"]>;
  sortOrder: Maybe<Scalars["Int"]["output"]>;
  taskCount: Maybe<Scalars["Int"]["output"]>;
  tasks: Maybe<Array<Task>>;
  themeColor: Maybe<Scalars["String"]["output"]>;
  visibleTaskCount: Maybe<Scalars["Int"]["output"]>;
};

export type ListGroup = {
  __typename?: "ListGroup";
  createdAt: Maybe<Scalars["String"]["output"]>;
  id: Maybe<Scalars["String"]["output"]>;
  isExpanded: Maybe<Scalars["Boolean"]["output"]>;
  lists: Maybe<Array<List>>;
  name: Maybe<Scalars["String"]["output"]>;
  sortOrder: Maybe<Scalars["Int"]["output"]>;
};

export type Location = {
  __typename?: "Location";
  address: Maybe<Scalars["String"]["output"]>;
  createdAt: Maybe<Scalars["String"]["output"]>;
  id: Maybe<Scalars["String"]["output"]>;
  latitude: Maybe<Scalars["Float"]["output"]>;
  longitude: Maybe<Scalars["Float"]["output"]>;
  name: Maybe<Scalars["String"]["output"]>;
  radius: Maybe<Scalars["Float"]["output"]>;
};

export type Mutation = {
  __typename?: "Mutation";
  addTagToTask: Maybe<Scalars["Boolean"]["output"]>;
  completeOnboarding: Maybe<Scalars["Boolean"]["output"]>;
  convertTaskToList: Maybe<List>;
  createList: Maybe<List>;
  createListGroup: Maybe<ListGroup>;
  createLocation: Maybe<Location>;
  createStep: Maybe<Step>;
  createTag: Maybe<Tag>;
  createTask: Maybe<Task>;
  deleteList: Maybe<Scalars["Boolean"]["output"]>;
  deleteListGroup: Maybe<Scalars["Boolean"]["output"]>;
  deleteLocation: Maybe<Scalars["Boolean"]["output"]>;
  deleteStep: Maybe<Scalars["Boolean"]["output"]>;
  deleteTag: Maybe<Scalars["Boolean"]["output"]>;
  deleteTask: Maybe<Scalars["Boolean"]["output"]>;
  getCalendarToken: Maybe<Scalars["String"]["output"]>;
  importTasks: Maybe<ImportTasksResult>;
  regenerateCalendarToken: Maybe<Scalars["String"]["output"]>;
  register: Maybe<User>;
  removeTagFromTask: Maybe<Scalars["Boolean"]["output"]>;
  reorderLists: Maybe<Scalars["Boolean"]["output"]>;
  reorderSteps: Maybe<Scalars["Boolean"]["output"]>;
  reorderTasks: Maybe<Scalars["Boolean"]["output"]>;
  skipOnboarding: Maybe<Scalars["Boolean"]["output"]>;
  toggleStepCompleted: Maybe<Step>;
  toggleTaskCompleted: Maybe<Task>;
  updateCalendarSyncAll: Maybe<Scalars["Boolean"]["output"]>;
  updateList: Maybe<List>;
  updateListGroup: Maybe<ListGroup>;
  updateLocation: Maybe<Location>;
  updateStep: Maybe<Step>;
  updateTag: Maybe<Tag>;
  updateTask: Maybe<Task>;
};

export type MutationAddTagToTaskArgs = {
  tagId: Scalars["String"]["input"];
  taskId: Scalars["String"]["input"];
};

export type MutationCompleteOnboardingArgs = {
  input: CompleteOnboardingInput;
};

export type MutationConvertTaskToListArgs = {
  taskId: Scalars["String"]["input"];
};

export type MutationCreateListArgs = {
  input: CreateListInput;
};

export type MutationCreateListGroupArgs = {
  input: CreateListGroupInput;
};

export type MutationCreateLocationArgs = {
  input: CreateLocationInput;
};

export type MutationCreateStepArgs = {
  input: CreateStepInput;
};

export type MutationCreateTagArgs = {
  input: CreateTagInput;
};

export type MutationCreateTaskArgs = {
  input: CreateTaskInput;
};

export type MutationDeleteListArgs = {
  id: Scalars["String"]["input"];
};

export type MutationDeleteListGroupArgs = {
  id: Scalars["String"]["input"];
};

export type MutationDeleteLocationArgs = {
  id: Scalars["String"]["input"];
};

export type MutationDeleteStepArgs = {
  id: Scalars["String"]["input"];
};

export type MutationDeleteTagArgs = {
  id: Scalars["String"]["input"];
};

export type MutationDeleteTaskArgs = {
  id: Scalars["String"]["input"];
};

export type MutationImportTasksArgs = {
  input: Array<ImportTaskInput>;
};

export type MutationRegisterArgs = {
  input: RegisterInput;
};

export type MutationRemoveTagFromTaskArgs = {
  tagId: Scalars["String"]["input"];
  taskId: Scalars["String"]["input"];
};

export type MutationReorderListsArgs = {
  input: Array<ReorderListInput>;
};

export type MutationReorderStepsArgs = {
  taskId: Scalars["String"]["input"];
  input: Array<ReorderStepInput>;
};

export type MutationReorderTasksArgs = {
  input: Array<ReorderTaskInput>;
};

export type MutationToggleStepCompletedArgs = {
  id: Scalars["String"]["input"];
};

export type MutationToggleTaskCompletedArgs = {
  id: Scalars["String"]["input"];
};

export type MutationUpdateCalendarSyncAllArgs = {
  syncAll: Scalars["Boolean"]["input"];
};

export type MutationUpdateListArgs = {
  id: Scalars["String"]["input"];
  input: UpdateListInput;
};

export type MutationUpdateListGroupArgs = {
  id: Scalars["String"]["input"];
  name: Scalars["String"]["input"];
};

export type MutationUpdateLocationArgs = {
  id: Scalars["String"]["input"];
  input: UpdateLocationInput;
};

export type MutationUpdateStepArgs = {
  id: Scalars["String"]["input"];
  title: Scalars["String"]["input"];
};

export type MutationUpdateTagArgs = {
  id: Scalars["String"]["input"];
  input: UpdateTagInput;
};

export type MutationUpdateTaskArgs = {
  id: Scalars["String"]["input"];
  input: UpdateTaskInput;
};

export type OnboardingListInput = {
  deviceContext: InputMaybe<Scalars["String"]["input"]>;
  icon: InputMaybe<Scalars["String"]["input"]>;
  location: InputMaybe<OnboardingLocationInput>;
  name: Scalars["String"]["input"];
};

export type OnboardingLocationInput = {
  address: InputMaybe<Scalars["String"]["input"]>;
  latitude: Scalars["Float"]["input"];
  longitude: Scalars["Float"]["input"];
  name: Scalars["String"]["input"];
};

export type Query = {
  __typename?: "Query";
  allTasks: Maybe<Array<Task>>;
  allTasksWithLocation: Maybe<Array<Task>>;
  calendarSyncAll: Maybe<Scalars["Boolean"]["output"]>;
  completedTasks: Maybe<CompletedTasksConnection>;
  contextTasks: Maybe<Array<Task>>;
  futureTasks: Maybe<Array<Task>>;
  list: Maybe<List>;
  listGroups: Maybe<Array<ListGroup>>;
  lists: Maybe<Array<List>>;
  location: Maybe<Location>;
  locations: Maybe<Array<Location>>;
  me: Maybe<User>;
  plannedTasks: Maybe<Array<Task>>;
  searchTasks: Maybe<Array<Task>>;
  tags: Maybe<Array<Tag>>;
  task: Maybe<Task>;
  tasksByList: Maybe<Array<Task>>;
  tasksByTag: Maybe<Array<Task>>;
  visibleTasks: Maybe<Array<Task>>;
};

export type QueryAllTasksWithLocationArgs = {
  limit: InputMaybe<Scalars["Int"]["input"]>;
  offset: InputMaybe<Scalars["Int"]["input"]>;
};

export type QueryCompletedTasksArgs = {
  limit: Scalars["Int"]["input"];
  offset: InputMaybe<Scalars["Int"]["input"]>;
};

export type QueryContextTasksArgs = {
  deviceContext: InputMaybe<Scalars["String"]["input"]>;
  nearbyLocationIds: InputMaybe<Array<Scalars["String"]["input"]>>;
};

export type QueryListArgs = {
  id: Scalars["String"]["input"];
};

export type QueryLocationArgs = {
  id: Scalars["String"]["input"];
};

export type QueryPlannedTasksArgs = {
  limit: InputMaybe<Scalars["Int"]["input"]>;
  offset: InputMaybe<Scalars["Int"]["input"]>;
};

export type QuerySearchTasksArgs = {
  query: Scalars["String"]["input"];
  tagIds: InputMaybe<Array<Scalars["String"]["input"]>>;
};

export type QueryTaskArgs = {
  id: Scalars["String"]["input"];
};

export type QueryTasksByListArgs = {
  limit: InputMaybe<Scalars["Int"]["input"]>;
  listId: Scalars["String"]["input"];
  offset: InputMaybe<Scalars["Int"]["input"]>;
};

export type QueryTasksByTagArgs = {
  tagId: Scalars["String"]["input"];
};

export type QueryVisibleTasksArgs = {
  listId: InputMaybe<Scalars["String"]["input"]>;
};

export type RegisterInput = {
  email: Scalars["String"]["input"];
  name: Scalars["String"]["input"];
  password: Scalars["String"]["input"];
};

export type ReorderListInput = {
  id: Scalars["String"]["input"];
  sortOrder: Scalars["Int"]["input"];
};

export type ReorderStepInput = {
  id: Scalars["String"]["input"];
  sortOrder: Scalars["Int"]["input"];
};

export type ReorderTaskInput = {
  id: Scalars["String"]["input"];
  sortOrder: Scalars["Int"]["input"];
};

export type Step = {
  __typename?: "Step";
  createdAt: Maybe<Scalars["String"]["output"]>;
  id: Maybe<Scalars["String"]["output"]>;
  isCompleted: Maybe<Scalars["Boolean"]["output"]>;
  sortOrder: Maybe<Scalars["Int"]["output"]>;
  taskId: Maybe<Scalars["String"]["output"]>;
  title: Maybe<Scalars["String"]["output"]>;
};

export type Tag = {
  __typename?: "Tag";
  color: Maybe<Scalars["String"]["output"]>;
  createdAt: Maybe<Scalars["String"]["output"]>;
  deviceContext: Maybe<Scalars["String"]["output"]>;
  id: Maybe<Scalars["String"]["output"]>;
  location: Maybe<Location>;
  locationId: Maybe<Scalars["String"]["output"]>;
  locationRadius: Maybe<Scalars["Float"]["output"]>;
  name: Maybe<Scalars["String"]["output"]>;
  taskCount: Maybe<Scalars["Int"]["output"]>;
};

export type Task = {
  __typename?: "Task";
  blockedByTask: Maybe<Task>;
  blockedByTaskId: Maybe<Scalars["String"]["output"]>;
  blockedByTaskIsCompleted: Maybe<Scalars["Boolean"]["output"]>;
  completedAt: Maybe<Scalars["String"]["output"]>;
  createdAt: Maybe<Scalars["String"]["output"]>;
  dependentTaskCount: Maybe<Scalars["Int"]["output"]>;
  deviceContext: Maybe<Scalars["String"]["output"]>;
  dueDate: Maybe<Scalars["String"]["output"]>;
  forceCalendarSync: Maybe<Scalars["Boolean"]["output"]>;
  id: Maybe<Scalars["String"]["output"]>;
  isCompleted: Maybe<Scalars["Boolean"]["output"]>;
  list: Maybe<List>;
  listId: Maybe<Scalars["String"]["output"]>;
  location: Maybe<Location>;
  locationId: Maybe<Scalars["String"]["output"]>;
  locationRadius: Maybe<Scalars["Float"]["output"]>;
  notes: Maybe<Scalars["String"]["output"]>;
  recurrence: Maybe<Scalars["String"]["output"]>;
  reminderAt: Maybe<Scalars["String"]["output"]>;
  sortOrder: Maybe<Scalars["Int"]["output"]>;
  steps: Maybe<Array<Step>>;
  tags: Maybe<Array<Tag>>;
  title: Maybe<Scalars["String"]["output"]>;
};

export type UpdateListInput = {
  deviceContext: InputMaybe<Scalars["String"]["input"]>;
  groupId: InputMaybe<Scalars["String"]["input"]>;
  icon: InputMaybe<Scalars["String"]["input"]>;
  locationId: InputMaybe<Scalars["String"]["input"]>;
  locationRadius: InputMaybe<Scalars["Float"]["input"]>;
  name: InputMaybe<Scalars["String"]["input"]>;
  themeColor: InputMaybe<Scalars["String"]["input"]>;
};

export type UpdateLocationInput = {
  address: InputMaybe<Scalars["String"]["input"]>;
  latitude: InputMaybe<Scalars["Float"]["input"]>;
  longitude: InputMaybe<Scalars["Float"]["input"]>;
  name: InputMaybe<Scalars["String"]["input"]>;
  radius: InputMaybe<Scalars["Float"]["input"]>;
};

export type UpdateTagInput = {
  color: InputMaybe<Scalars["String"]["input"]>;
  deviceContext: InputMaybe<Scalars["String"]["input"]>;
  locationId: InputMaybe<Scalars["String"]["input"]>;
  locationRadius: InputMaybe<Scalars["Float"]["input"]>;
  name: InputMaybe<Scalars["String"]["input"]>;
};

export type UpdateTaskInput = {
  blockedByTaskId: InputMaybe<Scalars["String"]["input"]>;
  deviceContext: InputMaybe<Scalars["String"]["input"]>;
  dueDate: InputMaybe<Scalars["String"]["input"]>;
  forceCalendarSync: InputMaybe<Scalars["Boolean"]["input"]>;
  listId: InputMaybe<Scalars["String"]["input"]>;
  locationId: InputMaybe<Scalars["String"]["input"]>;
  locationRadius: InputMaybe<Scalars["Float"]["input"]>;
  notes: InputMaybe<Scalars["String"]["input"]>;
  recurrence: InputMaybe<Scalars["String"]["input"]>;
  reminderAt: InputMaybe<Scalars["String"]["input"]>;
  title: InputMaybe<Scalars["String"]["input"]>;
};

export type User = {
  __typename?: "User";
  createdAt: Maybe<Scalars["String"]["output"]>;
  email: Maybe<Scalars["String"]["output"]>;
  id: Maybe<Scalars["String"]["output"]>;
  image: Maybe<Scalars["String"]["output"]>;
  name: Maybe<Scalars["String"]["output"]>;
};

export type GetCalendarTokenMutationVariables = Exact<{ [key: string]: never }>;

export type GetCalendarTokenMutation = { __typename?: "Mutation"; getCalendarToken: string | null };

export type RegenerateCalendarTokenMutationVariables = Exact<{ [key: string]: never }>;

export type RegenerateCalendarTokenMutation = {
  __typename?: "Mutation";
  regenerateCalendarToken: string | null;
};

export type UpdateCalendarSyncAllMutationVariables = Exact<{
  syncAll: Scalars["Boolean"]["input"];
}>;

export type UpdateCalendarSyncAllMutation = {
  __typename?: "Mutation";
  updateCalendarSyncAll: boolean | null;
};

export type CreateListMutationVariables = Exact<{
  input: CreateListInput;
}>;

export type CreateListMutation = {
  __typename?: "Mutation";
  createList: {
    __typename?: "List";
    id: string | null;
    name: string | null;
    icon: string | null;
    themeColor: string | null;
    isDefault: boolean | null;
    sortOrder: number | null;
    groupId: string | null;
    deviceContext: string | null;
    taskCount: number | null;
  } | null;
};

export type UpdateListMutationVariables = Exact<{
  id: Scalars["String"]["input"];
  input: UpdateListInput;
}>;

export type UpdateListMutation = {
  __typename?: "Mutation";
  updateList: {
    __typename?: "List";
    id: string | null;
    name: string | null;
    icon: string | null;
    themeColor: string | null;
    groupId: string | null;
    deviceContext: string | null;
  } | null;
};

export type DeleteListMutationVariables = Exact<{
  id: Scalars["String"]["input"];
}>;

export type DeleteListMutation = { __typename?: "Mutation"; deleteList: boolean | null };

export type ReorderListsMutationVariables = Exact<{
  input: Array<ReorderListInput> | ReorderListInput;
}>;

export type ReorderListsMutation = { __typename?: "Mutation"; reorderLists: boolean | null };

export type CreateLocationMutationVariables = Exact<{
  input: CreateLocationInput;
}>;

export type CreateLocationMutation = {
  __typename?: "Mutation";
  createLocation: {
    __typename?: "Location";
    id: string | null;
    name: string | null;
    latitude: number | null;
    longitude: number | null;
    address: string | null;
  } | null;
};

export type UpdateLocationMutationVariables = Exact<{
  id: Scalars["String"]["input"];
  input: UpdateLocationInput;
}>;

export type UpdateLocationMutation = {
  __typename?: "Mutation";
  updateLocation: {
    __typename?: "Location";
    id: string | null;
    name: string | null;
    latitude: number | null;
    longitude: number | null;
    address: string | null;
  } | null;
};

export type DeleteLocationMutationVariables = Exact<{
  id: Scalars["String"]["input"];
}>;

export type DeleteLocationMutation = { __typename?: "Mutation"; deleteLocation: boolean | null };

export type CreateStepMutationVariables = Exact<{
  input: CreateStepInput;
}>;

export type CreateStepMutation = {
  __typename?: "Mutation";
  createStep: {
    __typename?: "Step";
    id: string | null;
    taskId: string | null;
    title: string | null;
    isCompleted: boolean | null;
    sortOrder: number | null;
  } | null;
};

export type UpdateStepMutationVariables = Exact<{
  id: Scalars["String"]["input"];
  title: Scalars["String"]["input"];
}>;

export type UpdateStepMutation = {
  __typename?: "Mutation";
  updateStep: { __typename?: "Step"; id: string | null; title: string | null } | null;
};

export type DeleteStepMutationVariables = Exact<{
  id: Scalars["String"]["input"];
}>;

export type DeleteStepMutation = { __typename?: "Mutation"; deleteStep: boolean | null };

export type ToggleStepCompletedMutationVariables = Exact<{
  id: Scalars["String"]["input"];
}>;

export type ToggleStepCompletedMutation = {
  __typename?: "Mutation";
  toggleStepCompleted: {
    __typename?: "Step";
    id: string | null;
    isCompleted: boolean | null;
  } | null;
};

export type CreateTaskMutationVariables = Exact<{
  input: CreateTaskInput;
}>;

export type CreateTaskMutation = {
  __typename?: "Mutation";
  createTask: {
    __typename?: "Task";
    id: string | null;
    listId: string | null;
    title: string | null;
    notes: string | null;
    isCompleted: boolean | null;
    dueDate: string | null;
    sortOrder: number | null;
    createdAt: string | null;
    steps: Array<{
      __typename?: "Step";
      id: string | null;
      taskId: string | null;
      title: string | null;
      isCompleted: boolean | null;
      sortOrder: number | null;
    }> | null;
  } | null;
};

export type UpdateTaskMutationVariables = Exact<{
  id: Scalars["String"]["input"];
  input: UpdateTaskInput;
}>;

export type UpdateTaskMutation = {
  __typename?: "Mutation";
  updateTask: {
    __typename?: "Task";
    id: string | null;
    title: string | null;
    notes: string | null;
    dueDate: string | null;
    reminderAt: string | null;
    recurrence: string | null;
    deviceContext: string | null;
    listId: string | null;
  } | null;
};

export type DeleteTaskMutationVariables = Exact<{
  id: Scalars["String"]["input"];
}>;

export type DeleteTaskMutation = { __typename?: "Mutation"; deleteTask: boolean | null };

export type ToggleTaskCompletedMutationVariables = Exact<{
  id: Scalars["String"]["input"];
}>;

export type ToggleTaskCompletedMutation = {
  __typename?: "Mutation";
  toggleTaskCompleted: {
    __typename?: "Task";
    id: string | null;
    isCompleted: boolean | null;
    completedAt: string | null;
  } | null;
};

export type ReorderTasksMutationVariables = Exact<{
  input: Array<ReorderTaskInput> | ReorderTaskInput;
}>;

export type ReorderTasksMutation = { __typename?: "Mutation"; reorderTasks: boolean | null };

export type ReorderStepsMutationVariables = Exact<{
  taskId: Scalars["String"]["input"];
  input: Array<ReorderStepInput> | ReorderStepInput;
}>;

export type ReorderStepsMutation = { __typename?: "Mutation"; reorderSteps: boolean | null };

export type ImportTasksMutationVariables = Exact<{
  input: Array<ImportTaskInput> | ImportTaskInput;
}>;

export type ImportTasksMutation = {
  __typename?: "Mutation";
  importTasks: {
    __typename?: "ImportTasksResult";
    importedCount: number | null;
    createdLists: Array<string> | null;
  } | null;
};

export type CalendarSyncAllQueryVariables = Exact<{ [key: string]: never }>;

export type CalendarSyncAllQuery = { __typename?: "Query"; calendarSyncAll: boolean | null };

export type GetListsQueryVariables = Exact<{ [key: string]: never }>;

export type GetListsQuery = {
  __typename?: "Query";
  lists: Array<{
    __typename?: "List";
    id: string | null;
    name: string | null;
    icon: string | null;
    themeColor: string | null;
    isDefault: boolean | null;
    sortOrder: number | null;
    groupId: string | null;
    deviceContext: string | null;
    taskCount: number | null;
  }> | null;
};

export type GetListQueryVariables = Exact<{
  id: Scalars["String"]["input"];
}>;

export type GetListQuery = {
  __typename?: "Query";
  list: {
    __typename?: "List";
    id: string | null;
    name: string | null;
    icon: string | null;
    themeColor: string | null;
    isDefault: boolean | null;
  } | null;
};

export type GetListGroupsQueryVariables = Exact<{ [key: string]: never }>;

export type GetListGroupsQuery = {
  __typename?: "Query";
  listGroups: Array<{
    __typename?: "ListGroup";
    id: string | null;
    name: string | null;
    sortOrder: number | null;
    isExpanded: boolean | null;
    lists: Array<{
      __typename?: "List";
      id: string | null;
      name: string | null;
      sortOrder: number | null;
    }> | null;
  }> | null;
};

export type GetLocationsQueryVariables = Exact<{ [key: string]: never }>;

export type GetLocationsQuery = {
  __typename?: "Query";
  locations: Array<{
    __typename?: "Location";
    id: string | null;
    name: string | null;
    latitude: number | null;
    longitude: number | null;
    address: string | null;
  }> | null;
};

export type AllTasksWithLocationQueryVariables = Exact<{ [key: string]: never }>;

export type AllTasksWithLocationQuery = {
  __typename?: "Query";
  allTasksWithLocation: Array<{
    __typename?: "Task";
    id: string | null;
    listId: string | null;
    locationId: string | null;
    title: string | null;
    notes: string | null;
    isCompleted: boolean | null;
    completedAt: string | null;
    dueDate: string | null;
    reminderAt: string | null;
    sortOrder: number | null;
    createdAt: string | null;
    location: {
      __typename?: "Location";
      id: string | null;
      name: string | null;
      latitude: number | null;
      longitude: number | null;
    } | null;
    list: { __typename?: "List"; id: string | null; name: string | null } | null;
    steps: Array<{
      __typename?: "Step";
      id: string | null;
      taskId: string | null;
      title: string | null;
      isCompleted: boolean | null;
      sortOrder: number | null;
    }> | null;
  }> | null;
};

export type TaskFieldsFragment = {
  __typename?: "Task";
  id: string | null;
  listId: string | null;
  title: string | null;
  notes: string | null;
  isCompleted: boolean | null;
  completedAt: string | null;
  dueDate: string | null;
  reminderAt: string | null;
  recurrence: string | null;
  deviceContext: string | null;
  sortOrder: number | null;
  createdAt: string | null;
  steps: Array<{
    __typename?: "Step";
    id: string | null;
    taskId: string | null;
    title: string | null;
    isCompleted: boolean | null;
    sortOrder: number | null;
  }> | null;
};

export type TasksByListQueryVariables = Exact<{
  listId: Scalars["String"]["input"];
}>;

export type TasksByListQuery = {
  __typename?: "Query";
  tasksByList: Array<{
    __typename?: "Task";
    id: string | null;
    listId: string | null;
    title: string | null;
    notes: string | null;
    isCompleted: boolean | null;
    completedAt: string | null;
    dueDate: string | null;
    reminderAt: string | null;
    recurrence: string | null;
    deviceContext: string | null;
    sortOrder: number | null;
    createdAt: string | null;
    steps: Array<{
      __typename?: "Step";
      id: string | null;
      taskId: string | null;
      title: string | null;
      isCompleted: boolean | null;
      sortOrder: number | null;
    }> | null;
  }> | null;
};

export type GetTaskQueryVariables = Exact<{
  id: Scalars["String"]["input"];
}>;

export type GetTaskQuery = {
  __typename?: "Query";
  task: {
    __typename?: "Task";
    id: string | null;
    listId: string | null;
    title: string | null;
    notes: string | null;
    isCompleted: boolean | null;
    completedAt: string | null;
    dueDate: string | null;
    reminderAt: string | null;
    recurrence: string | null;
    deviceContext: string | null;
    sortOrder: number | null;
    createdAt: string | null;
    list: { __typename?: "List"; id: string | null; name: string | null } | null;
    steps: Array<{
      __typename?: "Step";
      id: string | null;
      taskId: string | null;
      title: string | null;
      isCompleted: boolean | null;
      sortOrder: number | null;
    }> | null;
  } | null;
};

export type PlannedTasksQueryVariables = Exact<{ [key: string]: never }>;

export type PlannedTasksQuery = {
  __typename?: "Query";
  plannedTasks: Array<{
    __typename?: "Task";
    id: string | null;
    listId: string | null;
    title: string | null;
    notes: string | null;
    isCompleted: boolean | null;
    completedAt: string | null;
    dueDate: string | null;
    reminderAt: string | null;
    recurrence: string | null;
    deviceContext: string | null;
    sortOrder: number | null;
    createdAt: string | null;
    list: { __typename?: "List"; id: string | null; name: string | null } | null;
    steps: Array<{
      __typename?: "Step";
      id: string | null;
      taskId: string | null;
      title: string | null;
      isCompleted: boolean | null;
      sortOrder: number | null;
    }> | null;
  }> | null;
};

export type GetMeQueryVariables = Exact<{ [key: string]: never }>;

export type GetMeQuery = {
  __typename?: "Query";
  me: {
    __typename?: "User";
    id: string | null;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
};

export type AcceptConnectionInviteMutationVariables = Exact<{
  token: Scalars["String"]["input"];
}>;

export type AcceptConnectionInviteMutation = {
  __typename?: "Mutation";
  acceptConnectionInvite: boolean | null;
};
