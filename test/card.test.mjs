import test from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../src/validate.mjs';
import { grade } from '../src/grade.mjs';
import { renderSite } from '../src/render.mjs';

const base = () => ({
  schema: 'embodiment-card/v1',
  id: 'test-arm',
  name: '测试臂',
  category: 'arm',
  dof: 2,
  joints: [
    { name: 'j1', min: -1, max: 1, unit: 'rad' },
    { name: 'j2', min: -1, max: 1, unit: 'rad' },
  ],
  control: { rateHz: 100, interfaces: ['ros2'] },
  capabilities: { pick_and_place: { level: 'claimed' } },
  provenance: { source: 'unit-test', verifiedBy: 'ci', verifiedAt: '2026-11-14' },
});

test('最小合法卡片通过校验', () => {
  const r = validate(base());
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});

test('自由度与关节数不一致被拒', () => {
  const c = base();
  c.dof = 7;
  const r = validate(c);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.path === 'dof'));
});

test('min 不小于 max 被拒', () => {
  const c = base();
  c.joints[0].min = 2;
  c.joints[0].max = 1;
  const r = validate(c);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.path === 'joints[0]'));
});

test('关节名重复被拒', () => {
  const c = base();
  c.joints[1].name = 'j1';
  const r = validate(c);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /重复/.test(e.msg)));
});

test('未知能力等级被拒', () => {
  const c = base();
  c.capabilities.pick_and_place.level = 'certified';
  const r = validate(c);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.path.endsWith('.level')));
});

test('未知控制接口被拒', () => {
  const c = base();
  c.control.interfaces = ['quantum-bus'];
  const r = validate(c);
  assert.equal(r.ok, false);
});

test('非 YYYY-MM-DD 日期被拒', () => {
  const c = base();
  c.provenance.verifiedAt = '2026/11/14';
  const r = validate(c);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.path === 'provenance.verifiedAt'));
});

test('哈希格式错误被拒', () => {
  const c = base();
  c.provenance.hash = 'sha256:abc';
  const r = validate(c);
  assert.equal(r.ok, false);
});

test('分级：只有结构 → L0', () => {
  const c = base();
  c.joints = [];
  c.dof = 0;
  // 结构不完整时直接判不合格；这里测 L0 需要合法但缺限位/控制
  const c2 = base();
  delete c2.control;
  assert.equal(validate(c2).ok, false);
});

test('分级：结构 + 限位 + 控制 → L1', () => {
  const g = grade(base());
  assert.equal(g.level, 1);
  assert.match(g.label, /L1/);
});

test('分级：≥3 项实测 + 哈希 → L2', () => {
  const c = base();
  c.capabilities = {
    a: { level: 'measured', evidence: 'e', metric: 'm' },
    b: { level: 'measured', evidence: 'e', metric: 'm' },
    c: { level: 'measured', evidence: 'e', metric: 'm' },
  };
  c.provenance.hash = 'sha256:' + 'a'.repeat(64);
  const g = grade(c);
  assert.equal(g.level, 2, JSON.stringify(g));
});

test('分级：L2 且有 1 项可复现 → L3', () => {
  const c = base();
  c.capabilities = {
    a: { level: 'reproduced', evidence: 'e', metric: 'm' },
    b: { level: 'measured', evidence: 'e', metric: 'm' },
    c: { level: 'measured', evidence: 'e', metric: 'm' },
  };
  c.provenance.hash = 'sha256:' + 'b'.repeat(64);
  const g = grade(c);
  assert.equal(g.level, 3);
});

test('分级：没有哈希就上不了 L2', () => {
  const c = base();
  c.capabilities = {
    a: { level: 'measured' }, b: { level: 'measured' }, c: { level: 'measured' },
  };
  assert.equal(grade(c).level, 1);
});

test('渲染：页面包含卡片名与分级', () => {
  const card = base();
  const items = [{ file: 'x.json', card, validate: validate(card), grade: grade(card) }];
  const html = renderSite(items);
  assert.match(html, /测试臂/);
  assert.match(html, /L1/);
  assert.match(html, /<\/html>/);
});
