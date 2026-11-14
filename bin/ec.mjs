#!/usr/bin/env node
import { readFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { validate } from '../src/validate.mjs';
import { grade } from '../src/grade.mjs';
import { loadDir, writeSite } from '../src/render.mjs';

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m',
};

function usage() {
  console.log(`embodiment-card

  用法:
    ec check <file.json | 目录>     校验并评级
    ec site  <目录> -o <输出目录>   生成静态卡片墙
    ec init  <id>                   打印一张最小卡片骨架

  退出码: 0 全部通过 / 1 有错误 / 2 用法错误`);
}

function checkOne(path) {
  const card = JSON.parse(readFileSync(path, 'utf8'));
  const v = validate(card);
  const name = card.id || path;
  if (!v.ok) {
    console.log(`${C.red}✗${C.reset} ${C.bold}${name}${C.reset}  ${C.dim}${path}${C.reset}`);
    for (const e of v.errors) console.log(`   ${C.red}${e.path}${C.reset} ${e.msg}`);
    return { ok: false, errors: v.errors.length };
  }
  const g = grade(card);
  console.log(`${C.green}✓${C.reset} ${C.bold}${name}${C.reset}  ${C.cyan}${g.label}${C.reset}  ${C.dim}证据分 ${g.score}${C.reset}`);
  for (const r of g.reasons) console.log(`   ${C.dim}·${C.reset} ${r}`);
  for (const w of v.warnings) console.log(`   ${C.yellow}!${C.reset} ${w.path} ${w.msg}`);
  return { ok: true, level: g.level };
}

const [, , cmd, ...rest] = process.argv;
if (!cmd || cmd === '-h' || cmd === '--help') { usage(); process.exit(cmd ? 0 : 2); }

try {
  if (cmd === 'check') {
    const target = rest[0];
    if (!target) { usage(); process.exit(2); }
    const abs = resolve(target);
    let results;
    if (statSync(abs).isDirectory()) {
      const items = loadDir(abs);
      results = [];
      for (const it of items) {
        if (!it.validate.ok) {
          console.log(`${C.red}✗${C.reset} ${C.bold}${it.file}${C.reset}`);
          for (const e of it.validate.errors) console.log(`   ${C.red}${e.path}${C.reset} ${e.msg}`);
          results.push({ ok: false });
        } else {
          console.log(`${C.green}✓${C.reset} ${C.bold}${it.card.id}${C.reset}  ${C.cyan}${it.grade.label}${C.reset}  ${C.dim}证据分 ${it.grade.score}${C.reset}`);
          for (const w of it.validate.warnings) console.log(`   ${C.yellow}!${C.reset} ${w.path} ${w.msg}`);
          results.push({ ok: true });
        }
      }
      const bad = results.filter((r) => !r.ok).length;
      console.log(`\n${results.length} 张卡片，${results.length - bad} 通过，${bad} 不通过`);
      process.exit(bad ? 1 : 0);
    }
    const r = checkOne(abs);
    process.exit(r.ok ? 0 : 1);
  }

  if (cmd === 'site') {
    const dir = rest[0];
    if (!dir) { usage(); process.exit(2); }
    const oi = rest.indexOf('-o');
    const out = oi > -1 ? rest[oi + 1] : join(process.cwd(), 'site');
    const items = loadDir(resolve(dir));
    const bad = items.filter((i) => !i.validate.ok).length;
    const p = writeSite(items, resolve(out));
    console.log(`${C.green}✓${C.reset} 已生成 ${items.length} 张卡片 → ${p}`);
    if (bad) console.log(`${C.yellow}!${C.reset} 其中 ${bad} 张有错误，已在页面上标红`);
    process.exit(0);
  }

  if (cmd === 'init') {
    const id = rest[0] || 'my-robot';
    console.log(JSON.stringify({
      schema: 'embodiment-card/v1',
      id,
      name: '我的机器人',
      vendor: '',
      category: 'arm',
      dof: 1,
      joints: [{ name: 'j1', min: -1.5, max: 1.5, unit: 'rad' }],
      control: { rateHz: 100, interfaces: ['ros2'] },
      capabilities: { pick_and_place: { level: 'none' } },
      provenance: { source: '', verifiedBy: '', verifiedAt: new Date().toISOString().slice(0, 10) },
    }, null, 2));
    process.exit(0);
  }

  usage();
  process.exit(2);
} catch (e) {
  console.error(`${C.red}错误${C.reset} ${e.message}`);
  process.exit(1);
}
