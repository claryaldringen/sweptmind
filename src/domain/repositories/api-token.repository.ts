import type { ApiToken, CreateApiTokenInput } from "../entities/api-token";

export interface IApiTokenRepository {
  create(input: CreateApiTokenInput): Promise<ApiToken>;
  findByTokenHash(tokenHash: string): Promise<ApiToken | undefined>;
  findByUserId(userId: string): Promise<ApiToken[]>;
  updateLastUsed(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}
