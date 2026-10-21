import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateBudgetedBalance,
  calculateBudgetOverview,
  listBudgetedProjectionPeriods,
} from "./budgets";

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

const month = (period: string, availableAmount: number, hasBudget = true) => ({
  availableAmount,
  hasBudget,
  period,
});

test("budgeted balance of the current month subtracts only its own remaining budget", () => {
  assert.deepEqual(
    calculateBudgetedBalance({
      budgets: [month("2026-10", 350.5)],
      currentPeriod: "2026-10",
      period: "2026-10",
      projectedBalance: 1000,
    }),
    {
      accumulatedBudget: 350.5,
      amount: 649.5,
      beyondHorizon: false,
      hasBudget: true,
      monthsWithoutBudget: [],
      remainingBudget: 350.5,
    },
  );
});

test("budgeted balance of future months accumulates the remaining budget since the current month", () => {
  const budgets = [month("2026-10", 300), month("2026-11", 400), month("2026-12", 400)];
  const project = (period: string, projectedBalance: number) =>
    calculateBudgetedBalance({ budgets, currentPeriod: "2026-10", period, projectedBalance });

  assert.equal(project("2026-10", 1000).amount, 700);
  assert.equal(project("2026-11", 1500).amount, 800);
  assert.equal(project("2026-12", 2000).amount, 900);
  assert.equal(project("2026-12", 2000).accumulatedBudget, 1100);
  assert.equal(project("2026-12", 2000).remainingBudget, 400);
});

test("budgeted balance can be negative when the accumulated budget exceeds the projected balance", () => {
  const result = calculateBudgetedBalance({
    budgets: [month("2026-10", 500), month("2026-11", 800)],
    currentPeriod: "2026-10",
    period: "2026-11",
    projectedBalance: -188.49,
  });

  assert.equal(result.amount, -1488.49);
});

test("budgeted balance counts a month without budget as zero and lists it", () => {
  const result = calculateBudgetedBalance({
    budgets: [month("2026-10", 300), month("2026-11", 0, false), month("2026-12", 400)],
    currentPeriod: "2026-10",
    period: "2026-12",
    projectedBalance: 2000,
  });

  assert.equal(result.accumulatedBudget, 700);
  assert.equal(result.amount, 1300);
  assert.deepEqual(result.monthsWithoutBudget, ["2026-11"]);
  assert.equal(result.hasBudget, true);
});

test("budgeted balance ignores budgets of past periods", () => {
  assert.deepEqual(
    calculateBudgetedBalance({
      budgets: [month("2026-09", 500)],
      currentPeriod: "2026-10",
      period: "2026-09",
      projectedBalance: 120.1,
    }),
    {
      accumulatedBudget: 0,
      amount: 120.1,
      beyondHorizon: false,
      hasBudget: true,
      monthsWithoutBudget: [],
      remainingBudget: 0,
    },
  );
});

test("budgeted balance equals the projected balance when there is no budget", () => {
  const result = calculateBudgetedBalance({
    budgets: [month("2026-10", 0, false)],
    currentPeriod: "2026-10",
    period: "2026-10",
    projectedBalance: 42,
  });

  assert.equal(result.amount, 42);
  assert.equal(result.hasBudget, false);
  assert.deepEqual(result.monthsWithoutBudget, ["2026-10"]);
});

test("budgeted balance never adds money back when the available amount is negative", () => {
  const result = calculateBudgetedBalance({
    budgets: [month("2026-10", -50)],
    currentPeriod: "2026-10",
    period: "2026-10",
    projectedBalance: 100,
  });

  assert.equal(result.amount, 100);
  assert.equal(result.remainingBudget, 0);
});

test("budgeted balance falls back to the projected balance beyond the projection horizon", () => {
  const far = "2030-01";
  const result = calculateBudgetedBalance({
    budgets: [month(far, 900)],
    currentPeriod: "2026-10",
    period: far,
    projectedBalance: 5000,
  });

  assert.equal(result.beyondHorizon, true);
  assert.equal(result.amount, 5000);
  assert.deepEqual(listBudgetedProjectionPeriods("2026-10", far), []);
  assert.equal(listBudgetedProjectionPeriods("2026-10", "2026-12").length, 3);
});
