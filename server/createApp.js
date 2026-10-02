const path = require("path");
const express = require("express");
const { getQuestionForPc, isValidPcId } = require("./questions");
const { isCorrectAnswer } = require("./answers");
const { createQuizState } = require("./quizState");
const { sendPlayerAgentCommand } = require("./playerAgentClient");

function createApp(options = {}) {
  const app = express();
  const publicDir = path.join(__dirname, "..", "public");
  const quizState = options.quizState || createQuizState();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "10kb" }));

  app.get("/", (_request, response) => response.redirect("/player"));
  app.get("/api/question", (request, response) => {
    const pcId = String(request.query.pcId || "").toLowerCase();
    const question = getQuestionForPc(pcId);

    if (!question) {
      return response.status(400).json({ error: "端末IDが正しくありません。" });
    }

    response.set("Cache-Control", "no-store");
    return response.json({ pcId, question });
  });

  app.post("/api/answer", (request, response) => {
    const { pcId: rawPcId, questionId, answer } = request.body ?? {};
    const pcId = typeof rawPcId === "string" ? rawPcId.toLowerCase() : "";
    const numericQuestionId = Number(questionId);
    const question = getQuestionForPc(pcId);

    if (!isValidPcId(pcId)) {
      return response.status(400).json({ error: "端末IDが正しくありません。" });
    }
    if (!question || question.id !== numericQuestionId) {
      return response.status(400).json({ error: "この端末に割り当てられた問題ではありません。" });
    }
    if (typeof answer !== "string" || answer.trim().length === 0) {
      return response.status(400).json({ error: "回答を入力してください。" });
    }
    if (answer.length > 100) {
      return response.status(400).json({ error: "回答が長すぎます。" });
    }

    quizState.setStatus(pcId, "judging");
    const correct = isCorrectAnswer(numericQuestionId, answer);
    quizState.recordAnswer(pcId, answer, correct);
    return response.json({ correct });
  });

  app.get("/player", (_request, response) => {
    response.sendFile(path.join(publicDir, "player", "index.html"));
  });

  app.get("/admin", (_request, response) => {
    response.sendFile(path.join(publicDir, "admin", "index.html"));
  });

  app.post("/api/player/serial/send", async (request, response) => {
    const { pcId, text } = request.body ?? {};

    if (typeof pcId !== "string" || typeof text !== "string") {
      return response.status(400).json({ ok: false, error: "pcId と text が必要です。" });
    }

    const result = await sendPlayerAgentCommand(pcId, text);
    if (!result.ok) {
      return response.status(503).json({ ok: false, error: result.error || "player agent request failed" });
    }

    return response.json({ ok: true, result });
  });

  app.use(express.static(publicDir, {
    dotfiles: "deny",
    index: false,
    maxAge: 0
  }));

  app.use((error, _request, response, _next) => {
    console.error("Request error:", error.message);
    response.status(400).json({ error: "リクエストを処理できませんでした。" });
  });

  app.use((_request, response) => {
    response.status(404).json({ error: "ページが見つかりません。" });
  });

  return app;
}

module.exports = { createApp };
