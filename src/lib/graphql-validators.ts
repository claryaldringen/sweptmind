import { z } from "zod";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/)
  .nullish();

const deviceContextEnum = z.enum(["phone", "computer"]).nullish();

export const createTaskSchema = z.object({
  id: z.string().uuid().nullish(),
  listId: z.string().uuid(),
  title: z.string().min(1).max(500),
  notes: z.string().max(10000).nullish(),
  dueDate: dateString,
  locationId: z.string().uuid().nullish(),
  deviceContext: deviceContextEnum,
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).nullish(),
  notes: z.string().max(10000).nullish(),
  dueDate: dateString,
  reminderAt: dateString,
  recurrence: z.string().max(500).nullish(),
  listId: z.string().uuid().nullish(),
  locationId: z.string().uuid().nullish(),
  deviceContext: deviceContextEnum,
  blockedByTaskId: z.string().uuid().nullish(),
});

export const importTaskSchema = z.object({
  title: z.string().min(1).max(500),
  dueDate: dateString,
  notes: z.string().max(10000).nullish(),
  isCompleted: z.boolean().nullish(),
  listName: z.string().max(200).nullish(),
});

export const createListSchema = z.object({
  id: z.string().uuid().nullish(),
  name: z.string().min(1).max(200),
  icon: z.string().max(50).nullish(),
  themeColor: z.string().max(50).nullish(),
  groupId: z.string().uuid().nullish(),
});

export const updateListSchema = z.object({
  name: z.string().min(1).max(200).nullish(),
  icon: z.string().max(50).nullish(),
  themeColor: z.string().max(50).nullish(),
  groupId: z.string().uuid().nullish(),
  locationId: z.string().uuid().nullish(),
  deviceContext: deviceContextEnum,
});

export const createStepSchema = z.object({
  id: z.string().uuid().nullish(),
  taskId: z.string().uuid(),
  title: z.string().min(1).max(500),
});

export const registerInputSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export const createTagSchema = z.object({
  id: z.string().uuid().nullish(),
  name: z.string().min(1).max(100),
  color: z.string().max(50).nullish(),
  deviceContext: deviceContextEnum,
  locationId: z.string().uuid().nullish(),
});

export const updateTagSchema = z.object({
  name: z.string().min(1).max(100).nullish(),
  color: z.string().max(50).nullish(),
  deviceContext: deviceContextEnum,
  locationId: z.string().uuid().nullish(),
});

export const createLocationSchema = z.object({
  id: z.string().uuid().nullish(),
  name: z.string().min(1).max(200),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius: z.number().min(0.1).max(100).nullish(),
  address: z.string().max(500).nullish(),
});

export const updateLocationSchema = z.object({
  name: z.string().min(1).max(200).nullish(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  radius: z.number().min(0.1).max(100).nullish(),
  address: z.string().max(500).nullish(),
});
