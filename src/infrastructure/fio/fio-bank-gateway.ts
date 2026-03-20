import type { IFioBankGateway, FioTransaction } from "@/domain/ports/fio-bank-gateway";

const FIO_API_BASE = "https://fioapi.fio.cz/v1/rest";

interface FioApiTransaction {
  column22: { value: number };
  column0: { value: string };
  column5: { value: string | null };
  column17: { value: number };
}

export class FioBankGateway implements IFioBankGateway {
  constructor(private readonly apiToken: string) {}

  async getRecentTransactions(): Promise<FioTransaction[]> {
    const res = await fetch(`${FIO_API_BASE}/last/${this.apiToken}/transactions.json`);
    if (!res.ok) {
      throw new Error(`FIO API error: ${res.status}`);
    }

    const data = await res.json();
    const transactions: FioApiTransaction[] =
      data?.accountStatement?.transactionList?.transaction ?? [];

    return transactions.map((tx) => ({
      amount: tx.column22?.value,
      variableSymbol: tx.column5?.value,
      fioTransactionId: String(tx.column17?.value),
      date: tx.column0?.value,
    }));
  }
}
