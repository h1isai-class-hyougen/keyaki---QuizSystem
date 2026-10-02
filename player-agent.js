"use strict";

const express = require("express");

let SerialPort = null;
try {
  ({ SerialPort } = require("serialport"));
} catch {
  SerialPort = null;
}

const app = express();
const agentPort = Number(process.env.PLAYER_AGENT_PORT || 3100);
const serialPortPath = process.env.SERIAL_PORT || "/dev/ttyUSB0";
const serialBaudRate = Number(process.env.SERIAL_BAUD_RATE || 115200);
let openPort = null;

app.disable("x-powered-by");
app.use(express.json({ limit: "1kb" }));

function getSerialPort() {
  if (!SerialPort) {
    throw new Error("serialport が未インストールです。npm install serialport を実行してください。");
  }

  if (!openPort) {
    openPort = new SerialPort({
      path: serialPortPath,
      baudRate: serialBaudRate,
      autoOpen: false
    });
  }

  return openPort;
}

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    serialPort: serialPortPath,
    baudRate: serialBaudRate,
    port: agentPort
  });
});

app.post("/api/serial/send", async (request, response) => {
  const text = typeof request.body?.text === "string" ? request.body.text : "";

  if (!text) {
    return response.status(400).json({ ok: false, error: "text が必要です。" });
  }

  try {
    const port = getSerialPort();

    if (!port.isOpen) {
      await new Promise((resolve, reject) => {
        port.once("open", resolve);
        port.once("error", reject);
        port.open((error) => {
          if (error) reject(error);
        });
      });
    }

    port.write(`${text.trim()}\n`);
    return response.json({ ok: true, text });
  } catch (error) {
    return response.status(503).json({
      ok: false,
      error: error.message || "serial output failed"
    });
  }
});

app.use((error, _request, response, _next) => {
  console.error("player-agent error:", error.message);
  response.status(500).json({ ok: false, error: "player-agent failed" });
});

app.listen(agentPort, "0.0.0.0", () => {
  console.log(`player agent started: http://localhost:${agentPort}`);
  console.log(`serial port: ${serialPortPath} @ ${serialBaudRate} bps`);
});
