// 零依赖校验器：只查规范里写死的东西，不做"猜测式"校验。
const LEVELS = ['none', 'claimed', 'measured', 'reproduced'];
const CATEGORIES = ['arm', 'humanoid', 'mobile', 'quadruped', 'hand', 'other'];
const INTERFACES = ['ros2', 'ros1', 'fci', 'modbus', 'can', 'ethercat', 'serial', 'sdk', 'http', 'grpc'];
const UNITS = ['rad', 'deg', 'm'];

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function validate(card) {
  const errors = [];
  const warnings = [];
  const E = (path, msg) => errors.push({ path, msg });
  const W = (path, msg) => warnings.push({ path, msg });

  if (!card || typeof card !== 'object' || Array.isArray(card)) {
    return { ok: false, errors: [{ path: '$', msg: '不是一个对象' }], warnings };
  }
  if (card.schema !== 'embodiment-card/v1') E('schema', '必须是 "embodiment-card/v1"');
  if (typeof card.id !== 'string' || !/^[a-z0-9][a-z0-9-]{1,47}$/.test(card.id)) {
    E('id', '需为 2–48 位小写字母/数字/连字符，且以字母或数字开头');
  }
  if (typeof card.name !== 'string' || card.name.trim().length < 2) E('name', '必填，至少 2 个字符');
  if (card.vendor !== undefined && typeof card.vendor !== 'string') E('vendor', '需为字符串');
  if (!CATEGORIES.includes(card.category)) E('category', `需为 ${CATEGORIES.join(' / ')} 之一`);
  if (!Number.isInteger(card.dof) || card.dof < 1) E('dof', '需为正整数');

  // 关节
  if (!Array.isArray(card.joints) || card.joints.length === 0) {
    E('joints', '至少一个关节');
  } else {
    const seen = new Set();
    card.joints.forEach((j, i) => {
      const p = `joints[${i}]`;
      if (!j || typeof j !== 'object') return E(p, '需为对象');
      if (typeof j.name !== 'string' || !j.name) E(`${p}.name`, '必填');
      else if (seen.has(j.name)) E(`${p}.name`, `关节名重复：${j.name}`);
      else seen.add(j.name);
      if (!isNum(j.min) || !isNum(j.max)) E(p, 'min / max 必须是有限数');
      else if (j.min >= j.max) E(p, `min(${j.min}) 必须小于 max(${j.max})`);
      if (j.unit !== undefined && !UNITS.includes(j.unit)) E(`${p}.unit`, `需为 ${UNITS.join(' / ')} 之一`);
      if (j.velocityMax !== undefined && !(isNum(j.velocityMax) && j.velocityMax > 0)) {
        E(`${p}.velocityMax`, '需为正数');
      }
    });
    if (Number.isInteger(card.dof) && card.joints.length !== card.dof) {
      E('dof', `声明 ${card.dof} 自由度，但 joints 有 ${card.joints.length} 项`);
    }
  }

  // 控制
  if (!card.control || typeof card.control !== 'object') {
    E('control', '必填');
  } else {
    if (!isNum(card.control.rateHz) || card.control.rateHz <= 0) E('control.rateHz', '需为正数');
    if (!Array.isArray(card.control.interfaces) || card.control.interfaces.length === 0) {
      E('control.interfaces', '至少一个接口');
    } else {
      card.control.interfaces.forEach((it, i) => {
        if (!INTERFACES.includes(it)) E(`control.interfaces[${i}]`, `未知接口：${it}`);
      });
    }
  }

  // 能力
  const caps = card.capabilities;
  if (!caps || typeof caps !== 'object' || Array.isArray(caps)) {
    E('capabilities', '必填对象');
  } else {
    const entries = Object.entries(caps);
    if (entries.length === 0) W('capabilities', '一条能力都没有，卡片只描述结构');
    for (const [k, v] of entries) {
      const p = `capabilities.${k}`;
      if (!/^[a-z][a-z0-9_]{1,39}$/.test(k)) E(p, '能力名需为小写蛇形命名');
      if (!v || typeof v !== 'object') { E(p, '需为对象'); continue; }
      if (!LEVELS.includes(v.level)) E(`${p}.level`, `需为 ${LEVELS.join(' / ')} 之一`);
      if (v.at !== undefined && !isDate(v.at)) E(`${p}.at`, '日期需为 YYYY-MM-DD');
      if (v.level === 'measured' || v.level === 'reproduced') {
        if (!v.evidence) W(`${p}.evidence`, `${v.level} 等级建议给出证据出处`);
        if (!v.metric) W(`${p}.metric`, `${v.level} 等级建议给出可复算的指标`);
      }
    }
  }

  // 出处
  const pv = card.provenance;
  if (!pv || typeof pv !== 'object') {
    E('provenance', '必填');
  } else {
    if (typeof pv.source !== 'string' || !pv.source) E('provenance.source', '必填');
    if (typeof pv.verifiedBy !== 'string' || !pv.verifiedBy) E('provenance.verifiedBy', '必填');
    if (!isDate(pv.verifiedAt)) E('provenance.verifiedAt', '日期需为 YYYY-MM-DD');
    if (pv.hash !== undefined && !/^sha256:[0-9a-f]{64}$/.test(pv.hash)) {
      E('provenance.hash', '需为 sha256:<64 位小写十六进制>');
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
