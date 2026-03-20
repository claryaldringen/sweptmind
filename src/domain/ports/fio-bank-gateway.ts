export interface FioTransaction {
  amount: number;
  variableSymbol: string | null;
  fioTransactionId: string;
  date: string;
}

export interface IFioBankGateway {
  getRecentTransactions(): Promise<FioTransaction[]>;
}
