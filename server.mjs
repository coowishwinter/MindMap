#!/usr/bin/env node
// 思维导图工作台服务（多用户版）：静态页 + 按「空间」隔离的文件库/历史/草稿 + XMind 导入
//
// 身份：cookie mm_space=<32位随机令牌>。令牌→空间目录，空间之间完全隔离、互相列不到。
//       ⚠️ 未来接账号体系：只需把 resolveSpace() 换成「读登录会话」，其余（目录布局/接口/前端）不动。
//
//   ---- 空间 ----
//   GET    /api/space                  → {ok,name} | 401 {ok:false,err:"no_space"}
//   POST   /api/space {name,pin}       → 建空间或按名字+口令进入 → Set-Cookie
//   POST   /api/space {token}          → 用专属链接的令牌进入 → Set-Cookie
//   POST   /api/space/leave            → 退出（清 cookie）
//   GET    /api/space/link             → {ok,url} 专属链接（需已进入）
//   ---- 数据（全部要求已进入空间，否则 401）----
//   GET    /api/files                  → {files:[{name,title,nodes,size,mtime}]}
//   GET    /api/file?name=X            → 图 JSON
//   POST   /api/file?name=X            → 覆盖保存 + 快照
//   DELETE /api/file?name=X            → 删图及其历史
//   GET    /api/history?name=X[&ts=T]  → 快照列表 / 单份内容
//   DELETE /api/history?name=X[&ts=T]  → 删快照
//   POST   /api/snapshot?name=X        → 只存快照（自动保存用）
//   GET/POST/DELETE /api/draft         → 自动保存草稿
//   ---- 无状态 ----
//   POST   /api/import                 → .xmind 字节 → {ok,tree}
//
// 目录：spaces/<token>/{maps,history,draft.json}；spaces/index.json 存空间名与口令散列
// 启动：PORT=8099 node server.mjs

import { createServer } from 'http';
import { readFile, writeFile, unlink, readdir, mkdir, stat, rename, rm } from 'fs/promises';
import { createHash, randomBytes } from 'crypto';
import { inflateRawSync } from 'zlib';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SPACES = path.join(ROOT, 'spaces');
const INDEX = path.join(SPACES, 'index.json');
const COOKIE = 'mm_space';
const EXT = '.mmap';
const SNAP_MAX = 30;
function argVal(flag){
  const i=process.argv.indexOf(flag);
  if(i>=0&&i+1<process.argv.length)return process.argv[i+1];
  const eq=process.argv.find((a)=>a.startsWith(flag+'='));
  return eq?eq.slice(flag.length+1):null;
}
const PORT = Number(argVal('--port') || process.env.PORT || 8099);
const HOST = argVal('--host') || process.env.HOST || '127.0.0.1';

// 静态服务黑名单：数据目录绝不允许被直接下载
const BLOCKED = /^\/(spaces|maps|history|draft\.json|map-data\.json)(\/|$)/;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.mmap': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

/* ---------- 空间（身份层，将来换账号体系只改这一块） ---------- */
async function readIndex() {
  try { const d = JSON.parse(await readFile(INDEX, 'utf8')); if (d && d.spaces) return d; } catch {}
  return { spaces: {} };
}
async function writeIndex(idx) {
  await mkdir(SPACES, { recursive: true });
  await writeFile(INDEX + '.tmp', JSON.stringify(idx, null, 2), 'utf8');
  await rename(INDEX + '.tmp', INDEX);
}
const hashPin = (pin, token) => createHash('sha256').update(String(pin) + '|' + token).digest('hex').slice(0, 32);

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
async function resolveSpace(req) {
  const t = parseCookies(req)[COOKIE];
  if (!t || !/^[a-f0-9]{32}$/.test(t)) return null;
  const idx = await readIndex();
  const s = idx.spaces[t];
  if (!s) return null;
  return { token: t, name: s.name, dir: path.join(SPACES, t) };
}
function isHttpsReq(req) {
  return Boolean(req && (req.socket?.encrypted || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase() === 'https'));
}
function setCookie(res, token, maxAge, req) {
  const attrs = isHttpsReq(req) ? 'SameSite=None; Secure' : 'SameSite=Lax';
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; ${attrs}; Max-Age=${maxAge}`);
}
const spMaps = (sp) => path.join(sp.dir, 'maps');
const spHist = (sp) => path.join(sp.dir, 'history');
const spDraft = (sp) => path.join(sp.dir, 'draft.json');
const histDir = (sp, name) => path.join(spHist(sp), name.slice(0, -EXT.length));

// 口令尝试限速（内存即可：单进程、内网）
const fails = new Map();
function tooManyFails(name) {
  const f = fails.get(name);
  if (!f) return false;
  if (Date.now() - f.t > 300000) { fails.delete(name); return false; }
  return f.n >= 10;
}
function noteFail(name) {
  const f = fails.get(name);
  if (f && Date.now() - f.t <= 300000) { f.n++; }
  else fails.set(name, { n: 1, t: Date.now() });
}

// 首次使用：把单用户时代的旧数据整体搬进第一个新空间
async function migrateLegacy(sp) {
  const marker = path.join(SPACES, '.migrated');
  try { await stat(marker); return null; } catch {}
  const moved = [];
  for (const d of ['maps', 'history']) {
    const from = path.join(ROOT, d);
    try { await stat(from); await rename(from, path.join(sp.dir, d)); moved.push(d + '/'); } catch {}
  }
  const draftNew = spDraft(sp);
  const hasDraft = await stat(draftNew).then(() => true).catch(() => false);
  const legacyDraft = path.join(ROOT, 'draft.json');
  const legacyMap = path.join(ROOT, 'map-data.json');
  if (!hasDraft) {
    const src = await stat(legacyDraft).then(() => legacyDraft).catch(() => legacyMap);
    try { await rename(src, draftNew); moved.push(path.basename(src) + '→draft.json'); } catch {}
  }
  await mkdir(SPACES, { recursive: true });
  await writeFile(marker, new Date().toISOString(), 'utf8');
  return moved.length ? moved : null;
}

/* ---------- 通用 ---------- */
function safeName(raw) {
  let n = String(raw == null ? '' : raw).trim();
  if (/[\/\\]/.test(n) || n.includes('..')) return null; // 只接受单层文件名，直接拒路径
  n = n.replace(/[\u0000-\u001f]/g, '');
  if (/^\.+$/.test(n)) return null;
  if (n.toLowerCase().endsWith(EXT)) n = n.slice(0, -EXT.length);
  if (n.toLowerCase().endsWith('.json')) n = n.slice(0, -5);
  n = n.trim().replace(/^\.+/, '').trim();
  if (!n || n.length > 80) return null;
  n = n.replace(/[<>:"|?*]/g, '_');
  return n + EXT;
}
function nodesKey(json) {
  try { const d = JSON.parse(json); return JSON.stringify((d && d.nodes) || []); } catch { return null; }
}
async function readTextOrNull(p) { try { return (await readFile(p)).toString('utf8'); } catch { return null; } }
async function ensureDir(d) { try { await mkdir(d, { recursive: true }); } catch {} }
function titleOf(json) {
  try {
    const r = (JSON.parse(json).nodes || []).find((n) => n.parent === null);
    return (r && r.text) || '(无名)';
  } catch { return '(损坏)'; }
}
async function writeSnapshot(sp, name, json, force) {
  const dir = histDir(sp, name);
  await ensureDir(dir);
  let files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith(EXT)).sort();
  const cur = nodesKey(json);
  if (files.length) {
    const last = await readTextOrNull(path.join(dir, files[files.length - 1]));
    if (last && !force && nodesKey(last) === cur) return null;
  }
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14); // YYYYMMDDHHmmss
  // 同一秒内可能连写两份：撞名就挂 -1 / -2 …（files 不会变，只能靠 i 递增收敛）
  let base = ts, i = 1;
  while (files.includes(base + EXT)) base = ts + '-' + (i++);
  const target = path.join(dir, base + EXT);
  await writeFile(target, json, 'utf8');
  files.push(base + EXT);
  files.sort();
  for (const old of files.slice(0, Math.max(0, files.length - SNAP_MAX))) {
    try { await unlink(path.join(dir, old)); } catch {}
  }
  return base;
}

/* ---------- 最小 ZIP 读取（XMind 本质是 zip） ---------- */
function unzip(buf) {
  let eocd = -1;
  const stop = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= stop; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('不是有效的 zip/xmind 文件');
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let i = 0; i < count; i++) {
    if (off + 46 > buf.length || buf.readUInt32LE(off) !== 0x02014b50) throw new Error('中央目录损坏');
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    if (localOff + 30 < buf.length && buf.readUInt32LE(localOff) === 0x04034b50) {
      const lnameLen = buf.readUInt16LE(localOff + 26);
      const lextraLen = buf.readUInt16LE(localOff + 28);
      const start = localOff + 30 + lnameLen + lextraLen;
      const data = buf.subarray(start, start + compSize);
      try { files[name] = method === 0 ? Buffer.from(data) : inflateRawSync(data); } catch { /* 跳过坏条目 */ }
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}
function xmindToTree(buf) {
  const files = unzip(buf);
  const key = Object.keys(files).find((n) => /content\.json$/i.test(n));
  if (!key) throw new Error('xmind 里没有 content.json（可能是旧版 content.xml，暂不支持）');
  const parsed = JSON.parse(files[key].toString('utf8'));
  const sheets = Array.isArray(parsed) ? parsed : [parsed];
  const rootTopic = (sheets[0] && (sheets[0].rootTopic || sheets[0].topic)) || null;
  if (!rootTopic) throw new Error('xmind 结构无法识别');
  const conv = (t) => {
    const node = { text: String(t.title || '(未命名)') };
    const plain = t.notes && t.notes.plain && t.notes.plain.content;
    if (plain) node.note = String(plain);
    const ch = (t.children && t.children.attached) || [];
    if (ch.length) node.children = ch.map(conv);
    return node;
  };
  return conv(rootTopic);
}

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}
function readBody(req, limit) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > (limit || 5e6)) req.destroy(); });
    req.on('end', () => resolve(body));
    req.on('error', () => resolve(''));
  });
}
const NO_SPACE = { ok: false, err: 'no_space' };

/* ---------- 服务 ---------- */
const server = createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://x'); } catch { return send(res, 400, { ok: false, err: 'bad url' }); }
  const p = decodeURIComponent(url.pathname);
  const q = url.searchParams;

  // ---- 无状态：XMind 导入 ----
  if (p === '/api/import') {
    if (req.method !== 'POST') return send(res, 405, { ok: false });
    const chunks = [];
    req.on('data', (c) => { chunks.push(c); if (chunks.length > 4000) req.destroy(); });
    req.on('end', () => {
      try { send(res, 200, { ok: true, tree: xmindToTree(Buffer.concat(chunks)) }); }
      catch (e) { send(res, 400, { ok: false, err: String(e.message) }); }
    });
    return;
  }

  // ---- 空间：进入 / 创建 / 退出 / 链接 ----
  if (p === '/api/space') {
    if (req.method === 'GET') {
      const sp = await resolveSpace(req);
      if (!sp) return send(res, 401, NO_SPACE);
      return send(res, 200, { ok: true, name: sp.name });
    }
    if (req.method === 'POST') {
      let body = {};
      try { body = JSON.parse(await readBody(req) || '{}'); } catch { return send(res, 400, { ok: false, err: '请求格式不对' }); }

      // a) 用专属链接的令牌进入
      if (body.token) {
        const t = String(body.token).trim();
        const idx = await readIndex();
        if (!idx.spaces[t]) return send(res, 404, { ok: false, err: '链接无效或空间已删除' });
        setCookie(res, t, 31536000, req);
        return send(res, 200, { ok: true, name: idx.spaces[t].name, token: t });
      }

      // b) 名字 + 口令：不存在则创建，存在则校验
      const name = String(body.name || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 20);
      const pin = String(body.pin || '').trim();
      if (!name) return send(res, 400, { ok: false, err: '请填名字' });
      if (pin.length < 4) return send(res, 400, { ok: false, err: '口令至少 4 位' });

      const idx = await readIndex();
      const hit = Object.entries(idx.spaces).find(([, s]) => s.name === name);
      if (hit) {
        if (tooManyFails(name)) return send(res, 429, { ok: false, err: '口令错误次数太多，等 5 分钟再试' });
        if (hashPin(pin, hit[0]) !== hit[1].pinHash) { noteFail(name); return send(res, 401, { ok: false, err: '口令不对' }); }
        fails.delete(name);
        setCookie(res, hit[0], 31536000, req);
        return send(res, 200, { ok: true, name, token: hit[0], existed: true });
      }
      const token = randomBytes(16).toString('hex');
      const dir = path.join(SPACES, token);
      await ensureDir(dir);
      // 第一个空间：把单用户时代的旧数据搬进来（否则旧图会"消失"）
      let migrated = null;
      if (Object.keys(idx.spaces).length === 0) migrated = await migrateLegacy({ dir });
      idx.spaces[token] = { name, pinHash: hashPin(pin, token), createdAt: Date.now() };
      await writeIndex(idx);
      setCookie(res, token, 31536000, req);
      return send(res, 200, { ok: true, name, token, created: true, migrated });
    }
    if (req.method === 'DELETE' || p === '/api/space/leave') { /* 下面统一处理 */ }
    return send(res, 405, { ok: false });
  }

  if (p === '/api/space/leave') {
    setCookie(res, 'x', 0, req);
    return send(res, 200, { ok: true });
  }

  if (p === '/api/space/link') {
    const sp = await resolveSpace(req);
    if (!sp) return send(res, 401, NO_SPACE);
    const host = req.headers.host || 'localhost';
    const proto = isHttpsReq(req) ? 'https' : 'http';
    return send(res, 200, { ok: true, url: `${proto}://${host}/?k=${sp.token}`, name: sp.name });
  }

  // ---- 以下 /api/* 要求已进入空间（静态资源不校验，否则连首页都打不开）----
  const needAuth = p.startsWith('/api/');
  const sp = needAuth ? await resolveSpace(req) : null;
  if (needAuth && !sp) return send(res, 401, NO_SPACE);

  if (p === '/api/files') {
    await ensureDir(spMaps(sp));
    const names = (await readdir(spMaps(sp)).catch(() => [])).filter((f) => f.endsWith(EXT));
    const out = [];
    for (const f of names) {
      const fp = path.join(spMaps(sp), f);
      const [txt, st] = [await readTextOrNull(fp), await stat(fp).catch(() => null)];
      if (!st) continue;
      let nodes = 0;
      try { nodes = (JSON.parse(txt).nodes || []).length; } catch {}
      out.push({ name: f, title: titleOf(txt), nodes, size: st.size, mtime: st.mtimeMs });
    }
    out.sort((a, b) => b.mtime - a.mtime);
    return send(res, 200, { ok: true, name: sp.name, files: out });
  }

  if (p === '/api/file') {
    const name = safeName(q.get('name'));
    if (!name) return send(res, 400, { ok: false, err: '文件名不合法' });
    const fp = path.join(spMaps(sp), name);

    if (req.method === 'GET') {
      const txt = await readTextOrNull(fp);
      if (txt == null) return send(res, 404, { ok: false, err: '文件不存在' });
      res.writeHead(200, { 'Content-Type': MIME[EXT], 'Cache-Control': 'no-store' });
      return res.end(txt);
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      try { JSON.parse(body); } catch (e) { return send(res, 400, { ok: false, err: 'JSON 无效：' + e.message }); }
      await ensureDir(spMaps(sp));
      await writeFile(fp + '.tmp', body, 'utf8');
      await rename(fp + '.tmp', fp);
      const snap = await writeSnapshot(sp, name, body, true);
      return send(res, 200, { ok: true, name, snapshot: snap });
    }
    if (req.method === 'DELETE') {
      try { await unlink(fp); } catch {}
      await rm(histDir(sp, name), { recursive: true, force: true }).catch(() => {});
      return send(res, 200, { ok: true, name });
    }
    return send(res, 405, { ok: false });
  }

  if (p === '/api/snapshot') {
    if (req.method !== 'POST') return send(res, 405, { ok: false });
    const name = safeName(q.get('name') || '未命名图');
    if (!name) return send(res, 400, { ok: false, err: '文件名不合法' });
    const body = await readBody(req);
    try { JSON.parse(body); } catch (e) { return send(res, 400, { ok: false, err: 'JSON 无效：' + e.message }); }
    const snap = await writeSnapshot(sp, name, body, false);
    return send(res, 200, { ok: true, name, snapshot: snap, skipped: !snap });
  }

  if (p === '/api/history') {
    const name = safeName(q.get('name'));
    if (!name) return send(res, 400, { ok: false, err: '文件名不合法' });
    const dir = histDir(sp, name);
    const ts = q.get('ts');
    if (req.method === 'GET') {
      if (ts) {
        if (!/^[0-9]{14}(-[0-9]+)?$/.test(ts)) return send(res, 400, { ok: false, err: 'ts 不合法' });
        const txt = await readTextOrNull(path.join(dir, ts + EXT));
        if (txt == null) return send(res, 404, { ok: false, err: '快照不存在' });
        res.writeHead(200, { 'Content-Type': MIME[EXT], 'Cache-Control': 'no-store' });
        return res.end(txt);
      }
      const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith(EXT)).sort();
      const items = [];
      for (const f of files) {
        const st = await stat(path.join(dir, f)).catch(() => null);
        if (!st) continue;
        const txt = await readTextOrNull(path.join(dir, f));
        let nodes = 0;
        try { nodes = (JSON.parse(txt).nodes || []).length; } catch {}
        items.push({ ts: f.slice(0, -EXT.length), size: st.size, mtime: st.mtimeMs, nodes });
      }
      items.reverse();
      return send(res, 200, { ok: true, name, items });
    }
    if (req.method === 'DELETE') {
      if (ts) { try { await unlink(path.join(dir, ts + EXT)); } catch {} }
      else await rm(dir, { recursive: true, force: true }).catch(() => {});
      return send(res, 200, { ok: true, name, ts: ts || null });
    }
    return send(res, 405, { ok: false });
  }

  if (p === '/api/draft') {
    const dp = spDraft(sp);
    if (req.method === 'GET') {
      const txt = await readTextOrNull(dp);
      if (txt == null) { res.writeHead(204); return res.end(); }
      res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
      return res.end(txt);
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      try { JSON.parse(body); } catch (e) { return send(res, 400, { ok: false, err: 'JSON 无效：' + e.message }); }
      await ensureDir(sp.dir);
      await writeFile(dp + '.tmp', body, 'utf8');
      await rename(dp + '.tmp', dp);
      return send(res, 200, { ok: true });
    }
    if (req.method === 'DELETE') {
      try { await unlink(dp); } catch {}
      return send(res, 200, { ok: true });
    }
    return send(res, 405, { ok: false });
  }

  // ---- 静态文件（数据目录一律 404）----
  const rel = p === '/' ? '/index.html' : p;
  if (BLOCKED.test(rel)) { res.writeHead(404); return res.end('not found'); }
  const full = path.normalize(path.join(ROOT, rel));
  if (!full.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  try {
    const buf = await readFile(full);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404); res.end('not found'); }
});

server.listen(PORT, HOST, () => process.stderr.write('mindmap server on ' + HOST + ':' + PORT + '\n'));
