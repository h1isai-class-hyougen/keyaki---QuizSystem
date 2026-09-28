// 問題文はブラウザへ送られる。正解は .env で管理する。
const questions = [
  {
    id: 1,
    type: "text",
    text: "日本でいちばん高い山はどれ？",
    placeholder: "山の名前を入力"
  },
  {
    id: 2,
    type: "text",
    text: "1年は、うるう年でない場合は何日？",
    placeholder: "日数を入力",
    inputMode: "numeric"
  },
  {
    id: 3,
    type: "text",
    text: "1234 + 3282 はいくつ？",
    placeholder: "数字を入力",
    inputMode: "numeric"
  }
];

// 回答PCと問題の対応
const playerAssignments = Object.freeze({
  pc1: 1,
  pc2: 2,
  pc3: 3
});

function isValidPcId(pcId) {
  return Object.hasOwn(playerAssignments, pcId);
}

function getQuestionForPc(pcId) {
  if (!isValidPcId(pcId)) return undefined;
  const questionId = playerAssignments[pcId];
  return questions.find((question) => question.id === questionId);
}

module.exports = {
  getQuestionForPc,
  isValidPcId,
  playerAssignments,
  questions
};
