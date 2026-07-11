#!/usr/bin/env node
// Runtime-neutral executor simulation: no governed project writes, no Codex process.
const decide = ({ status, result, repairs = 0 }) => {
  if (status === "VERIFIED") return "skip";
  if (result === "green") return "review";
  if (result === "red" && repairs < 2) return "repair";
  if (result === "needs-owner") return "needs-owner";
  return "blocked";
};
const cases = [
  [{ status: "PLANNED", result: "green" }, "review", "success"],
  [{ status: "IN_REVIEW", result: "red", repairs: 0 }, "repair", "red→repair"],
  [{ status: "IN_REVIEW", result: "red", repairs: 2 }, "blocked", "repair cap"],
  [{ status: "BLOCKED", result: "needs-owner" }, "needs-owner", "owner gate"],
  [{ status: "VERIFIED", result: "green" }, "skip", "VERIFIED skip"],
];
let pass = 0;
for (const [input, expected, name] of cases) { if (decide(input) !== expected) throw new Error(name); console.log(`PASS  ${name}`); pass++; }
const ledger = { spend: 0, limit: 3 }; const reserve = (units) => { if (ledger.spend + units > ledger.limit) return false; ledger.spend += units; return true; };
if (!reserve(2) || reserve(2) || ledger.spend !== 2) throw new Error("overspend brake"); console.log("PASS  overspend brake"); pass++;
console.log(`RESULT: ${pass} passed, 0 failed`);
