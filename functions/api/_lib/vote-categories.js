// 投票カテゴリ・候補のマスタ定義。フロント・API・管理画面が参照する唯一のソース。

export const TEAMS = [
  { id: 1, name: "CRIMSON" },
  { id: 2, name: "NOVA" },
  { id: 3, name: "GOLDEN" },
];

// 3チーム × 3名 = 9名。リーダーは全チーム3番手。
export const MEMBERS = [
  { id: 1, teamId: 1, name: "んごご🍋‍🟩" },
  { id: 2, teamId: 1, name: "PK" },
  { id: 3, teamId: 1, name: "まぐろふぉん" },
  { id: 4, teamId: 2, name: "なぽる" },
  { id: 5, teamId: 2, name: "犬飼音子(ねこ)" },
  { id: 6, teamId: 2, name: "りんか🔔" },
  { id: 7, teamId: 3, name: "🐻‍❄️あわ🥚" },
  { id: 8, teamId: 3, name: "潮てら🐳💛" },
  { id: 9, teamId: 3, name: "iran👳🏾‍♂️痔" },
];

const TEAM_IDS = TEAMS.map((t) => t.id);
const MEMBER_IDS = MEMBERS.map((m) => m.id);

// type: 'team' は候補がチーム、'individual' は候補がメンバー
// individual カテゴリ間では同一メンバーを複数賞に選択不可（unique 制約）
export const CATEGORIES = [
  {
    id: "team",
    type: "team",
    label: "優勝チーム投票",
    candidateType: "team",
    candidateIds: TEAM_IDS,
  },
  {
    id: "mvp",
    type: "individual",
    label: "MVP（最優秀歌唱賞）",
    candidateType: "member",
    candidateIds: MEMBER_IDS,
  },
  {
    id: "entertainer",
    type: "individual",
    label: "最優秀エンタメ賞",
    candidateType: "member",
    candidateIds: MEMBER_IDS,
  },
  {
    id: "moment",
    type: "individual",
    label: "ベストモーメント賞",
    candidateType: "member",
    candidateIds: MEMBER_IDS,
  },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
export const INDIVIDUAL_CATEGORY_IDS = CATEGORIES
  .filter((c) => c.type === "individual")
  .map((c) => c.id);

export function getCategory(categoryId) {
  return CATEGORIES.find((c) => c.id === categoryId) || null;
}

export function isValidCandidateForCategory(categoryId, candidateId) {
  const cat = getCategory(categoryId);
  if (!cat) return false;
  const numId = Number(candidateId);
  if (!Number.isFinite(numId)) return false;
  return cat.candidateIds.includes(numId);
}
