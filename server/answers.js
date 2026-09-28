function normalizeAnswer(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, "")
    .toLocaleLowerCase("ja-JP");
}

function getCorrectAnswer(questionId) {
  return process.env[`QUESTION_${questionId}_ANSWER`];
}

function hasAllAnswers(questionIds) {
  return questionIds.every((id) => {
    const answer = getCorrectAnswer(id);
    return typeof answer === "string" && answer.trim().length > 0;
  });
}

function isCorrectAnswer(questionId, submittedAnswer) {
  const configuredAnswers = getCorrectAnswer(questionId);
  if (configuredAnswers === undefined) return false;

  const normalizedInput = normalizeAnswer(submittedAnswer);
  return configuredAnswers
    .split("|")
    .map(normalizeAnswer)
    .filter(Boolean)
    .includes(normalizedInput);
}

module.exports = { hasAllAnswers, isCorrectAnswer, normalizeAnswer };
