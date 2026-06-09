import "server-only";

import { SEED_PAYMENT_METHODS } from "@/lib/constants";
import { round2 } from "@/lib/calculations";
import type {
  DebtReportRow,
  FinanceUtilityReport,
  GeneralBalanceAccountReport,
  GeneralBalanceHistoryRow,
  GeneralBalanceReport,
  GeneralBalanceRow,
} from "@/lib/types";
import { getUtilityReport } from "./projects";
import { getWorksPaymentMethodReport, listWorks } from "./works";
import { getWorksAdministrationUtilityReport } from "./works";
import { db, nowISO, uuid } from "./store";
import { listWorkOrders } from "./orders";

function accountIdFromMethodName(name: string) {
  return name.toLowerCase().replaceAll(" ", "-");
}

export async function getDebtReport(): Promise<DebtReportRow[]> {
  const providerBalances = new Map<string, number>();

  for (const work of db.works) {
    for (const order of await listWorkOrders(work.id)) {
      if (order.amount === null || order.pending <= 0.001) continue;
      providerBalances.set(
        order.supplier,
        round2((providerBalances.get(order.supplier) ?? 0) + order.pending),
      );
    }
  }

  const debtors: DebtReportRow[] = db.manualDebtors.map((debtor) => ({
    id: debtor.id,
    name: debtor.name,
    amount: debtor.amount,
    type: "debtor",
    source: "manual",
  }));

  const providers: DebtReportRow[] = [...providerBalances.entries()].map(([provider, amount]) => ({
    id: `provider-${provider}`,
    name: provider,
    amount,
    type: "provider",
    source: "orders",
  }));

  return [...debtors, ...providers];
}

export async function getGeneralBalanceReport(): Promise<GeneralBalanceReport> {
  const [paymentMethodRows, works, debts] = await Promise.all([
    getWorksPaymentMethodReport(),
    listWorks(),
    getDebtReport(),
  ]);

  const byMethodName = new Map(
    paymentMethodRows.map((row) => [row.methodName.toLowerCase(), row]),
  );
  const debtorsTotal = round2(
    debts
      .filter((row) => row.type === "debtor")
      .reduce((sum, row) => sum + row.amount, 0),
  );
  const providersTotal = round2(
    debts
      .filter((row) => row.type === "provider")
      .reduce((sum, row) => sum + row.amount, 0),
  );
  const accountsPayableTotal = providersTotal;
  const worksReceivableTotal = round2(
    works
      .filter((work) => work.finance.balance < -0.001)
      .reduce((sum, work) => sum + Math.abs(work.finance.balance), 0),
  );
  const accountsReceivable = round2(debtorsTotal + worksReceivableTotal);

  const rows: GeneralBalanceRow[] = SEED_PAYMENT_METHODS.map((methodName) => {
    const normalized = methodName.toLowerCase();
    if (normalized === "cuentas por pagar") {
      return {
        id: "accounts-payable",
        label: "Cuentas por pagar",
        amount: accountsPayableTotal,
        source: "providers",
        description: "Saldo pendiente de pedidos a proveedores.",
      };
    }

    return {
      id: accountIdFromMethodName(methodName),
      label: methodName,
      amount: byMethodName.get(normalized)?.finalBalance ?? 0,
      source: "works-payment-method",
      description: "Mov. clientes más traspasos internos de Obras.",
    };
  });

  rows.push({
    id: "accounts-receivable",
    label: "Cuentas por cobrar",
    amount: accountsReceivable,
    source: "receivable",
    description: "Deudores manuales más obras con estado Por cobrar.",
  });

  const byAccountId = new Map(rows.map((row) => [row.id, row]));
  for (const entry of db.generalBalanceEntries) {
    const from = byAccountId.get(entry.from_account_id);
    const to = byAccountId.get(entry.to_account_id);
    if (from) from.amount = round2(from.amount - entry.amount);
    if (to) to.amount = round2(to.amount + entry.amount);
  }
  for (const movement of db.generalBalanceAccountMovements) {
    const row = byAccountId.get(movement.account_id);
    if (!row) continue;
    const sign = movement.movement_type === "income" ? 1 : -1;
    row.amount = round2(row.amount + movement.amount * sign);
  }

  const total = round2(rows.reduce((sum, row) => sum + row.amount, 0));

  return {
    rows,
    total,
    totalWithoutDebtors: round2(total - debtorsTotal),
    debtorsTotal,
    providersTotal: accountsPayableTotal,
    worksReceivableTotal,
  };
}

function methodForAccount(account: GeneralBalanceRow) {
  if (account.id === "accounts-payable") {
    return db.methods.find(
      (method) => method.name.toLowerCase() === "cuentas por pagar",
    );
  }
  return db.methods.find((method) => accountIdFromMethodName(method.name) === account.id);
}

export async function getGeneralBalanceAccountReport(
  accountId: string,
): Promise<GeneralBalanceAccountReport | null> {
  const report = await getGeneralBalanceReport();
  const account = report.rows.find((row) => row.id === accountId);
  if (!account) return null;

  const history: GeneralBalanceHistoryRow[] = [];
  const method = methodForAccount(account);

  if (method) {
    if (account.id === "accounts-payable") {
      for (const work of db.works) {
        for (const order of await listWorkOrders(work.id)) {
          if (order.amount === null || order.pending <= 0.001) continue;
          history.push({
            id: `order-payable-${order.id}`,
            date: order.quoted_at ?? order.order_date,
            description: `${order.material} · ${work.name}`,
            expenseAccount: account.label,
            incomeAccount: order.supplier,
            amount: order.pending,
            source: "orders",
          });
        }
      }
    } else {
      for (const movement of db.workMovements) {
        if (movement.payment_method_id !== method.id) continue;
        history.push({
          id: `work-${movement.id}`,
          date: movement.movement_date,
          description: movement.concept,
          expenseAccount:
            movement.movement_type === "expense" ? method.name : movement.supplier,
          incomeAccount:
            movement.movement_type === "income" ? method.name : movement.supplier,
          amount: movement.amount,
          source: "works",
        });
      }
    }

    if (account.id !== "accounts-payable") {
      for (const transfer of db.workInternalTransfers) {
        if (
          transfer.from_payment_method_id !== method.id &&
          transfer.to_payment_method_id !== method.id
        ) {
          continue;
        }
        const from = db.methods.find(
          (item) => item.id === transfer.from_payment_method_id,
        );
        const to = db.methods.find((item) => item.id === transfer.to_payment_method_id);
        history.push({
          id: `work-transfer-${transfer.id}`,
          date: transfer.transfer_date,
          description: transfer.description,
          expenseAccount: from?.name ?? "Sin cuenta",
          incomeAccount: to?.name ?? "Sin cuenta",
          amount: transfer.amount,
          source: "internal-transfer",
        });
      }
    }
  }

  if (account.id === "accounts-receivable") {
    for (const debtor of db.manualDebtors) {
      if (debtor.amount <= 0) continue;
      history.push({
        id: `debtor-${debtor.id}`,
        date: debtor.updated_at.slice(0, 10),
        description: debtor.name,
        expenseAccount: "Deudor manual",
        incomeAccount: account.label,
        amount: debtor.amount,
        source: "manual",
      });
    }

    for (const work of await listWorks()) {
      if (work.finance.balance >= -0.001) continue;
      history.push({
        id: `work-receivable-${work.id}`,
        date: work.finance.lastMovementDate ?? work.created_at.slice(0, 10),
        description: work.name,
        expenseAccount: work.client.name,
        incomeAccount: account.label,
        amount: Math.abs(work.finance.balance),
        source: "works",
      });
    }
  }

  for (const entry of db.generalBalanceEntries) {
    if (entry.from_account_id !== account.id && entry.to_account_id !== account.id) {
      continue;
    }
    const from = report.rows.find((row) => row.id === entry.from_account_id);
    const to = report.rows.find((row) => row.id === entry.to_account_id);
    history.push({
      id: `manual-${entry.id}`,
      date: entry.entry_date,
      description: entry.description,
      expenseAccount: from?.label ?? "Sin cuenta",
      incomeAccount: to?.label ?? "Sin cuenta",
      amount: entry.amount,
      source: "manual",
    });
  }

  for (const movement of db.generalBalanceAccountMovements) {
    if (movement.account_id !== account.id) continue;
    history.push({
      id: `account-movement-${movement.id}`,
      date: movement.movement_date,
      description: movement.description,
      expenseAccount:
        movement.movement_type === "expense" ? account.label : "Registro externo",
      incomeAccount:
        movement.movement_type === "income" ? account.label : "Registro externo",
      amount: movement.amount,
      source: "manual",
    });
  }

  return {
    account,
    accounts: report.rows,
    history: history.sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      return a.description.localeCompare(b.description);
    }),
  };
}

export interface RegisterGeneralBalanceEntryData {
  description: string;
  amount: number;
  entryDate: string;
  fromAccountId: string;
  toAccountId: string;
  userId: string | null;
}

export async function registerGeneralBalanceEntry(
  data: RegisterGeneralBalanceEntryData,
): Promise<void> {
  const report = await getGeneralBalanceReport();
  const validAccountIds = new Set(report.rows.map((row) => row.id));
  if (
    !validAccountIds.has(data.fromAccountId) ||
    !validAccountIds.has(data.toAccountId)
  ) {
    throw new Error("Cuenta inválida");
  }
  if (data.fromAccountId === data.toAccountId) {
    throw new Error("Las cuentas deben ser diferentes");
  }

  db.generalBalanceEntries.push({
    id: uuid(),
    description: data.description.trim(),
    amount: round2(data.amount),
    entry_date: data.entryDate,
    from_account_id: data.fromAccountId,
    to_account_id: data.toAccountId,
    created_at: nowISO(),
    created_by: data.userId,
  });
}

export interface RegisterGeneralBalanceAccountMovementData {
  accountId: string;
  movementType: "income" | "expense";
  description: string;
  amount: number;
  movementDate: string;
  userId: string | null;
}

export async function registerGeneralBalanceAccountMovement(
  data: RegisterGeneralBalanceAccountMovementData,
): Promise<void> {
  const report = await getGeneralBalanceReport();
  const account = report.rows.find((row) => row.id === data.accountId);
  if (!account) throw new Error("Cuenta inválida");

  db.generalBalanceAccountMovements.push({
    id: uuid(),
    account_id: data.accountId,
    movement_type: data.movementType,
    description: data.description.trim(),
    amount: round2(data.amount),
    movement_date: data.movementDate,
    created_at: nowISO(),
    created_by: data.userId,
  });
}

export async function getFinanceUtilityReport(): Promise<FinanceUtilityReport> {
  const [projectRows, workRows] = await Promise.all([
    getUtilityReport(),
    getWorksAdministrationUtilityReport(),
  ]);
  const months = new Set<string>();
  for (const row of projectRows) months.add(row.month);
  for (const row of workRows) months.add(row.month);

  const projectByMonth = new Map(
    projectRows.map((row) => [row.month, row.utilityAmount]),
  );
  const workByMonth = new Map(workRows.map((row) => [row.month, row.amount]));
  const rows = [...months]
    .sort((a, b) => a.localeCompare(b))
    .map((month) => {
      const projectUtility = round2(projectByMonth.get(month) ?? 0);
      const workUtility = round2(workByMonth.get(month) ?? 0);
      return {
        month,
        projectUtility,
        workUtility,
        totalUtility: round2(projectUtility + workUtility),
      };
    });

  const projectTotal = round2(
    rows.reduce((sum, row) => sum + row.projectUtility, 0),
  );
  const workTotal = round2(rows.reduce((sum, row) => sum + row.workUtility, 0));

  return {
    rows,
    projectTotal,
    workTotal,
    total: round2(projectTotal + workTotal),
  };
}

export interface SaveManualDebtorData {
  id?: string;
  name: string;
  amount: number;
  userId: string | null;
}

export async function saveManualDebtor(data: SaveManualDebtorData): Promise<string> {
  const existing = data.id
    ? db.manualDebtors.find((debtor) => debtor.id === data.id)
    : null;

  if (existing) {
    existing.name = data.name.trim();
    existing.amount = round2(data.amount);
    existing.updated_at = nowISO();
    return existing.id;
  }

  const ts = nowISO();
  const id = uuid();
  db.manualDebtors.push({
    id,
    name: data.name.trim(),
    amount: round2(data.amount),
    created_at: ts,
    updated_at: ts,
    created_by: data.userId,
  });
  return id;
}
