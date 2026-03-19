import { relations } from "drizzle-orm";
import { users, accounts } from "./auth";
import { listGroups, lists } from "./lists";
import { tasks, steps } from "./tasks";
import { tags, taskTags } from "./tags";
import { locations } from "./locations";
import { calendarSync } from "./calendar-sync";
import { pushSubscriptions } from "./push-subscriptions";
import { subscriptions, bankPayments } from "./subscriptions";
import { taskAttachments } from "./attachments";
import { taskAiAnalyses } from "./ai-analyses";
import { aiUsage } from "./ai-usage";
import { connectionInvites, userConnections, sharedTasks } from "./sharing";

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  lists: many(lists),
  listGroups: many(listGroups),
  tasks: many(tasks),
  tags: many(tags),
  locations: many(locations),
  calendarSyncs: many(calendarSync),
  pushSubscriptions: many(pushSubscriptions),
  subscriptions: many(subscriptions),
  bankPayments: many(bankPayments),
  aiUsage: many(aiUsage),
  connectionInvites: many(connectionInvites),
  acceptedInvites: many(connectionInvites, { relationName: "acceptedInvites" }),
  connections: many(userConnections),
  connectedTo: many(userConnections, { relationName: "connectedTo" }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const listGroupsRelations = relations(listGroups, ({ one, many }) => ({
  user: one(users, {
    fields: [listGroups.userId],
    references: [users.id],
  }),
  lists: many(lists),
}));

export const listsRelations = relations(lists, ({ one, many }) => ({
  user: one(users, {
    fields: [lists.userId],
    references: [users.id],
  }),
  group: one(listGroups, {
    fields: [lists.groupId],
    references: [listGroups.id],
  }),
  location: one(locations, {
    fields: [lists.locationId],
    references: [locations.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  user: one(users, {
    fields: [tasks.userId],
    references: [users.id],
  }),
  list: one(lists, {
    fields: [tasks.listId],
    references: [lists.id],
  }),
  location: one(locations, {
    fields: [tasks.locationId],
    references: [locations.id],
  }),
  steps: many(steps),
  taskTags: many(taskTags),
  attachments: many(taskAttachments),
  aiAnalysis: one(taskAiAnalyses, {
    fields: [tasks.id],
    references: [taskAiAnalyses.taskId],
  }),
  sharedFrom: many(sharedTasks, { relationName: "sourceTask" }),
  sharedTo: many(sharedTasks, { relationName: "targetTask" }),
}));

export const stepsRelations = relations(steps, ({ one }) => ({
  task: one(tasks, {
    fields: [steps.taskId],
    references: [tasks.id],
  }),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  user: one(users, {
    fields: [tags.userId],
    references: [users.id],
  }),
  taskTags: many(taskTags),
}));

export const taskTagsRelations = relations(taskTags, ({ one }) => ({
  task: one(tasks, {
    fields: [taskTags.taskId],
    references: [tasks.id],
  }),
  tag: one(tags, {
    fields: [taskTags.tagId],
    references: [tags.id],
  }),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  user: one(users, {
    fields: [locations.userId],
    references: [users.id],
  }),
  tasks: many(tasks),
  lists: many(lists),
}));

export const pushSubscriptionRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id],
  }),
}));

export const calendarSyncRelations = relations(calendarSync, ({ one }) => ({
  user: one(users, {
    fields: [calendarSync.userId],
    references: [users.id],
  }),
  task: one(tasks, {
    fields: [calendarSync.taskId],
    references: [tasks.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const bankPaymentsRelations = relations(bankPayments, ({ one }) => ({
  user: one(users, {
    fields: [bankPayments.userId],
    references: [users.id],
  }),
}));

export const taskAttachmentsRelations = relations(taskAttachments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAttachments.taskId],
    references: [tasks.id],
  }),
}));

export const aiUsageRelations = relations(aiUsage, ({ one }) => ({
  user: one(users, {
    fields: [aiUsage.userId],
    references: [users.id],
  }),
}));

export const taskAiAnalysesRelations = relations(taskAiAnalyses, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAiAnalyses.taskId],
    references: [tasks.id],
  }),
}));

export const connectionInvitesRelations = relations(connectionInvites, ({ one }) => ({
  fromUser: one(users, {
    fields: [connectionInvites.fromUserId],
    references: [users.id],
  }),
  acceptedByUser: one(users, {
    fields: [connectionInvites.acceptedByUserId],
    references: [users.id],
    relationName: "acceptedInvites",
  }),
}));

export const userConnectionsRelations = relations(userConnections, ({ one, many }) => ({
  user: one(users, {
    fields: [userConnections.userId],
    references: [users.id],
  }),
  connectedUser: one(users, {
    fields: [userConnections.connectedUserId],
    references: [users.id],
    relationName: "connectedTo",
  }),
  targetList: one(lists, {
    fields: [userConnections.targetListId],
    references: [lists.id],
  }),
  sharedTasks: many(sharedTasks),
}));

export const sharedTasksRelations = relations(sharedTasks, ({ one }) => ({
  connection: one(userConnections, {
    fields: [sharedTasks.connectionId],
    references: [userConnections.id],
  }),
  sourceTask: one(tasks, {
    fields: [sharedTasks.sourceTaskId],
    references: [tasks.id],
    relationName: "sourceTask",
  }),
  targetTask: one(tasks, {
    fields: [sharedTasks.targetTaskId],
    references: [tasks.id],
    relationName: "targetTask",
  }),
}));
