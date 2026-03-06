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
import "./types/calendar";

export const schema = builder.toSchema();
