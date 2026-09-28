require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");
const { createApp } = require("./server/createApp");
const { hasAllAnswers } = require("./server/answers");
const { isValidPcId, questions } = require("./server/questions");
const { createQuizState } = require("./server/quizState");

const port = Number(process.env.PORT) || 3000;

if (!hasAllAnswers(questions.map((question) => question.id))) {
  console.error("起動できません: .env に全問題の正解を設定してください。");
  process.exit(1);
}

const quizState = createQuizState();
const app = createApp({ quizState });
const server = http.createServer(app);

const io = new Server(server);
quizState.setOnChange((players) => {
  io.to("admins").emit("admin:state", { players });
});

io.on("connection", (socket) => {
  socket.emit("server:ready", { ready: true });

  socket.on("admin:register", () => {
    socket.join("admins");
    socket.emit("admin:state", { players: quizState.getSnapshot() });
  });

  socket.on("player:register", (payload = {}, acknowledge = () => {}) => {
    const pcId = typeof payload.pcId === "string" ? payload.pcId.toLowerCase() : "";
    if (!isValidPcId(pcId)) {
      acknowledge({ ok: false, error: "端末IDが正しくありません。" });
      return;
    }

    if (socket.data.pcId && socket.data.pcId !== pcId) {
      quizState.unregisterConnection(socket.data.pcId, socket.id);
    }

    socket.data.pcId = pcId;
    quizState.registerConnection(pcId, socket.id);
    acknowledge({ ok: true, pcId });
  });

  socket.on("player:status", (payload = {}) => {
    if (!socket.data.pcId) return;
    quizState.setStatus(socket.data.pcId, payload.status);
  });

  socket.on("disconnect", () => {
    if (socket.data.pcId) {
      quizState.unregisterConnection(socket.data.pcId, socket.id);
    }
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`クイズサーバーを起動しました: http://localhost:${port}/player`);
  console.log(`管理画面: http://localhost:${port}/admin`);
  console.log(`LAN内の回答PCからは http://<管理PCのIP>:${port}/player へアクセスしてください。`);
});
