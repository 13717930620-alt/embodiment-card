// 分级：不评价机器人好不好，只评价"这张卡片能背多少责任"。
// L0 结构 / L1 可控 / L2 有实测 / L3 可复现
const WEIGHT = { none: 0, claimed: 1, measured: 2, reproduced: 3 };

export function grade(card) {
  const caps = Object.entries(card.capabilities || {});
  const byLevel = { none: 0, claimed: 0, measured: 0, reproduced: 0 };
  for (const [, v] of caps) byLevel[v.level] = (byLevel[v.level] || 0) + 1;

  const hasLimits = Array.isArray(card.joints) && card.joints.length > 0
    && card.joints.every((j) => Number.isFinite(j.min) && Number.isFinite(j.max) && j.min < j.max);
  const hasControl = !!(card.control && card.control.rateHz > 0 && card.control.interfaces?.length);
  const hasHash = /^sha256:[0-9a-f]{64}$/.test(card.provenance?.hash || '');

  const reasons = [];
  let level = 0;

  if (card.id && card.name && card.category && Number.isInteger(card.dof) && card.provenance?.verifiedBy) {
    level = 0;
    reasons.push('结构完整：身份、类别、自由度、出处');
  } else {
    return { level: -1, label: '不合格', score: 0, reasons: ['结构不完整，无法评级'], byLevel };
  }

  if (hasLimits && hasControl) {
    level = 1;
    reasons.push('可控：关节限位齐全 + 控制频率与接口已声明');
  }
  const measuredPlus = byLevel.measured + byLevel.reproduced;
  if (level >= 1 && measuredPlus >= 3 && hasHash) {
    level = 2;
    reasons.push(`有实测：${measuredPlus} 项能力达到 measured 及以上，且卡片带内容哈希`);
  }
  if (level >= 2 && byLevel.reproduced >= 1) {
    level = 3;
    reasons.push(`可复现：${byLevel.reproduced} 项能力被第三方复现过`);
  }

  // 分数只用来排序，不用来"评优劣"：覆盖率 60 + 证据强度 40
  const coverage = Math.min(1, caps.length / 8);
  const strength = caps.length
    ? caps.reduce((s, [, v]) => s + (WEIGHT[v.level] || 0), 0) / (caps.length * 3)
    : 0;
  const score = Math.round((coverage * 0.6 + strength * 0.4) * 100);

  const label = ['L0 结构', 'L1 可控', 'L2 有实测', 'L3 可复现'][level];
  return { level, label, score, reasons, byLevel, coverage: Math.round(coverage * 100), strength: Math.round(strength * 100) };
}

export const LEVEL_WEIGHT = WEIGHT;
