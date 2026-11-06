import { test } from "node:test";
import assert from "node:assert/strict";
import { dueStatus, daysUntil, todayISO } from "../src/lib/due.ts";
import { matchesFilters, emptyFilters } from "../src/lib/filters.ts";
import { positionAt } from "../src/lib/position.ts";

const today = "2026-11-06";
const s = (due: string | null, done = false, includesDueDate = true) => dueStatus(due, done, { today, soonDays: 3, includesDueDate });

test("coluna concluída nunca alerta", () => assert.equal(s("2026-10-01", true), "done"));
test("vencida só a partir do dia seguinte", () => {
  assert.equal(s("2026-11-05"), "overdue");
  assert.notEqual(s("2026-11-06"), "overdue");
});
test("janela de 3 dias antes do prazo", () => {
  assert.equal(s("2026-11-07"), "soon");
  assert.equal(s("2026-11-09"), "soon");
  assert.equal(s("2026-11-10"), "ok");
});
test("dia do vencimento é configurável (validação pendente)", () => {
  assert.equal(s("2026-11-06", false, true), "soon");
  assert.equal(s("2026-11-06", false, false), "ok");
});
test("sem prazo", () => assert.equal(s(null), "none"));
test("datas sem horário no fuso configurado", () => {
  // 02:30 UTC de 7/11 ainda é 6/11 em São Paulo
  assert.equal(todayISO("America/Sao_Paulo", new Date("2026-11-07T02:30:00Z")), "2026-11-06");
  assert.equal(daysUntil("2026-12-31", "2027-01-01"), 1);
});

const card = { title: "Revisar contrato", description_text: "cláusula de rescisão", column_id: "c1", assignee_id: null, due_date: "2026-11-05", project_id: "p1", board_id: "b1" };
test("filtros combinam com E e ignoram acentos", () => {
  const f = { ...emptyFilters, q: "clausula", assignees: ["none"], due: ["overdue" as const] };
  assert.ok(matchesFilters(card, f, () => false, { today }));
  assert.ok(!matchesFilters(card, { ...f, assignees: ["u1"] }, () => false, { today }));
  assert.ok(!matchesFilters(card, { ...f, from: "2026-11-06" }, () => false, { today }));
});
test("posições fracionárias", () => {
  const list = [{ position: 1024 }, { position: 2048 }];
  assert.equal(positionAt(list, 0), 0);
  assert.equal(positionAt(list, 1), 1536);
  assert.equal(positionAt(list, 2), 3072);
});
