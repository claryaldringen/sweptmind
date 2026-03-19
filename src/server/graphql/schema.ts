import { builder } from "./builder";
import "./types/refs";
import "./types/user";
import "./types/step";
import "./types/task";
import "./types/tag";
import "./types/location";
import "./types/list";
import "./types/list-group";
import "./types/register";
import "./types/onboarding";
import "./types/calendar";
import "./types/subscription";
import "./types/attachment";
import "./types/ai-analysis";
import "./types/sharing";

export const schema = builder.toSchema();
