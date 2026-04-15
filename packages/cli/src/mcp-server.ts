import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { gql, setMcpMode } from "./lib/client.js";

const TASK_FIELDS = `
  id listId title notes isCompleted completedAt dueDate dueDateEnd
  reminderAt recurrence sortOrder createdAt
  steps { id taskId title isCompleted sortOrder }
`;

type McpTextResult = { content: { type: "text"; text: string }[] };

function jsonText(data: unknown): McpTextResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

async function callGql<T>(query: string, variables?: Record<string, unknown>): Promise<McpTextResult> {
  try {
    const data = await gql<T>(query, variables);
    return jsonText(data);
  } catch (err) {
    // gql() calls process.exit on errors, but in MCP mode we want to return errors instead
    // This catch is a safety net for any non-exit errors
    return jsonText({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function startMcpServer(): Promise<void> {
  setMcpMode(true);

  const server = new McpServer({
    name: "sweptmind",
    version: "0.2.0",
  });

  // === Auth ===

  server.tool("whoami", "Show the currently logged-in user", {}, async () => {
    return callGql(`query { me { id name email isPremium } }`);
  });

  // === Tasks ===

  server.tool(
    "task_list",
    "List tasks, optionally filtered by list, planned view, or completion status",
    {
      listId: z.string().optional().describe("Filter by list ID"),
      planned: z.boolean().optional().describe("Show planned tasks (tasks with due dates)"),
      completed: z.boolean().optional().describe("Include completed tasks"),
    },
    async ({ listId, planned, completed }) => {
      try {
        let data: unknown;
        if (planned) {
          data = await gql(`query { plannedTasks { ${TASK_FIELDS} list { id name } } }`);
        } else if (listId) {
          data = await gql(`query($listId: String!) { tasksByList(listId: $listId) { ${TASK_FIELDS} } }`, { listId });
        } else {
          data = await gql(`query { plannedTasks { ${TASK_FIELDS} list { id name } } }`);
        }

        if (!completed && data && typeof data === "object") {
          const d = data as Record<string, unknown[]>;
          const key = Object.keys(d)[0];
          if (Array.isArray(d[key])) {
            d[key] = d[key].filter((t: any) => !t.isCompleted);
          }
        }

        return jsonText(data);
      } catch (err) {
        return jsonText({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  );

  server.tool(
    "task_show",
    "Show task detail including steps",
    {
      id: z.string().describe("Task ID"),
    },
    async ({ id }) => {
      return callGql(`query($id: String!) { task(id: $id) { ${TASK_FIELDS} list { id name } } }`, { id });
    },
  );

  server.tool(
    "task_add",
    "Create a new task",
    {
      title: z.string().describe("Task title"),
      listId: z.string().describe("List ID to add the task to"),
      dueDate: z.string().optional().describe("Due date (YYYY-MM-DD)"),
      reminder: z.string().optional().describe("Reminder datetime (YYYY-MM-DDTHH:mm)"),
      notes: z.string().optional().describe("Task notes"),
    },
    async ({ title, listId, dueDate, reminder, notes }) => {
      const input: Record<string, unknown> = { title, listId };
      if (dueDate) input.dueDate = dueDate;
      if (reminder) input.reminderAt = reminder;
      if (notes) input.notes = notes;
      return callGql(`mutation($input: CreateTaskInput!) { createTask(input: $input) { ${TASK_FIELDS} } }`, { input });
    },
  );

  server.tool(
    "task_edit",
    "Edit an existing task",
    {
      id: z.string().describe("Task ID"),
      title: z.string().optional().describe("New title"),
      notes: z.string().optional().describe("New notes"),
      dueDate: z.string().optional().describe("New due date (YYYY-MM-DD)"),
      reminder: z.string().optional().describe("New reminder (YYYY-MM-DDTHH:mm)"),
    },
    async ({ id, title, notes, dueDate, reminder }) => {
      const input: Record<string, unknown> = {};
      if (title) input.title = title;
      if (notes) input.notes = notes;
      if (dueDate) input.dueDate = dueDate;
      if (reminder) input.reminderAt = reminder;
      return callGql(`mutation($id: String!, $input: UpdateTaskInput!) { updateTask(id: $id, input: $input) { id title } }`, { id, input });
    },
  );

  server.tool(
    "task_complete",
    "Mark a task as completed",
    {
      id: z.string().describe("Task ID"),
    },
    async ({ id }) => {
      return callGql(`mutation($id: String!) { toggleTaskCompleted(id: $id) { id isCompleted } }`, { id });
    },
  );

  server.tool(
    "task_uncomplete",
    "Mark a task as not completed",
    {
      id: z.string().describe("Task ID"),
    },
    async ({ id }) => {
      return callGql(`mutation($id: String!) { toggleTaskCompleted(id: $id) { id isCompleted } }`, { id });
    },
  );

  server.tool(
    "task_delete",
    "Delete a task",
    {
      id: z.string().describe("Task ID"),
    },
    async ({ id }) => {
      return callGql(`mutation($id: String!) { deleteTask(id: $id) }`, { id });
    },
  );

  server.tool(
    "task_move",
    "Move a task to a different list",
    {
      id: z.string().describe("Task ID"),
      listId: z.string().describe("Target list ID"),
    },
    async ({ id, listId }) => {
      return callGql(`mutation($id: String!, $input: UpdateTaskInput!) { updateTask(id: $id, input: $input) { id listId } }`, { id, input: { listId } });
    },
  );

  server.tool(
    "task_clone",
    "Clone a task",
    {
      id: z.string().describe("Task ID"),
    },
    async ({ id }) => {
      return callGql(`mutation($id: String!) { cloneTask(id: $id) { id title } }`, { id });
    },
  );

  // === Steps ===

  server.tool(
    "step_add",
    "Add a step (subtask) to a task",
    {
      taskId: z.string().describe("Parent task ID"),
      title: z.string().describe("Step title"),
    },
    async ({ taskId, title }) => {
      return callGql(
        `mutation($input: CreateStepInput!) { createStep(input: $input) { id taskId title isCompleted sortOrder } }`,
        { input: { taskId, title } },
      );
    },
  );

  server.tool(
    "step_list",
    "List steps of a task",
    {
      taskId: z.string().describe("Task ID"),
    },
    async ({ taskId }) => {
      return callGql(
        `query($id: String!) { task(id: $id) { steps { id taskId title isCompleted sortOrder } } }`,
        { id: taskId },
      );
    },
  );

  server.tool(
    "step_complete",
    "Toggle step completion",
    {
      id: z.string().describe("Step ID"),
    },
    async ({ id }) => {
      return callGql(`mutation($id: String!) { toggleStepCompleted(id: $id) { id isCompleted } }`, { id });
    },
  );

  server.tool(
    "step_delete",
    "Delete a step",
    {
      id: z.string().describe("Step ID"),
    },
    async ({ id }) => {
      return callGql(`mutation($id: String!) { deleteStep(id: $id) }`, { id });
    },
  );

  // === Lists ===

  server.tool("list_ls", "List all task lists", {}, async () => {
    return callGql(`query { lists { id name icon themeColor isDefault sortOrder groupId taskCount } }`);
  });

  server.tool(
    "list_create",
    "Create a new task list",
    {
      name: z.string().describe("List name"),
      icon: z.string().optional().describe("Emoji icon"),
    },
    async ({ name, icon }) => {
      const input: Record<string, unknown> = { name };
      if (icon) input.icon = icon;
      return callGql(`mutation($input: CreateListInput!) { createList(input: $input) { id name icon } }`, { input });
    },
  );

  server.tool(
    "list_show",
    "Show list detail",
    {
      id: z.string().describe("List ID"),
    },
    async ({ id }) => {
      return callGql(`query($id: String!) { list(id: $id) { id name icon themeColor isDefault } }`, { id });
    },
  );

  server.tool(
    "list_edit",
    "Edit a list",
    {
      id: z.string().describe("List ID"),
      name: z.string().optional().describe("New name"),
      icon: z.string().optional().describe("New icon"),
    },
    async ({ id, name, icon }) => {
      const input: Record<string, unknown> = {};
      if (name) input.name = name;
      if (icon) input.icon = icon;
      return callGql(`mutation($id: String!, $input: UpdateListInput!) { updateList(id: $id, input: $input) { id } }`, { id, input });
    },
  );

  server.tool(
    "list_delete",
    "Delete a list",
    {
      id: z.string().describe("List ID"),
    },
    async ({ id }) => {
      return callGql(`mutation($id: String!) { deleteList(id: $id) }`, { id });
    },
  );

  // === Groups ===

  server.tool("group_ls", "List all list groups", {}, async () => {
    return callGql(`query { listGroups { id name sortOrder lists { id name } } }`);
  });

  server.tool(
    "group_create",
    "Create a list group",
    {
      name: z.string().describe("Group name"),
    },
    async ({ name }) => {
      return callGql(`mutation($input: CreateListGroupInput!) { createListGroup(input: $input) { id name } }`, { input: { name } });
    },
  );

  server.tool(
    "group_delete",
    "Delete a list group",
    {
      id: z.string().describe("Group ID"),
    },
    async ({ id }) => {
      return callGql(`mutation($id: String!) { deleteListGroup(id: $id) }`, { id });
    },
  );

  // === Locations ===

  server.tool("location_ls", "List all saved locations", {}, async () => {
    return callGql(`query { locations { id name latitude longitude address } }`);
  });

  server.tool(
    "location_create",
    "Create a new location",
    {
      name: z.string().describe("Location name"),
      lat: z.number().describe("Latitude"),
      lng: z.number().describe("Longitude"),
      radius: z.number().optional().describe("Radius in meters"),
      address: z.string().optional().describe("Address"),
    },
    async ({ name, lat, lng, radius, address }) => {
      const input: Record<string, unknown> = { name, latitude: lat, longitude: lng };
      if (radius) input.radius = radius;
      if (address) input.address = address;
      return callGql(
        `mutation($input: CreateLocationInput!) { createLocation(input: $input) { id name latitude longitude address } }`,
        { input },
      );
    },
  );

  server.tool(
    "location_edit",
    "Edit a location",
    {
      id: z.string().describe("Location ID"),
      name: z.string().optional().describe("New name"),
      lat: z.number().optional().describe("New latitude"),
      lng: z.number().optional().describe("New longitude"),
      address: z.string().optional().describe("New address"),
    },
    async ({ id, name, lat, lng, address }) => {
      const input: Record<string, unknown> = {};
      if (name) input.name = name;
      if (lat !== undefined) input.latitude = lat;
      if (lng !== undefined) input.longitude = lng;
      if (address) input.address = address;
      return callGql(`mutation($id: String!, $input: UpdateLocationInput!) { updateLocation(id: $id, input: $input) { id } }`, { id, input });
    },
  );

  server.tool(
    "location_delete",
    "Delete a location",
    {
      id: z.string().describe("Location ID"),
    },
    async ({ id }) => {
      return callGql(`mutation($id: String!) { deleteLocation(id: $id) }`, { id });
    },
  );

  // === Sharing ===

  server.tool(
    "share_add",
    "Share a task with a user",
    {
      taskId: z.string().describe("Task ID"),
      userId: z.string().describe("User ID to share with"),
    },
    async ({ taskId, userId }) => {
      return callGql(
        `mutation($taskId: String!, $targetUserId: String!) { shareTask(taskId: $taskId, targetUserId: $targetUserId) }`,
        { taskId, targetUserId: userId },
      );
    },
  );

  server.tool(
    "share_remove",
    "Remove task sharing",
    {
      sharedTaskId: z.string().describe("Shared task ID"),
    },
    async ({ sharedTaskId }) => {
      return callGql(`mutation($sharedTaskId: String!) { unshareTask(sharedTaskId: $sharedTaskId) }`, { sharedTaskId });
    },
  );

  server.tool(
    "share_list",
    "List users a task is shared with",
    {
      taskId: z.string().describe("Task ID"),
    },
    async ({ taskId }) => {
      return callGql(
        `query($taskId: String!) { taskShares(taskId: $taskId) { id sharedWith { name email } createdAt } }`,
        { taskId },
      );
    },
  );

  // === Connections ===

  server.tool("connection_ls", "List all user connections", {}, async () => {
    return callGql(`query { connections { id connectedUser { name email } sharedTaskCount createdAt } }`);
  });

  server.tool("connection_invite", "Create a connection invite", {}, async () => {
    return callGql(`mutation { createConnectionInvite { id token expiresAt } }`);
  });

  server.tool(
    "connection_remove",
    "Remove a user connection",
    {
      connectedUserId: z.string().describe("Connected user ID"),
    },
    async ({ connectedUserId }) => {
      return callGql(`mutation($connectedUserId: ID!) { disconnect(connectedUserId: $connectedUserId) }`, { connectedUserId });
    },
  );

  // === Calendar ===

  server.tool("calendar_sync", "Sync calendar", {}, async () => {
    return callGql(`query { calendarSyncAll }`);
  });

  // === Subscription ===

  server.tool("subscription_status", "Show subscription status", {}, async () => {
    return callGql(`query { subscription { id status plan paymentMethod currentPeriodEnd createdAt } }`);
  });

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
