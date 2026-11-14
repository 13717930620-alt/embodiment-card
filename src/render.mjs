import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { validate } from './validate.mjs';
import { grade } from './grade.mjs';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LEVEL_TEXT = { none: '无证据', claimed: '声称', measured: '实测', reproduced: '可复现' };
const LEVEL_CLS = { none: 'lv-none', claimed: 'lv-claimed', measured: 'lv-measured', reproduced: 'lv-reproduced' };

export function loadDir(dir) {
  const out = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
    const p = join(dir, f);
    let card = null;
    let v = null;
    try {
      card = JSON.parse(readFileSync(p, 'utf8'));
      v = validate(card);
    } catch (e) {
      out.push({ file: f, card: null, validate: { ok: false, errors: [{ path: '$', msg: 'JSON 解析失败：' + e.message }], warnings: [] }, grade: null });
      continue;
    }
    out.push({ file: f, card, validate: v, grade: v.ok ? grade(card) : null });
  }
  return out;
}

function cardHtml(item) {
  const { card, validate: v, grade: g } = item;
  if (!card) {
    return `<article class="card bad"><h3>${esc(item.file)}</h3><p class="err">${esc(v.errors[0].msg)}</p></article>`;
  }
  const fictional = /虚构/.test(card.name) || /虚构/.test(card.provenance?.source || '');
  const caps = Object.entries(card.capabilities || {});
  const bars = caps.map(([k, c]) => `
      <li>
        <span class="cap">${esc(k.replace(/_/g, ' '))}</span>
        <span class="pill ${LEVEL_CLS[c.level]}">${LEVEL_TEXT[c.level]}</span>
        ${c.metric ? `<span class="metric">${esc(c.metric)}</span>` : ''}
      </li>`).join('');

  return `
    <article class="card${fictional ? ' fictional' : ''}">
      <header>
        <div>
          <h3>${esc(card.name)}</h3>
          <p class="meta">${esc(card.vendor || '未标厂商')} · ${esc(card.category)} · ${card.dof} DoF · ${card.control.rateHz} Hz</p>
        </div>
        <span class="grade g${g.level}" title="${esc(g.label)}">L${g.level}</span>
      </header>
      ${fictional ? '<p class="flag">虚构示例 · 数据不可用</p>' : ''}
      <ul class="caps">${bars || '<li class="empty">没有能力条目</li>'}</ul>
      <footer>
        <span>${esc(g.label)}</span>
        <span class="dot">·</span>
        <span>证据分 ${g.score}</span>
        <span class="dot">·</span>
        <span>${esc(card.provenance.verifiedBy)}</span>
      </footer>
    </article>`;
}

export function renderSite(items, { title = 'Embodiment Card' } = {}) {
  const valid = items.filter((i) => i.validate.ok);
  const real = valid.filter((i) => !/虚构/.test(i.card.name));
  const l2 = real.filter((i) => i.grade.level >= 2).length;
  const l3 = real.filter((i) => i.grade.level >= 3).length;
  const caps = real.reduce((s, i) => s + Object.keys(i.card.capabilities || {}).length, 0);

  // 真实卡片在前（按等级降序），虚构示例垫底
  const isFake = (i) => !!(i.card && (/虚构/.test(i.card.name) || /虚构/.test(i.card.provenance?.source || '')));
  const ordered = [...items].sort((a, b) => {
    const fa = isFake(a) ? 1 : 0;
    const fb = isFake(b) ? 1 : 0;
    if (fa !== fb) return fa - fb;
    const la = a.grade ? a.grade.level : -1;
    const lb = b.grade ? b.grade.level : -1;
    if (la !== lb) return lb - la;
    return String(a.card?.id || a.file).localeCompare(String(b.card?.id || b.file));
  });

  return `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root{
    --bg:#0b0d12; --bg2:#11141b; --line:#1e2430; --fg:#e6e9ef; --dim:#8b95a7;
    --accent:#5eead4; --warn:#fbbf24; --bad:#f87171;
    --l0:#64748b; --l1:#60a5fa; --l2:#34d399; --l3:#5eead4;
  }
  *{box-sizing:border-box}
  body{margin:0;background:radial-gradient(1200px 600px at 50% -10%,#16202b 0%,var(--bg) 55%);
       color:var(--fg);font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
  .wrap{max-width:1080px;margin:0 auto;padding:64px 24px 96px}
  .eyebrow{font:600 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.18em;
           text-transform:uppercase;color:var(--accent);margin:0 0 18px}
  h1{font-size:clamp(30px,4.6vw,52px);line-height:1.12;margin:0 0 14px;letter-spacing:-.02em}
  h1 em{font-style:normal;color:var(--accent)}
  .lede{color:var(--dim);font-size:17px;max-width:640px;margin:0 0 36px}
  .stats{display:flex;gap:36px;flex-wrap:wrap;padding:22px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin-bottom:48px}
  .stat b{display:block;font:600 26px/1.1 ui-monospace,Menlo,monospace}
  .stat span{color:var(--dim);font-size:12.5px}
  .stat.gap b{color:var(--warn)}
  .ladder{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:0 0 52px}
  .rung{border:1px solid var(--line);border-radius:12px;padding:14px 14px 16px;background:var(--bg2)}
  .rung b{display:block;font:600 13px/1 ui-monospace,Menlo,monospace;margin-bottom:6px}
  .rung p{margin:0;color:var(--dim);font-size:12.5px}
  .rung.on{border-color:#2b3444}
  .rung.hot{border-color:rgba(94,234,212,.45);box-shadow:0 0 0 1px rgba(94,234,212,.12) inset}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
  .card{background:linear-gradient(180deg,#12161e,#0f131a);border:1px solid var(--line);border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:14px}
  .card.fictional{border-style:dashed;opacity:.86}
  .card.bad{border-color:#4b1d1d}
  .card header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
  .card h3{margin:0 0 4px;font-size:16.5px;letter-spacing:-.01em}
  .meta{margin:0;color:var(--dim);font-size:12.5px}
  .grade{flex:0 0 auto;width:40px;height:40px;border-radius:11px;display:grid;place-items:center;
         font:700 14px/1 ui-monospace,Menlo,monospace;background:#1a1f2a;border:1px solid #2a3242}
  .g1{color:var(--l1);border-color:rgba(96,165,250,.35)}
  .g2{color:var(--l2);border-color:rgba(52,211,153,.35)}
  .g3{color:var(--l3);border-color:rgba(94,234,212,.45)}
  .flag{margin:0;font:600 11.5px/1 ui-monospace,Menlo,monospace;color:var(--warn);letter-spacing:.06em}
  .caps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
  .caps li{display:flex;align-items:center;gap:8px;font-size:13px;flex-wrap:wrap}
  .cap{color:#c8cfdb}
  .pill{font:600 10.5px/1 ui-monospace,Menlo,monospace;padding:4px 7px;border-radius:999px;letter-spacing:.04em}
  .lv-none{background:#2a2020;color:#c98a8a}
  .lv-claimed{background:#2a2620;color:#d8b26a}
  .lv-measured{background:#16302a;color:#5ec9a8}
  .lv-reproduced{background:#123330;color:var(--accent)}
  .metric{color:var(--dim);font-size:12px}
  .empty{color:var(--dim);font-size:13px}
  .card footer{border-top:1px solid var(--line);padding-top:12px;margin-top:auto;color:var(--dim);font-size:12px;display:flex;gap:7px;flex-wrap:wrap}
  .dot{opacity:.4}
  .err{color:var(--bad);font-size:13px;margin:0}
  .foot{margin-top:56px;padding-top:22px;border-top:1px solid var(--line);color:var(--dim);font-size:12.5px}
  code{font:12.5px/1.5 ui-monospace,Menlo,monospace;background:#171c25;border:1px solid var(--line);border-radius:6px;padding:1px 6px;color:#c9d3e3}
  @media(max-width:720px){.ladder{grid-template-columns:1fr 1fr}.stats{gap:22px}}
</style>
<div class="wrap">
  <p class="eyebrow">embodiment-card / v1</p>
  <h1>每台机器人，都该有一张<br><em>能被机器读懂的</em>能力卡</h1>
  <p class="lede">URDF 告诉你它长什么样，这张卡告诉你它能干什么、证据到哪一步、谁验的。
    一个 JSON、一个校验器、一条分级线：L0 结构 → L1 可控 → L2 有实测 → L3 可复现。</p>

  <div class="stats">
    <div class="stat"><b>${valid.length}</b><span>张有效卡片</span></div>
    <div class="stat"><b>${caps}</b><span>条能力声明</span></div>
    <div class="stat"><b>${l2}</b><span>达到 L2</span></div>
    <div class="stat gap"><b>${l3}</b><span>达到 L3</span></div>
  </div>

  <div class="ladder">
    <div class="rung on"><b>L0 结构</b><p>身份、类别、自由度、出处</p></div>
    <div class="rung on"><b>L1 可控</b><p>+ 关节限位齐全、控制频率与接口</p></div>
    <div class="rung"><b>L2 有实测</b><p>+ ≥3 项能力有实测证据，卡片带内容哈希</p></div>
    <div class="rung hot"><b>L3 可复现</b><p>+ 至少一项被第三方复跑过</p></div>
  </div>

  <div class="grid">${ordered.map(cardHtml).join('')}</div>

  <p class="foot">
    校验：<code>npx embodiment-card check examples/</code> ·
    生成本页：<code>npx embodiment-card site examples/ -o site/</code><br>
    所有真实卡片都停在 L1 —— 因为公开可查的实测证据几乎不存在。L3 那一格是空的，等谁先填。
  </p>
</div>
</html>`;
}

export function writeSite(items, outDir, opts = {}) {
  mkdirSync(outDir, { recursive: true });
  const html = renderSite(items, opts);
  const p = resolve(outDir, 'index.html');
  writeFileSync(p, html, 'utf8');
  return p;
}

export function summarize(items) {
  return items.map((i) => ({
    file: basename(i.file),
    ok: i.validate.ok,
    errors: i.validate.errors,
    warnings: i.validate.warnings,
    level: i.grade ? i.grade.level : null,
    label: i.grade ? i.grade.label : '不合格',
    score: i.grade ? i.grade.score : null,
  }));
}
