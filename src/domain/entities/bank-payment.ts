export interface BankPayment {
  id: string;
  userId: string;
  amount: string;
  currency: string;
  variableSymbol: string;
  fioTransactionId: string;
  receivedAt: Date;
  createdAt: Date;
}
