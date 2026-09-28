(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const STATUS_TEXT = {
    waiting: "回答待ち",
    answering: "回答中",
    judging: "判定中",
    correct: "正解表示中",
    incorrect: "不正解表示中"
  };

  const serverStatus = $("#server-status");
  const playerGrid = $("#player-grid");
  const socket = window.io();

  function text(tag, className, value) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = value;
    return element;
  }

  function formatTime(value) {
    if (!value) return "更新履歴なし";

    const time = new Intl.DateTimeFormat("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date(value));

    return `最終更新 ${time}`;
  }

  function makeConnectionBadge(connected) {
    const badge = document.createElement("span");
    badge.className = "connection-badge";
    badge.dataset.connected = String(connected);
    badge.append(text("span", "status-dot", ""));
    badge.append(connected ? "接続中" : "未接続");
    return badge;
  }

  function makeDetail(label, value, className = "detail-value") {
    const group = document.createElement("div");
    group.append(text("p", "detail-label", label));
    group.append(text("p", className, value));
    return group;
  }

  function getResult(player) {
    if (player.correct === null) {
      return { text: "—", className: "detail-value" };
    }

    return player.correct
      ? { text: "正解", className: "detail-value result-correct" }
      : { text: "不正解", className: "detail-value result-incorrect" };
  }

  function makePlayerCard(player) {
    const card = document.createElement("article");
    card.className = "player-card";

    const header = document.createElement("header");
    header.className = "player-card-header";
    header.append(text("h2", "player-name", player.pcId.toUpperCase()));
    header.append(makeConnectionBadge(player.connected));
    card.append(header);

    card.append(text("p", "question-label", `問題 ${player.question.id}`));
    card.append(text("p", "question-text", player.question.text));

    const details = document.createElement("div");
    details.className = "card-details";

    const state = document.createElement("div");
    state.append(text("p", "detail-label", "現在の状態"));
    const stateBadge = text("span", "state-badge", STATUS_TEXT[player.status] || player.status);
    stateBadge.dataset.status = player.status;
    state.append(stateBadge);
    details.append(state);

    const result = getResult(player);
    details.append(makeDetail("最終判定", result.text, result.className));
    details.append(makeDetail("最終回答", player.lastAnswer ?? "—"));
    details.append(text("p", "updated-at", formatTime(player.updatedAt)));

    card.append(details);
    return card;
  }

  function setServerStatus(connected) {
    serverStatus.dataset.connected = String(connected);
    serverStatus.lastChild.textContent = connected ? " 管理PCと接続中" : " 再接続中…";
  }

  socket.on("connect", () => {
    setServerStatus(true);
    socket.emit("admin:register");
  });

  socket.on("disconnect", () => setServerStatus(false));

  socket.on("admin:state", ({ players }) => {
    if (Array.isArray(players)) {
      playerGrid.replaceChildren(...players.map(makePlayerCard));
    }
  });
})();
