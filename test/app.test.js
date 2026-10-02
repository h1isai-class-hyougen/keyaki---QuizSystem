process.env.QUESTION_1_ANSWER = "富士山|ふじさん";
process.env.QUESTION_2_ANSWER = "365|365日";
process.env.QUESTION_3_ANSWER = "4516";

const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../server/createApp");

async function startTestServer() {
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

test("pc1には問題1だけを返し、正解を含めない", async (context) => {
  const { server, baseUrl } = await startTestServer();
  context.after(() => server.close());
  const response = await fetch(`${baseUrl}/api/question?pcId=pc1`);
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.equal(body.includes('"id":1'), true);
  assert.equal(body.includes('"id":2'), false);
  assert.equal(body.includes("correct"), false);
  assert.equal(body.includes("4516"), false);
});

test("直接入力した正しい回答にはtrueだけを返す", async (context) => {
  const { server, baseUrl } = await startTestServer();
  context.after(() => server.close());
  const response = await fetch(`${baseUrl}/api/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pcId: "pc1", questionId: 1, answer: " ふじ さん " })
  });
  assert.deepEqual(await response.json(), { correct: true });
});

test("不正解時にも正解を返さない", async (context) => {
  const { server, baseUrl } = await startTestServer();
  context.after(() => server.close());
  const response = await fetch(`${baseUrl}/api/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pcId: "pc3", questionId: 3, answer: "0" })
  });
  assert.deepEqual(await response.json(), { correct: false });
});

test("別のPCに割り当てた問題への回答を拒否する", async (context) => {
  const { server, baseUrl } = await startTestServer();
  context.after(() => server.close());
  const response = await fetch(`${baseUrl}/api/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pcId: "pc1", questionId: 2, answer: "365" })
  });
  assert.equal(response.status, 400);
});

test("存在しない端末IDを拒否する", async (context) => {
  const { server, baseUrl } = await startTestServer();
  context.after(() => server.close());
  const response = await fetch(`${baseUrl}/api/question?pcId=pc9`);
  assert.equal(response.status, 400);
});

test("ローカルエージェントへLAN経由でシリアル文字列を送れる", async (context) => {
  const targetServer = http.createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      const payload = JSON.parse(body || "{}");
      assert.equal(payload.text, "true");
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
    });
  });

  await new Promise((resolve) => targetServer.listen(0, "127.0.0.1", resolve));
  const { port } = targetServer.address();
  const prefix = `http://127.0.0.1:${port}`;
  process.env.PLAYER_AGENT_URLS = `pc1=${prefix}`;
  context.after(() => {
    delete process.env.PLAYER_AGENT_URLS;
    targetServer.close();
  });

  const { server, baseUrl } = await startTestServer();
  context.after(() => server.close());

  const response = await fetch(`${baseUrl}/api/player/serial/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pcId: "pc1", text: "true" })
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, result: { ok: true, status: 200, payload: { ok: true } } });
});
