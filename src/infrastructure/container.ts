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
import { DrizzleTaskAiAnalysisRepository } from "./persistence/drizzle-task-ai-analysis.repository";
import { DrizzlePushSubscriptionRepository } from "./persistence/drizzle-push-subscription.repository";
import { DrizzleAiUsageRepository } from "./persistence/drizzle-ai-usage.repository";
import { DrizzleConnectionInviteRepository } from "./persistence/drizzle-connection-invite.repository";
import { DrizzleUserConnectionRepository } from "./persistence/drizzle-user-connection.repository";
import { DrizzleSharedTaskRepository } from "./persistence/drizzle-shared-task.repository";
import { PushNotificationSender } from "./notification/push-notification-sender";
import { OpenAiCompatibleProvider } from "./llm/openai-compatible-provider";
import { StripePaymentGateway } from "./payment/stripe-payment-gateway";
import { QrCodeGenerator } from "./payment/qrcode-generator";
import { FioBankGateway } from "./fio/fio-bank-gateway";
import { VercelBlobStorage } from "./blob/vercel-blob-storage";
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
import { PaymentService } from "@/domain/services/payment.service";
import { AiService } from "@/domain/services/ai.service";
import { GoogleCalendarService } from "@/domain/services/google-calendar.service";
import { PushSubscriptionService } from "@/domain/services/push-subscription.service";
import { ConnectionService } from "@/domain/services/connection.service";
import { TaskSharingService } from "@/domain/services/task-sharing.service";
import * as googleCalendarClient from "./google-calendar/google-calendar-client";

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
const aiAnalysisRepo = new DrizzleTaskAiAnalysisRepository(db);
const aiUsageRepo = new DrizzleAiUsageRepository(db);
const pushSubRepo = new DrizzlePushSubscriptionRepository(db);

const connectionInviteRepo = new DrizzleConnectionInviteRepository(db);
const userConnectionRepo = new DrizzleUserConnectionRepository(db);
const sharedTaskRepo = new DrizzleSharedTaskRepository(db);
const notificationSender = new PushNotificationSender(pushSubRepo);

const llmProvider = new OpenAiCompatibleProvider();
const blobStorage = new VercelBlobStorage();
const paymentGateway = new StripePaymentGateway(
  process.env.STRIPE_SECRET_KEY ?? "",
  process.env.STRIPE_PRICE_MONTHLY_ID ?? "",
  process.env.STRIPE_PRICE_YEARLY_ID ?? "",
);
const qrGenerator = new QrCodeGenerator();
const fioBankGateway = process.env.FIO_API_TOKEN
  ? new FioBankGateway(process.env.FIO_API_TOKEN)
  : null;

const bcryptHasher: IPasswordHasher = {
  hash: (password) => hash(password, 12),
  compare: (password, hashed) => compare(password, hashed),
};

const googleCalendarService = new GoogleCalendarService(
  userRepo,
  calendarSyncRepo,
  googleCalendarClient,
  taskRepo,
  listRepo,
);

const taskSharingService = new TaskSharingService(
  sharedTaskRepo,
  userConnectionRepo,
  taskRepo,
  listRepo,
  userRepo,
  notificationSender,
);

const taskService = new TaskService(
  taskRepo,
  listRepo,
  stepRepo,
  googleCalendarService,
  taskSharingService,
  tagRepo,
);

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
  aiAnalysis: aiAnalysisRepo,
  pushSubscription: pushSubRepo,
  user: userRepo,
  connectionInvite: connectionInviteRepo,
  userConnection: userConnectionRepo,
  sharedTask: sharedTaskRepo,
};

export type Repos = typeof repos;

const subscriptionService = new SubscriptionService(subscriptionRepo);

export const services = {
  task: taskService,
  googleCalendar: googleCalendarService,
  list: new ListService(listRepo),
  step: new StepService(stepRepo, taskRepo),
  listGroup: new ListGroupService(groupRepo, listRepo),
  tag: new TagService(tagRepo, taskRepo),
  location: new LocationService(locationRepo),
  calendar: new CalendarService(calendarSyncRepo, taskRepo),
  auth: new AuthService(userRepo, bcryptHasher),
  user: new UserService(userRepo),
  onboarding: new OnboardingService(listRepo, locationRepo, userRepo),
  subscription: subscriptionService,
  attachment: new AttachmentService(attachmentRepo, taskRepo, subscriptionService, blobStorage),
  payment: new PaymentService(
    paymentGateway,
    qrGenerator,
    subscriptionRepo,
    fioBankGateway,
    subscriptionService,
  ),
  ai: new AiService(
    aiAnalysisRepo,
    taskRepo,
    listRepo,
    llmProvider,
    subscriptionService,
    userRepo,
    aiUsageRepo,
    stepRepo,
  ),
  pushSubscription: new PushSubscriptionService(pushSubRepo),
  connection: new ConnectionService(
    connectionInviteRepo,
    userConnectionRepo,
    listRepo,
    notificationSender,
  ),
  taskSharing: taskSharingService,
};

// Wire circular dependency: connection ↔ taskSharing
services.connection.setTaskSharingService(taskSharingService);

export type Services = typeof services;
