import { round2 } from "./calculations";

type MonthlyValues = Record<string, number>;

/** El saldo de cierre de un mes se convierte en el saldo inicial del siguiente. */
export function calculateCashFlowBalances(
  months: string[],
  income: MonthlyValues,
  directCosts: MonthlyValues,
  administrativeExpenses: MonthlyValues,
  financialExpenses: MonthlyValues,
  taxes: MonthlyValues,
) {
  const opening: MonthlyValues = {};
  const closing: MonthlyValues = {};
  let balance = 0;

  for (const month of months) {
    opening[month] = balance;
    balance = round2(
      balance + (income[month] ?? 0)
      - (directCosts[month] ?? 0)
      - (administrativeExpenses[month] ?? 0)
      - (financialExpenses[month] ?? 0)
      - (taxes[month] ?? 0),
    );
    closing[month] = balance;
  }

  return { opening, closing };
}
