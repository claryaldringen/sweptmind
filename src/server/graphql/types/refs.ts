import { builder } from "../builder";
import type { User } from "@/domain/entities/user";
import type { Task, Step } from "@/domain/entities/task";
import type { List, ListGroup } from "@/domain/entities/list";
import type { Tag } from "@/domain/entities/tag";
import type { Location } from "@/domain/entities/location";
import type { Subscription } from "@/domain/entities/subscription";
import type { TaskAttachment } from "@/domain/entities/task-attachment";
import type { TaskAiAnalysis } from "@/domain/entities/task-ai-analysis";
import type { ConnectionInvite } from "@/domain/entities/connection-invite";
import type { ConnectionWithUser } from "@/domain/entities/user-connection";
import type { ApiToken } from "@/domain/entities/api-token";

export const UserRef = builder.objectRef<User>("User");
export const ListRef = builder.objectRef<List>("List");
export const TaskRef = builder.objectRef<Task>("Task");
export const StepRef = builder.objectRef<Step>("Step");
export const ListGroupRef = builder.objectRef<ListGroup>("ListGroup");
export const TagRef = builder.objectRef<Tag>("Tag");
export const LocationRef = builder.objectRef<Location>("Location");
export const SubscriptionRef = builder.objectRef<Subscription>("Subscription");
export const AttachmentRef = builder.objectRef<TaskAttachment>("TaskAttachment");
export const TaskAiAnalysisRef = builder.objectRef<TaskAiAnalysis>("TaskAiAnalysis");
export const ConnectionInviteRef = builder.objectRef<ConnectionInvite>("ConnectionInvite");
export const UserConnectionRef = builder.objectRef<ConnectionWithUser>("UserConnection");
export const SharedTaskInfoRef = builder.objectRef<{
  id: string;
  sharedWith: { id: string; name: string | null; email: string | null; image: string | null };
  targetTask: Task;
  createdAt: Date;
}>("SharedTaskInfo");
export const IncomingShareInfoRef = builder.objectRef<{
  id: string;
  owner: { id: string; name: string | null; email: string | null; image: string | null };
  sourceTask: Task;
  createdAt: Date;
}>("IncomingShareInfo");
export const ApiTokenRef = builder.objectRef<ApiToken>("ApiToken");
