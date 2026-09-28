(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const VALID_PC_IDS = new Set(["pc1", "pc2", "pc3"]);
  const PC_ID_KEY = "keyakiQuizPcId";
  const RESULT_TIME_MS = 3000;

  const ui = {
    loading: $("#loading-view"),
    quiz: $("#quiz-view"),
    result: $("#result-view"),
    setup: $("#setup-view"),
    error: $("#error-view"),
    deviceName: $("#device-name"),
    questionNumber: $("#question-number"),
    questionText: $("#question-text"),
    answer: $("#answer-input"),
    form: $("#answer-form"),
    message: $("#form-message"),
    submit: $("#submit-button"),
    resultMark: $("#result-mark"),
    resultLabel: $("#result-label"),
    resultTitle: $("#result-title"),
    resultMessage: $("#result-message"),
    retry: $("#retry-button"),
    errorMessage: $("#error-message")
  };

  const views = [ui.loading, ui.quiz, ui.result, ui.setup, ui.error];
  const pcId = getPcId();
  let question;
  let socket;
  let resultTimer;

  function getPcId() {
    const fromUrl = new URLSearchParams(location.search).get("id")?.toLowerCase();

    if (VALID_PC_IDS.has(fromUrl)) {
      localStorage.setItem(PC_ID_KEY, fromUrl);
      return fromUrl;
    }

    const saved = localStorage.getItem(PC_ID_KEY)?.toLowerCase();
    return VALID_PC_IDS.has(saved) ? saved : null;
  }

  function show(view) {
    for (const item of views) {
      item.hidden = item !== view;
    }
  }

  function sendStatus(status) {
    if (socket?.connected) {
      socket.emit("player:status", { status });
    }
  }

  function connect() {
    socket = window.io();
    socket.on("connect", () => {
      socket.emit("player:register", { pcId });
    });
  }

  function setSubmitting(busy) {
    ui.submit.disabled = busy;
    ui.submit.textContent = busy ? "判定中…" : "回答する";
  }

  async function loadQuestion() {
    show(ui.loading);

    try {
      const response = await fetch(`/api/question?pcId=${encodeURIComponent(pcId)}`, {
        cache: "no-store"
      });
      const data = await response.json();

      if (!response.ok || !data.question) {
        throw new Error(data.error || "問題データを取得できませんでした。");
      }

      question = data.question;
      showQuestion();
    } catch (error) {
      showError(error.message);
    }
  }

  function showQuestion() {
    clearTimeout(resultTimer);
    ui.questionNumber.textContent = question.id;
    ui.questionText.textContent = question.text;
    ui.answer.value = "";
    ui.answer.placeholder = question.placeholder || "答えを入力";
    ui.answer.inputMode = question.inputMode || "text";
    ui.message.textContent = "";
    setSubmitting(false);
    show(ui.quiz);
    sendStatus("waiting");
    setTimeout(() => ui.answer.focus(), 0);
  }

  async function submitAnswer(event) {
    event.preventDefault();
    const answer = ui.answer.value.trim();

    if (!answer) {
      ui.message.textContent = "答えを入力してください。";
      return;
    }

    ui.message.textContent = "";
    setSubmitting(true);
    sendStatus("judging");

    try {
      const response = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pcId, questionId: question.id, answer })
      });
      const data = await response.json();

      if (!response.ok || typeof data.correct !== "boolean") {
        throw new Error(data.error || "回答を判定できませんでした。");
      }

      showResult(data.correct);
    } catch (error) {
      setSubmitting(false);
      ui.message.textContent = `${error.message} もう一度お試しください。`;
      sendStatus("waiting");
    }
  }

  function showResult(correct) {
    ui.result.classList.toggle("correct", correct);
    ui.result.classList.toggle("incorrect", !correct);
    ui.resultMark.textContent = correct ? "○" : "×";
    ui.resultLabel.textContent = correct ? "CORRECT" : "INCORRECT";
    ui.resultTitle.textContent = correct ? "正解！" : "不正解";
    ui.resultMessage.textContent = "3秒後に問題画面へ戻ります。";
    show(ui.result);
    sendStatus(correct ? "correct" : "incorrect");
    resultTimer = setTimeout(showQuestion, RESULT_TIME_MS);
  }

  function showError(message) {
    ui.errorMessage.textContent = message;
    show(ui.error);
  }

  ui.form.addEventListener("submit", submitAnswer);
  ui.answer.addEventListener("input", () => {
    sendStatus(ui.answer.value.trim() ? "answering" : "waiting");
  });
  ui.retry.addEventListener("click", loadQuestion);

  if (pcId) {
    ui.deviceName.textContent = pcId.toUpperCase();
    connect();
    loadQuestion();
  } else {
    ui.deviceName.textContent = "未設定";
    show(ui.setup);
  }
})();
