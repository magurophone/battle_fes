function normalizeBonusKeyword(value) {
  return String(value || "").trim().replace(/！/g, "!");
}

function isBonusKeywordMatch(submitted, expected) {
  const normalizedExpected = normalizeBonusKeyword(expected);
  if (!normalizedExpected) return false;
  return normalizeBonusKeyword(submitted) === normalizedExpected;
}

export {
  isBonusKeywordMatch,
  normalizeBonusKeyword,
};
