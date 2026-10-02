(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const VALID_PC_IDS = new Set(["pc1", "pc2", "pc3"]);
  const PC_ID_KEY = "keyakiQuizPcId";
  const RESULT_TIME_MS = 3000;
  const SERIAL_BAUD_RATE = 115200;
  const LAB_COMMAND = [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
    "KeyB",
    "KeyA"
  ];
  const textEncoder = new TextEncoder();

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
  const usbSupported = "serial" in navigator;
  let question;
  let socket;
  let resultTimer;
  let usbPort = null;
  let usbWriter = null;
  let usbConnected = false;
  let usbBusy = false;
  let usbMessage = usbSupported ? "USB未接続" : "このブラウザはUSBシリアル非対応です";
  let usbAreaHidden = false;
  let labCommandIndex = 0;
  let questionPulseTimer = null;

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

  function renderUsbStatus() {
    return;
  }

  function toggleUsbArea() {
    if (document.querySelector("#usb-area")) {
      document.querySelector("#usb-area").remove();
      return;
    }

    const usbArea = document.createElement("div");
    usbArea.id = "usb-area";
    usbArea.className = "usb-area";
    usbArea.innerHTML = `
      <button id="usb-connect-button" class="secondary-button usb-button" type="button">USB接続</button>
      <p id="usb-status" class="usb-status" aria-live="polite">USB未接続</p>
    `;

    const topbar = document.querySelector(".topbar");
    if (topbar) {
      topbar.appendChild(usbArea);
    }

    const reconnectButton = document.querySelector("#usb-connect-button");
    const reconnectStatus = document.querySelector("#usb-status");
    if (reconnectButton && reconnectStatus) {
      reconnectButton.addEventListener("click", () => {
        if (usbConnected) {
          void disconnectUsb();
          return;
        }

        void connectUsb();
      });
      reconnectButton.textContent = usbConnected ? "USB切断" : "USB接続";
      reconnectStatus.textContent = usbMessage;
    }
  }

  function triggerQuestionPulse() {
    const input = document.querySelector("#answer-input");
    if (!input) return;

    input.classList.remove("is-reacting");
    void input.offsetWidth;
    input.classList.add("is-reacting");

    if (questionPulseTimer) {
      clearTimeout(questionPulseTimer);
    }

    questionPulseTimer = setTimeout(() => {
      input.classList.remove("is-reacting");
    }, 220);
  }

  function handleLabCommand(event) {
    const current = event.key || event.code;
    const expected = LAB_COMMAND[labCommandIndex];

    if (current === expected || event.code === expected || event.key === expected) {
      labCommandIndex += 1;

      if (labCommandIndex === LAB_COMMAND.length) {
        labCommandIndex = 0;
        toggleUsbArea();
      }
      return;
    }

    if (current === LAB_COMMAND[0] || event.code === LAB_COMMAND[0]) {
      labCommandIndex = 1;
      return;
    }

    labCommandIndex = 0;
  }

  function setUsbStatus(message, connected = usbConnected) {
    usbMessage = message;
    usbConnected = connected;
    renderUsbStatus();
  }

  async function disconnectUsb() {
    usbBusy = true;
    usbMessage = "切断中…";
    renderUsbStatus();

    try {
      if (usbWriter) {
        usbWriter.releaseLock();
        usbWriter = null;
      }

      if (usbPort) {
        await usbPort.close();
      }
    } catch {
      // 切断失敗でも状態は初期化する。
    } finally {
      usbPort = null;
      usbBusy = false;
      setUsbStatus(usbSupported ? "USB未接続" : "このブラウザはUSBシリアル非対応です", false);
    }
  }

  async function connectUsb() {
    if (!usbSupported) {
      setUsbStatus("このブラウザはUSBシリアル非対応です", false);
      return;
    }

    usbBusy = true;
    usbMessage = "USB機器を選択してください…";
    renderUsbStatus();

    let connected = false;

    try {
      usbPort = await navigator.serial.requestPort();
      await usbPort.open({ baudRate: SERIAL_BAUD_RATE });
      usbWriter = usbPort.writable.getWriter();
      connected = true;
      setUsbStatus("USB接続中", true);
    } catch (error) {
      if (usbWriter) {
        try {
          usbWriter.releaseLock();
        } catch {
          // noop
        }
        usbWriter = null;
      }

      if (usbPort) {
        try {
          await usbPort.close();
        } catch {
          // noop
        }
        usbPort = null;
      }

      if (error?.name === "NotFoundError") {
        usbMessage = usbSupported ? "USB未接続" : "このブラウザはUSBシリアル非対応です";
      } else {
        usbMessage = "USB接続に失敗しました";
      }
    } finally {
      usbBusy = false;
      usbConnected = connected;
      renderUsbStatus();
    }
  }

  async function sendUsbResult(correct) {
    if (!usbConnected || !usbWriter) return;

    try {
      await usbWriter.write(textEncoder.encode(`${correct ? "true" : "false"}\n`));
    } catch {
      await disconnectUsb();
    }
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
    void sendUsbResult(correct);
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
  document.addEventListener("keydown", (event) => {
    triggerQuestionPulse();
    handleLabCommand(event);
  });

  renderUsbStatus();

  if (pcId) {
    ui.deviceName.textContent = pcId.toUpperCase();
    connect();
    loadQuestion();
  } else {
    ui.deviceName.textContent = "未設定";
    show(ui.setup);
  }
})();
