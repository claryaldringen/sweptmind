import { hash, compare } from "bcryptjs";
import { db } from "@/server/db";
import { DrizzleTaskRepository } from "./persistence/drizzle-task.repository";
import { DrizzleListRepository } from "./persistence/drizzle-list.repository";
import { DrizzleStepRepository } from "./persistence/drizzle-step.repository";
import { DrizzleListGroupRepository } from "./persistence/drizzle-list-group.repository";
import { DrizzleUserRepository } from "./persistence/drizzle-user.repository";
import { DrizzleTagRepository } from "./persistence/drizzle-tag.repository";
import { DrizzleLocationRepository } from "./persistence/drizzle-location.repository";
import { DrizzleCalendarSyncRepository } from "./persistence/drizzle-calendar-sync.repository";
import { DrizzleSubscriptionRepository } from "./persistence/drizzle-subscription.repository";
import { DrizzleAttachmentRepository } from "./persistence/drizzle-attachment.repository";
import { TaskService } from "@/domain/services/task.service";
import { ListService } from "@/domain/services/list.service";
import { StepService } from "@/domain/services/step.service";
import { ListGroupService } from "@/domain/services/list-group.service";
import { TagService } from "@/domain/services/tag.service";
import { LocationService } from "@/domain/services/location.service";
import { CalendarService } from "@/domain/services/calendar.service";
import { AuthService, type IPasswordHasher } from "@/domain/services/auth.service";
import { UserService } from "@/domain/services/user.service";
import { OnboardingService } from "@/domain/services/onboarding.service";
import { SubscriptionService } from "@/domain/services/subscription.service";
import { AttachmentService } from "@/domain/services/attachment.service";

const taskRepo = new DrizzleTaskRepository(db);
const listRepo = new DrizzleListRepository(db);
const stepRepo = new DrizzleStepRepository(db);
const groupRepo = new DrizzleListGroupRepository(db);
const userRepo = new DrizzleUserRepository(db);
const tagRepo = new DrizzleTagRepository(db);
const locationRepo = new DrizzleLocationRepository(db);
const calendarSyncRepo = new DrizzleCalendarSyncRepository(db);
const subscriptionRepo = new DrizzleSubscriptionRepository(db);
const attachmentRepo = new DrizzleAttachmentRepository(db);

const bcryptHasher: IPasswordHasher = {
  hash: (password) => hash(password, 12),
  compare: (password, hashed) => compare(password, hashed),
};

const taskService = new TaskService(taskRepo, listRepo, stepRepo);

export const repos = {
  task: taskRepo,
  list: listRepo,
  step: stepRepo,
  group: groupRepo,
  tag: tagRepo,
  location: locationRepo,
  calendarSync: calendarSyncRepo,
  subscription: subscriptionRepo,
  attachment: attachmentRepo,
  user: userRepo,
};

export type Repos = typeof repos;

export const services = {
  task: taskService,
  list: new ListService(listRepo),
  step: new StepService(stepRepo, taskRepo),
  listGroup: new ListGroupService(groupRepo, listRepo),
  tag: new TagService(tagRepo, taskRepo),
  location: new LocationService(locationRepo),
  calendar: new CalendarService(calendarSyncRepo, taskRepo),
  auth: new AuthService(userRepo, bcryptHasher),
  user: new UserService(userRepo),
  onboarding: new OnboardingService(listRepo, locationRepo, userRepo),
  subscription: new SubscriptionService(subscriptionRepo),
  attachment: new AttachmentService(attachmentRepo, taskRepo, subscriptionRepo),
};

export type Services = typeof services;
