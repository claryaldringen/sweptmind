import type { AiUsage } from "../entities/ai-usage";

export interface IAiUsageRepository {
  getByUserAndMonth(userId: string, yearMonth: string): Promise<AiUsage | undefined>;
  increment(userId: string, yearMonth: string): Promise<AiUsage>;
}
