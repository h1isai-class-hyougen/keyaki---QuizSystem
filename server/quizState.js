const { getQuestionForPc, playerAssignments } = require("./questions");

const VALID_STATUSES = new Set([
  "waiting",
  "answering",
  "judging",
  "correct",
  "incorrect"
]);

function createQuizState() {
  const connections = new Map();
  const players = new Map();
  let onChange = () => {};

  for (const pcId of Object.keys(playerAssignments)) {
    connections.set(pcId, new Set());
    players.set(pcId, {
      connected: false,
      status: "waiting",
      lastAnswer: null,
      correct: null,
      updatedAt: null
    });
  }

  function getSnapshot() {
    return Object.keys(playerAssignments).map((pcId) => {
      const question = getQuestionForPc(pcId);
      return {
        pcId,
        ...players.get(pcId),
        question: {
          id: question.id,
          text: question.text
        }
      };
    });
  }

  function notify() {
    onChange(getSnapshot());
  }

  function updatePlayer(pcId, changes) {
    const current = players.get(pcId);
    if (!current) return false;

    players.set(pcId, {
      ...current,
      ...changes,
      updatedAt: new Date().toISOString()
    });
    notify();
    return true;
  }

  function registerConnection(pcId, socketId) {
    const playerConnections = connections.get(pcId);
    if (!playerConnections) return false;
    playerConnections.add(socketId);
    return updatePlayer(pcId, { connected: true, status: "waiting" });
  }

  function unregisterConnection(pcId, socketId) {
    const playerConnections = connections.get(pcId);
    if (!playerConnections) return false;
    playerConnections.delete(socketId);
    if (playerConnections.size === 0) {
      return updatePlayer(pcId, { connected: false });
    }
    return true;
  }

  function setStatus(pcId, status) {
    if (!VALID_STATUSES.has(status)) return false;
    return updatePlayer(pcId, { status });
  }

  function recordAnswer(pcId, answer, correct) {
    return updatePlayer(pcId, {
      status: correct ? "correct" : "incorrect",
      lastAnswer: answer,
      correct
    });
  }

  function setOnChange(callback) {
    onChange = typeof callback === "function" ? callback : () => {};
  }

  return {
    getSnapshot,
    recordAnswer,
    registerConnection,
    setOnChange,
    setStatus,
    unregisterConnection
  };
}

module.exports = { createQuizState };
