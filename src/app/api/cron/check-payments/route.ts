import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { bankPayments } from "@/server/db/schema/subscriptions";
import { eq } from "drizzle-orm";
import { services } from "@/infrastructure/container";

const FIO_API_BASE = "https://fioapi.fio.cz/v1/rest";
const MONTHLY_CZK = 49;
const YEARLY_CZK = 490;

interface FioTransaction {
  column22: { value: number; id: number };
  column0: { value: string };
  column5: { value: string | null };
  column17: { value: number };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.FIO_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "FIO_API_TOKEN not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(`${FIO_API_BASE}/last/${token}/transactions.json`);
    if (!res.ok) {
      return NextResponse.json({ error: "FIO API error" }, { status: 502 });
    }

    const data = await res.json();
    const transactions: FioTransaction[] =
      data?.accountStatement?.transactionList?.transaction ?? [];

    let processed = 0;

    for (const tx of transactions) {
      const amount = tx.column22?.value;
      const variableSymbol = tx.column5?.value;
      const fioTransactionId = String(tx.column17?.value);

      if (!variableSymbol || (amount !== MONTHLY_CZK && amount !== YEARLY_CZK)) {
        continue;
      }

      const existing = await db.query.bankPayments.findFirst({
        where: eq(bankPayments.fioTransactionId, fioTransactionId),
      });
      if (existing) continue;

      const allUsers = await db.query.users.findMany();
      const matchedUser = allUsers.find(
        (u) => u.id.replace(/-/g, "").slice(0, 10) === variableSymbol,
      );
      if (!matchedUser) continue;

      await db.insert(bankPayments).values({
        userId: matchedUser.id,
        amount: String(amount),
        currency: "CZK",
        variableSymbol,
        fioTransactionId,
        receivedAt: new Date(tx.column0.value),
      });

      await services.subscription.activateBankTransfer(matchedUser.id, amount);
      processed++;
    }

    return NextResponse.json({ ok: true, processed });
  } catch (error) {
    console.error("FIO cron error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
