const test = require("node:test");
const assert = require("node:assert/strict");
const { createQuizState } = require("../server/quizState");

test("回答PCの接続と切断を管理する", () => {
  const state = createQuizState();
  assert.equal(state.getSnapshot()[0].connected, false);

  state.registerConnection("pc1", "socket-1");
  assert.equal(state.getSnapshot()[0].connected, true);

  state.unregisterConnection("pc1", "socket-1");
  assert.equal(state.getSnapshot()[0].connected, false);
});

test("最終回答と判定結果を保存する", () => {
  const state = createQuizState();
  state.recordAnswer("pc2", "365日", true);
  const pc2 = state.getSnapshot().find((player) => player.pcId === "pc2");

  assert.equal(pc2.lastAnswer, "365日");
  assert.equal(pc2.correct, true);
  assert.equal(pc2.status, "correct");
});
