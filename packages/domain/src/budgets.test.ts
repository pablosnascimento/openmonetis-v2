import assert from "node:assert/strict";
import test from "node:test";
import { calculateBudgetedBalance, calculateBudgetOverview } from "./budgets";

test("keeps category excess separate from remaining limits", () => {
  const result = calculateBudgetOverview(
    [
      { categoryId: "food", amount: 100 },
      { categoryId: "transport", amount: 300 },
    ],
    {
      actualByCategory: new Map([
        ["food", 150],
        ["transport", 100],
      ]),
      projectedByCategory: new Map([["food", 50]]),
      uncategorizedActualAmount: 0,
      uncategorizedProjectedAmount: 0,
    },
  );
  assert.equal(result.availableAmount, 200);
  assert.equal(result.exceededAmount, 100);
  assert.equal(result.committedAmount, 300);
});

test("breaks down unbudgeted expenses including recurrence-only and uncategorized entries", () => {
  const result = calculateBudgetOverview([{ categoryId: "food", amount: 100 }], {
    actualByCategory: new Map([
      ["food", 20],
      ["health", 40],
      ["refunded", -10],
    ]),
    projectedByCategory: new Map([
      ["health", 10],
      ["rent", 200],
    ]),
    uncategorizedActualAmount: 30,
    uncategorizedProjectedAmount: 5,
  });
  assert.deepEqual(result.unbudgetedItems, [
    { categoryId: "rent", committedAmount: 200 },
    { categoryId: "health", committedAmount: 50 },
    { categoryId: null, committedAmount: 35 },
  ]);
  assert.equal(result.unbudgetedCommittedAmount, 285);
});

test("returns no unbudgeted expenses for an empty month", () => {
  const result = calculateBudgetOverview([], {
    actualByCategory: new Map(),
    projectedByCategory: new Map(),
    uncategorizedActualAmount: 0,
    uncategorizedProjectedAmount: 0,
  });
  assert.deepEqual(result.unbudgetedItems, []);
  assert.equal(result.unbudgetedCommittedAmount, 0);
});

test("budgeted balance subtracts the unspent budget from the projected balance", () => {
  assert.deepEqual(
    calculateBudgetedBalance({
      availableAmount: 350.5,
      currentPeriod: "2026-10",
      hasBudget: true,
      period: "2026-10",
      projectedBalance: 1000,
    }),
    { amount: 649.5, hasBudget: true, remainingBudget: 350.5 },
  );
});

test("budgeted balance can be negative when the budget exceeds the projected balance", () => {
  const result = calculateBudgetedBalance({
    availableAmount: 800,
    currentPeriod: "2026-10",
    hasBudget: true,
    period: "2026-12",
    projectedBalance: -188.49,
  });

  assert.equal(result.amount, -988.49);
  assert.equal(result.remainingBudget, 800);
});

test("budgeted balance ignores the remaining budget of past periods", () => {
  assert.deepEqual(
    calculateBudgetedBalance({
      availableAmount: 500,
      currentPeriod: "2026-10",
      hasBudget: true,
      period: "2026-09",
      projectedBalance: 120.1,
    }),
    { amount: 120.1, hasBudget: true, remainingBudget: 0 },
  );
});

test("budgeted balance equals the projected balance when there is no budget", () => {
  assert.deepEqual(
    calculateBudgetedBalance({
      availableAmount: 0,
      currentPeriod: "2026-10",
      hasBudget: false,
      period: "2026-10",
      projectedBalance: 42,
    }),
    { amount: 42, hasBudget: false, remainingBudget: 0 },
  );
});

test("budgeted balance never adds money back when the available amount is negative", () => {
  const result = calculateBudgetedBalance({
    availableAmount: -50,
    currentPeriod: "2026-10",
    hasBudget: true,
    period: "2026-10",
    projectedBalance: 100,
  });

  assert.equal(result.amount, 100);
  assert.equal(result.remainingBudget, 0);
});
