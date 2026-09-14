// NothingP AIOsubtitles v3.9.55 — Turbo: 20K/150 + parallel per-key + hard 15 RPM/key + overlap
// + Character Guide 6 lớp (mới)

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const AdmZip = require('adm-zip');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const SUBSOURCE_API = 'https://api.subsource.net/api/v1';
const API_HEADERS = {
  'User-Agent': 'AISubtitlePro v3.9.9',
  Accept: 'application/json'
};
const SUBTITLE_BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
  'Accept': 'text/plain,text/vtt,text/*,*/*;q=0.8'
};

function parseConfig(encodedConfig) {
  if (!encodedConfig || encodedConfig === 'undefined' || encodedConfig === 'null') return {};
  const raw = String(encodedConfig).trim();
  const variants = [
    raw,
    raw.replace(/-/g, '+').replace(/_/g, '/'),
    decodeURIComponent(raw)
  ];
  for (const value of variants) {
    try {
      const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
      const parsed = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
  }
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {}
  return {};
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

app.get('/', (req, res) => res.redirect('/configure'));
app.get('/configure', (req, res) => renderConfigPage(req, res, {}));
app.get('/:config/configure', (req, res) => {
  renderConfigPage(req, res, parseConfig(req.params.config));
});

function renderConfigPage(req, res, savedConfig) {
  const geminiKeys = savedConfig.geminiKeys || [];
  res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cấu hình NothingP AIOsubtitles</title>
<style>
body{background:#121212;color:#fff;font-family:Arial,sans-serif;padding:20px;display:flex;justify-content:center}
.container{width:100%;max-width:520px;background:#1e1e1e;padding:25px;border-radius:10px;box-shadow:0 4px 15px rgba(0,0,0,0.5)}
h2{text-align:center;color:#ff5252;margin-bottom:20px}
label{display:block;margin:12px 0 5px;font-size:13px;color:#ccc}
input,select{width:100%;padding:10px;background:#2a2a2a;border:1px solid #444;color:#fff;border-radius:5px;box-sizing:border-box}
.section-title{color:#4fc3f7;margin-top:20px;font-size:14px;font-weight:bold;border-bottom:1px solid #333;padding-bottom:5px}
button{width:100%;padding:12px;border:0;border-radius:5px;color:#fff;font-weight:bold;margin-top:15px;cursor:pointer;font-size:14px}
#installBtn{background:#e50914}#copyBtn{background:#2196F3}
</style>
</head>
<body>
<div class="container">
<h2>NothingP AIOsubtitles v3.9.55</h2>
<form id="configForm">
<label>Mô hình AI dịch ưu tiên:</label>
<select id="modelSelect">
<option value="gemini-3.5-flash-lite" ${!savedConfig.model || savedConfig.model === 'gemini-3.5-flash-lite' ? 'selected' : ''}>Gemini 3.5 Flash-Lite - Low thinking (Khuyên dùng)</option>
<option value="gemini-2.5-flash" ${savedConfig.model === 'gemini-2.5-flash' ? 'selected' : ''}>Gemini 2.5 Flash - Dự phòng</option>
</select>
<div class="section-title">🔑 Google Gemini API Keys (Hỗ trợ xoay vòng nhiều Key)</div>
<label>Gemini API Key 1</label><input id="geminiKey1" value="${escapeHtml(geminiKeys[0])}" placeholder="AIzaSy...">
<label>Gemini API Key 2</label><input id="geminiKey2" value="${escapeHtml(geminiKeys[1])}">
<label>Gemini API Key 3</label><input id="geminiKey3" value="${escapeHtml(geminiKeys[2])}">
<div style="font-size:12px;color:#aaa;margin-top:8px;line-height:1.45">v3.9.1: 3 Key thuộc 3 Google Project khác nhau sẽ chạy 3 worker dịch song song. Mỗi Project có limiter riêng.</div>
<div class="section-title">📥 Nguồn phụ đề (OpenSubtitles, SubSource, SubDL)</div>
<label>OpenSubtitles API Key</label><input id="opensubtitlesKey" value="${escapeHtml(savedConfig.opensubtitlesKey)}">
<label>SubSource API Key</label><input id="subsourceKey" value="${escapeHtml(savedConfig.subsourceKey)}" placeholder="Nhập SubSource API Key">
<label>SubDL API Key</label><input id="subdlKey" value="${escapeHtml(savedConfig.subdlKey)}">
<button type="button" id="installBtn">Cài đặt trực tiếp vào Stremio</button>
<label style="margin-top:20px">Link Addon:</label><input id="addonUrlOutput" readonly>
<button type="button" id="copyBtn">📋 Sao chép Link Addon</button>
</form>
</div>
<script>
function getAddonUrl(){
  const config={
    model:document.getElementById('modelSelect').value,
    geminiKeys:['geminiKey1','geminiKey2','geminiKey3'].map(id=>document.getElementById(id).value.trim()).filter(Boolean),
    opensubtitlesKey:document.getElementById('opensubtitlesKey').value.trim(),
    subdlKey:document.getElementById('subdlKey').value.trim(),
    subsourceKey:document.getElementById('subsourceKey').value.trim()
  };
  return location.origin+'/'+btoa(unescape(encodeURIComponent(JSON.stringify(config))))+'/manifest.json';
}
document.getElementById('installBtn').onclick=()=>{
  location.href='stremio://'+getAddonUrl().replace(/^https?:\\/\\//,'');
};
document.getElementById('copyBtn').onclick=async()=>{
  const url=getAddonUrl(), input=document.getElementById('addonUrlOutput');
  input.value=url; input.select();
  try{await navigator.clipboard.writeText(url);alert('Đã sao chép link addon!')}
  catch{alert('Hãy sao chép link trong ô.')}
};
document.getElementById('addonUrlOutput').value = getAddonUrl();
</script>
</body>
</html>`);
}

const CONFIG_PROVIDER_ORDER = ['os', 'subsource', 'subdl'];
const configProviderRank = value => {
  const id = String(value || '').toLowerCase();
  return CONFIG_PROVIDER_ORDER.indexOf(id) >= 0
    ? CONFIG_PROVIDER_ORDER.indexOf(id)
    : CONFIG_PROVIDER_ORDER.length;
};

const defaultManifest = {
  id: 'org.gemini.ai.subtitle.pro',
  version: '3.9.55',
  name: 'NothingP AIOsubtitles',
  description: 'Tự động tìm sub Việt chuẩn hoặc dịch AI với sổ tay nhân vật, quan hệ và xưng hô theo bối cảnh.',
  types: ['movie', 'series'],
  catalogs: [],
  resources: ['subtitles'],
  idPrefixes: ['tt'],
  configurable: true,
  behaviorHints: { configurable: true }
};

app.get('/healthz', (req, res) => {
  res.status(200).json({ ok: true, version: '3.9.55', uptime: Math.round(process.uptime()) });
});

app.get('/manifest.json', (req, res) => res.json(defaultManifest));
app.get('/:config/manifest.json', (req, res) => res.json(defaultManifest));

function makeHostUrl(req) {
  const forwardedProto = req.get('x-forwarded-proto');
  const protocol = forwardedProto ? forwardedProto.split(',')[0] : req.protocol;
  return `\( {protocol}:// \){req.get('host')}`;
}

function languageCode(value) {
  if (value && typeof value === 'object') {
    value = value.code || value.language_code || value.iso639_2 || value.iso639_1 ||
      value.lang || value.language || value.name || '';
  }
  return String(value || '').trim().toLowerCase();
}

function isVietnamese(value) {
  const code = languageCode(value);
  return ['vi', 'vie', 'vnm', 'vn', 'vietnamese', 'vietnam'].includes(code) ||
    code.startsWith('vi-') || code.startsWith('vi_') || code.includes('viet');
}

function isEnglish(value) {
  const code = languageCode(value);
  return code === 'en' || code === 'eng' || code === 'english';
}

function parseSrtCues(input) {
  const raw = String(input || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/```(?:srt|subtitle|text)?/gi, '')
    .replace(/```/g, '');

  const blocks = raw.split(/\n{2,}/);
  const cues = [];

  const toMs = value => {
    const m = String(value || '').trim().match(/^(\d{1,3}):(\d{2}):(\d{2})[,.](\d{1,3})$/);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    const sec = Number(m[3]);
    let ms = String(m[4]);
    if (ms.length === 1) ms += '00';
    else if (ms.length === 2) ms += '0';
    ms = Number(ms);
    if (min > 59 || sec > 59 || ms > 999) return null;
    return (((h * 60 + min) * 60 + sec) * 1000) + ms;
  };

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 2) continue;
    const timeIndex = lines.findIndex(line =>
      /^\s*\d{1,3}:\d{2}:\d{2}[,.]\d{1,3}\s*-->\s*\d{1,3}:\d{2}:\d{2}[,.]\d{1,3}(?:\s+.*)?\s*$/.test(line)
    );
    if (timeIndex < 0) continue;

    const tm = lines[timeIndex].match(
      /^\s*(\d{1,3}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,3}:\d{2}:\d{2}[,.]\d{1,3})/
    );
    if (!tm) continue;
    const start = toMs(tm[1]);
    const end = toMs(tm[2]);
    if (start == null || end == null || end <= start) continue;

    const body = lines.slice(timeIndex + 1).join('\n').trim();
    if (!body) continue;
    cues.push({ start, end, body });
  }

  return cues;
}

function srtMs(ms) {
  ms = Math.max(0, Math.round(Number(ms) || 0));
  const h = Math.floor(ms / 3600000);
  ms %= 3600000;
  const m = Math.floor(ms / 60000);
  ms %= 60000;
  const s = Math.floor(ms / 1000);
  const milli = ms % 1000;
  return `\( {String(h).padStart(2, '0')}: \){String(m).padStart(2, '0')}:\( {String(s).padStart(2, '0')}, \){String(milli).padStart(3, '0')}`;
}

function buildSrtFromCues(cues) {
  const unique = [];
  const seen = new Set();
  for (const cue of cues || []) {
    if (!cue || cue.start == null || cue.end == null || cue.end <= cue.start) continue;
    const body = String(cue.body || '').trim();
    if (!body) continue;
    const key = `\( {cue.start}| \){cue.end}|${body}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ start: cue.start, end: cue.end, body });
  }
  unique.sort((a, b) => a.start - b.start || a.end - b.end);
  return unique.map((cue, i) =>
    `\( {i + 1}\n \){srtMs(cue.start)} --> \( {srtMs(cue.end)}\n \){cue.body}`
  ).join('\n\n') + (unique.length ? '\n' : '');
}

function normalizeSrtForPlayback(input) {
  return buildSrtFromCues(parseSrtCues(input));
}

function rebuildTranslatedSrtFromSource(sourceChunks, translatedChunks) {
  const finalCues = [];

  const cleanBody = value => String(value || '')
    .replace(/```(?:srt|subtitle|text)?/gi, '')
    .replace(/```/g, '')
    .trim();

  const ordered = [...(translatedChunks || [])].sort((a, b) => a.index - b.index);
  if (ordered.length !== sourceChunks.length) {
    throw new Error(`SRT chunk mismatch: nguồn=\( {sourceChunks.length}, bản dịch= \){ordered.length}`);
  }

  for (let i = 0; i < sourceChunks.length; i++) {
    const sourceCues = parseSrtCues(sourceChunks[i]);
    const translatedCues = parseSrtCues(ordered[i].text);
    if (!sourceCues.length) continue;
    if (translatedCues.length !== sourceCues.length) {
      throw new Error(`Chunk \( {i + 1}: số cue không khớp (nguồn= \){sourceCues.length}, dịch=${translatedCues.length})`);
    }

    for (let j = 0; j < sourceCues.length; j++) {
      if (translatedCues[j].start !== sourceCues[j].start || translatedCues[j].end !== sourceCues[j].end) {
        throw new Error(`Chunk ${i + 1}, cue \( {j + 1}: timestamp mismatch nguồn= \){srtMs(sourceCues[j].start)} --> \( {srtMs(sourceCues[j].end)} | dịch= \){srtMs(translatedCues[j].start)} --> ${srtMs(translatedCues[j].end)}`);
      }
      const translatedBody = cleanBody(translatedCues[j].body);
      if (!translatedBody) {
        throw new Error(`Chunk ${i + 1}, cue ${j + 1}: bản dịch rỗng`);
      }
      finalCues.push({
        start: sourceCues[j].start,
        end: sourceCues[j].end,
        body: translatedBody
      });
    }
  }

  return buildSrtFromCues(finalCues);
}

function subtitleName(sub, fallback) {
  const candidates = [
    sub?.releaseName,
    sub?.release_name,
    sub?.release,
    sub?.releaseInfo,
    sub?.release_info,
    sub?.attributes?.releaseName,
    sub?.attributes?.release_name,
    sub?.attributes?.release,
    sub?.fileName,
    sub?.file_name,
    sub?.name
  ];

  for (const value of candidates) {
    if (Array.isArray(value)) {
      const joined = value
        .map(v => typeof v === 'object' ? (v?.name || v?.title || v?.value || '') : String(v || ''))
        .filter(Boolean)
        .join(' ')
        .trim();
      if (joined) return joined;
      continue;
    }

    if (value && typeof value === 'object') {
      const nested = value.name || value.title || value.value || value.releaseName || value.release_name;
      if (nested) return String(nested).trim();
      continue;
    }

    const result = String(value || '').trim();
    if (result) return result;
  }

  return String(fallback || '').trim();
}

function subtitlePickerId(releaseName, fallback) {
  return String(releaseName || fallback || 'Subtitle').trim();
}

function subtitleDisplayName(releaseName, language, provider) {
  const name = String(releaseName || 'Subtitle')
    .replace(/\\s+/g, ' ')
    .trim();

  const code = languageCode(language);
  const flag = code === 'vi' || code === 'vie' || code === 'vietnamese'
    ? '🇻🇳'
    : (code === 'en' || code === 'eng' || code === 'english' ? '🇬🇧' : '');

  const providerNames = {
    os: 'OpenSubtitles',
    opensubtitles: 'OpenSubtitles',
    subsource: 'SubSource',
    subdl: 'SubDL'
  };
  const source = providerNames[String(provider || '').toLowerCase()]
    || String(provider || '').trim();

  const parts = [];
  if (flag) parts.push(flag);
  if (source) parts.push(source);
  if (name) parts.push(name);

  return parts.length ? parts.join(' • ') : 'Subtitle';
}

function extractSubtitleText(buffer) {
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || '');
  const isZip = data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b;

  if (!isZip) {
    return data.toString('utf8').replace(/^\uFEFF/, '');
  }

  const entries = new AdmZip(data).getEntries().filter(entry =>
    !entry.isDirectory && /\.(srt|vtt|ass|ssa|sub)$/i.test(entry.entryName)
  );

  const selected = entries.find(e => /\.srt$/i.test(e.entryName)) || entries[0];
  if (!selected) throw new Error('ZIP không chứa file phụ đề hỗ trợ');

  return selected.getData().toString('utf8').replace(/^\uFEFF/, '');
}

async function fetchSubtitleText(url, headers = {}, timeout = 30000, retries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, {
        headers,
        responseType: 'arraybuffer',
        timeout,
        maxRedirects: 5,
        validateStatus: status => status >= 200 && status < 300
      });
      return extractSubtitleText(Buffer.from(response.data));
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      const retryable =
        !status || status === 408 || status === 425 || status === 429 ||
        status >= 500 ||
        /ECONNRESET|ETIMEDOUT|ECONNABORTED|EAI_AGAIN|socket hang up/i.test(
          String(err.code || '') + ' ' + String(err.message || '')
        );
      if (!retryable || attempt >= retries) break;
      await new Promise(r => setTimeout(r, 700 * (attempt + 1)));
    }
  }
  throw lastError || new Error('Không tải được phụ đề.');
}

function getSubsourceHeaders(apiKey) {
  return {
    ...API_HEADERS,
    'X-API-Key': String(apiKey || '')
  };
}

async function fetchSubsourceSubtitleText(subtitleId, apiKey) {
  const response = await axios.get(
    `\( {SUBSOURCE_API}/subtitles/ \){encodeURIComponent(subtitleId)}/download`,
    {
      headers: getSubsourceHeaders(apiKey),
      responseType: 'arraybuffer',
      timeout: 30000,
      maxRedirects: 5
    }
  );
  return extractSubtitleText(Buffer.from(response.data));
}

function splitSrtIntoChunks(srt, maxChars = 16000, maxCues = 150) {
  const blocks = srt.replace(/\r/g, '').trim().split(/\n\s*\n/).filter(Boolean);
  const chunks = [];
  let current = '';
  let cueCount = 0;
  for (const block of blocks) {
    const blockCues = parseSrtCues(block).length || 1;
    const nextChars = current ? current.length + block.length + 2 : block.length;
    if (current && (nextChars > maxChars || cueCount + blockCues > maxCues)) {
      chunks.push(current); current = ''; cueCount = 0;
    }
    current += (current ? '\n\n' : '') + block;
    cueCount += blockCues;
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [srt];
}

function splitSrtByCueCount(srt, maxCues = 50) {
  const blocks = srt.replace(/\r/g, '').trim().split(/\n\s*\n/).filter(Boolean);
  const chunks = [];
  let current = '';
  let cueCount = 0;
  for (const block of blocks) {
    const blockCues = parseSrtCues(block).length || 1;
    if (current && cueCount + blockCues > maxCues) {
      chunks.push(current); current = ''; cueCount = 0;
    }
    current += (current ? '\n\n' : '') + block;
    cueCount += blockCues;
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [srt];
}

function parseTimeToMs(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  if (parts.length < 3) return 0;
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  const sParts = parts[2].split(/[,.]/);
  const s = parseInt(sParts[0], 10) || 0;
  const ms = parseInt((sParts[1] || '0').padEnd(3, '0').slice(0, 3), 10) || 0;
  return h * 3600000 + m * 60000 + s * 1000 + ms;
}

function cleanAndRebuildSrt(srtText) {
  return normalizeSrtForPlayback(srtText);
}

const GEMINI_MIN_INTERVAL_MS = 0;
const GEMINI_MAX_REQUESTS_PER_MINUTE = 15;
const GEMINI_MAX_TOTAL_REQUESTS_PER_MINUTE = 45;
const GEMINI_WINDOW_MS = 60000;
const geminiKeyState = new Map();
const geminiGlobalState = { starts: [], queue: Promise.resolve() };

function getGeminiKeyState(key) {
  if (!geminiKeyState.has(key)) {
    geminiKeyState.set(key, { starts: [], queue: Promise.resolve() });
  }
  return geminiKeyState.get(key);
}

function pruneRequestStarts(starts, now = Date.now()) {
  while (starts.length && now - starts[0] >= GEMINI_WINDOW_MS) starts.shift();
}

async function waitForRollingQuota(state, maxRequests) {
  while (true) {
    const now = Date.now();
    pruneRequestStarts(state.starts, now);
    if (state.starts.length < maxRequests) return;
    const waitMs = GEMINI_WINDOW_MS - (now - state.starts[0]) + 25;
    await new Promise(r => setTimeout(r, Math.max(25, waitMs)));
  }
}

function enqueueReservation(queueState, reserveFn) {
  const previous = queueState.queue;
  let release;
  const next = new Promise(resolve => { release = resolve; });
  queueState.queue = previous.then(() => next);
  return previous.then(async () => {
    try {
      return await reserveFn();
    } finally {
      release();
    }
  });
}

async function reserveGeminiRequestSlot(key) {
  const state = getGeminiKeyState(key);
  await enqueueReservation(state, async () => {
    await waitForRollingQuota(state, GEMINI_MAX_REQUESTS_PER_MINUTE);
    const now = Date.now();
    state.starts.push(now);
  });
  await enqueueReservation(geminiGlobalState, async () => {
    await waitForRollingQuota(geminiGlobalState, GEMINI_MAX_TOTAL_REQUESTS_PER_MINUTE);
    geminiGlobalState.starts.push(Date.now());
  });
}

async function withGeminiKeySlot(key, fn) {
  await reserveGeminiRequestSlot(key);
  return await fn();
}

async function callAI(prompt, geminiKeys, model, startKeyIndex = 0) {
  let lastError = 'Lỗi không xác định';
  const keys = [...new Set((geminiKeys || []).filter(Boolean))];

  if (!keys.length) {
    return { result: '', error: 'Thiếu Gemini API Key.' };
  }

  const selectedModel = model || 'gemini-3.5-flash-lite';

  const start = keys.length ? ((Number(startKeyIndex) || 0) % keys.length + keys.length) % keys.length : 0;
  for (let offset = 0; offset < keys.length; offset++) {
    const keyIndex = (start + offset) % keys.length;
    const key = keys[keyIndex];
    for (let attempt = 0; attempt < 1; attempt++) {
      try {
        const response = await withGeminiKeySlot(key, async () => {
          const url =
            `https://generativelanguage.googleapis.com/v1beta/models/\( {selectedModel}:generateContent?key= \){encodeURIComponent(key)}`;

          return axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: String(selectedModel).startsWith('gemini-3.')
              ? { thinkingConfig: { thinkingLevel: 'low' } }
              : { temperature: 0.2 }
          }, {
            timeout: 60000,
            headers: { 'Content-Type': 'application/json' }
          });
        });

        const result = response.data?.candidates?.[0]?.content?.parts
          ?.map(p => p.text || '')
          .join('')
          .trim();

        if (result) {
          const actualKeyIndex = keyIndex;
          console.log(`[Gemini \( {selectedModel} / key # \){actualKeyIndex + 1}] success`);
          return { result, error: null, model: selectedModel, keyIndex: actualKeyIndex };
        }

        lastError = `Gemini ${selectedModel}: không trả về nội dung`;
        break;
      } catch (err) {
        const status = err.response?.status;
        const message =
          err.response?.data?.error?.message ||
          err.message ||
          `Gemini ${selectedModel}: lỗi không xác định`;

        lastError = message;
        const actualKeyIndex = keyIndex;
        console.error(`[Gemini \( {selectedModel} / key # \){actualKeyIndex + 1}]`, message);

        if (
          status === 401 || status === 403 ||
          /invalid authentication credentials|api key not valid|invalid api key|authentication|unauthorized|permission denied/i.test(message)
        ) {
          console.warn(`[Gemini \( {selectedModel}] key # \){actualKeyIndex + 1} authentication failure; trying next key on SAME model.`);
          break;
        }

        if (status === 429 || /RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(message)) {
          const retryAfter = Number(err.response?.headers?.['retry-after']);
          if (Number.isFinite(retryAfter) && retryAfter > 0 && retryAfter <= 15) {
            console.warn(`[Gemini \( {selectedModel}] key # \){actualKeyIndex + 1} 429; waiting ${retryAfter}s before rotating.`);
            await new Promise(r => setTimeout(r, retryAfter * 1000));
          } else {
            console.warn(`[Gemini \( {selectedModel}] key # \){actualKeyIndex + 1} rate/quota limit; rotating to next key.`);
          }
          break;
        }

        if (/high demand/i.test(message)) {
          console.warn(`[Gemini \( {selectedModel}] key # \){actualKeyIndex + 1} high-demand response; immediately trying next key on SAME model.`);
          break;
        }

        if (
          status === 408 || status === 425 || status === 500 || status === 502 ||
          status === 503 || status === 504 ||
          /temporarily unavailable|timeout|timed out|ECONNRESET|ETIMEDOUT/i.test(message)
        ) {
          console.warn(`[Gemini \( {selectedModel}] key # \){actualKeyIndex + 1} transient failure; immediately trying next key on SAME model.`);
          break;
        }

        break;
      }
    }
  }

  return {
    result: '',
    error: `Gemini ${selectedModel} failed on all ${keys.length} key(s): ${lastError}`,
    failedAllKeys: true
  };
}

async function callAIWithKey(prompt, key, model) {
  if (!key) return { result: '', error: 'Thiếu Gemini API Key.' };
  return callAI(prompt, [key], model, 0);
}

async function callAIWithModelFallback(prompt, geminiKeys, primaryModel, startKeyIndex = 0) {
  const requested = primaryModel || 'gemini-3.5-flash-lite';
  const fallbackModel =
    requested === 'gemini-3.5-flash-lite'
      ? 'gemini-2.5-flash'
      : 'gemini-3.5-flash-lite';

  const primary = await callAI(prompt, geminiKeys, requested, startKeyIndex);

  if (primary?.result) {
    return {
      ...primary,
      model: requested
    };
  }

  const primaryError = String(primary?.error || '');
  const shouldFallback =
    /high demand|temporarily unavailable|timeout|timed out|ECONNRESET|ETIMEDOUT|503|502|504|500/i.test(primaryError) &&
    !/quota|resource_exhausted|rate.?limit|api key|authentication|unauthorized|permission denied/i.test(primaryError);

  if (!shouldFallback) {
    console.warn(`[Gemini model fallback] skipped for non-transient failure: ${primaryError.slice(0, 180)}`);
    return primary;
  }

  console.warn(
    `[Gemini model fallback] ${requested} failed transiently; retrying SAME chunk with ${fallbackModel}`
  );

  const fallback = await callAI(prompt, geminiKeys, fallbackModel, startKeyIndex);

  if (fallback?.result) {
    return {
      ...fallback,
      model: fallbackModel
    };
  }

  return {
    result: '',
    error: fallback?.error || primary?.error || 'Gemini translation failed on both models',
    model: fallbackModel
  };
}

function stripMarkdownCodeFence(value) {
  return String(value || '')
    .replace(/^```(?:json|text)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function buildSubtitleContextSample(srt, maxChars = 10000) {
  const text = String(srt || '').replace(/\r/g, '').trim();
  if (!text) return '';

  if (text.length <= maxChars) return text;

  const headSize = Math.floor(maxChars * 0.72);
  const tailSize = maxChars - headSize;
  return (
    text.slice(0, headSize) +
    '\n\n[...đã lược bớt phần giữa của phụ đề...]\n\n' +
    text.slice(-tailSize)
  );
}

function itemIdSafe(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(-80) || Math.random().toString(36).slice(2, 6);
}

async function handleSubtitles(req, res, encodedConfig) {
  const config = parseConfig(encodedConfig);
  const { type, id } = req.params;
  const parts = id.split(':');
  const imdbId = parts[0];
  const season = parts[1] ? parseInt(parts[1], 10) : null;
  const episode = parts[2] ? parseInt(parts[2], 10) : null;
  const hostUrl = makeHostUrl(req);
  const modelToUse = config.model || 'gemini-3.5-flash-lite';

  const activationToken = createSubtitleActivation(imdbId, type, season, episode);

  const aiUrlVersion = '3.9.44';

  let nativeVietSubtitles = [];
  let englishOriginalSubtitles = [];
  let englishSubtitlesForAI = [];

  const fetchOpenSubtitles = async () => {
    const native = [];
    const ai = [];
    try {
      const apiKeyOS = String(config.opensubtitlesKey || '2015').trim();
      const baseParams = {};
      if (imdbId.startsWith('tt')) baseParams.imdb_id = imdbId.replace(/^tt/, '');
      if (type === 'series' && season !== null && episode !== null) {
        baseParams.season_number = season;
        baseParams.episode_number = episode;
      }

      const searchOS = async languages => {
        const r = await axios.get('https://api.opensubtitles.com/api/v1/subtitles', {
          params: { ...baseParams, languages },
          headers: { 'Api-Key': apiKeyOS, ...API_HEADERS },
          timeout: 7000
        });
        return Array.isArray(r.data?.data) ? r.data.data : [];
      };

      const [osViResult, osEnResult] = await Promise.allSettled([
        searchOS('vi'),
        searchOS('en')
      ]);
      const osVi = osViResult.status === 'fulfilled' ? osViResult.value : [];
      const osEn = osEnResult.status === 'fulfilled' ? osEnResult.value : [];
      const osSelected = [
        ...osVi.filter(item => isVietnamese(item.attributes?.language || '')).slice(0, 6),
        ...osEn.filter(item => isEnglish(item.attributes?.language || '')).slice(0, 6)
      ];

      const osMapped = await Promise.allSettled(osSelected.map(async item => {
        const file = (item.attributes?.files || []).find(f => f?.file_id) || item.attributes?.files?.[0];
        const lang = item.attributes?.language || '';
        if (!file?.file_id) return null;

        const releaseName = subtitleName(
          {
            releaseName: item.attributes?.releaseName,
            release_name: item.attributes?.release_name,
            release: item.attributes?.release,
            fileName: file.file_name,
            name: item.attributes?.name
          },
          'OpenSubtitles Sub'
        );
        const pickerId = subtitlePickerId(releaseName, `os-${item.id}`);
        const isVi = isVietnamese(lang);

        const sourceUrl =
          `\( {hostUrl}/proxy-os?fileId= \){encodeURIComponent(file.file_id)}` +
          `&config=${encodeURIComponent(encodedConfig || '')}`;
        if (isVi) {
          return {
            id: pickerId,
            url: sourceUrl,
            lang: 'vie',
            name: subtitleDisplayName(releaseName, 'vie', 'os')
          };
        }

        const aiUrl = `\( {hostUrl}/translate-sub?provider=os&fileId= \){encodeURIComponent(file.file_id)}&model=\( {encodeURIComponent(modelToUse)}&config= \){encodeURIComponent(encodedConfig || '')}&imdbId=\( {encodeURIComponent(imdbId)}&type= \){type}&season=\( {season || ''}&episode= \){episode || ''}&source=en&target=vi&gate=\( {encodeURIComponent(activationToken)}&v= \){aiUrlVersion}`;
        return {
          id: pickerId,
          url: aiUrl,
          lang: 'eng',
          name: subtitleDisplayName(releaseName, 'eng', 'os')
        };
      }));

      for (const r of osMapped) {
        if (r.status !== 'fulfilled' || !r.value) continue;
        if (r.value.lang === 'eng') {
          englishOriginalSubtitles.push(r.value);
        } else {
          native.push(r.value);
        }
      }
    } catch (err) {
      console.error('[OpenSubtitles]', err.response?.status || '', err.response?.data || err.message);
    }
    return { native, ai };
  };

  const fetchSubDL = async () => {
    const native = [];
    const ai = [];
    try {
      if (!imdbId || !config.subdlKey) return { native, ai };

      const apiKeySubDL = config.subdlKey;
      const searchSubDL = async languages => {
        const r = await axios.get('https://api.subdl.com/api/v1/subtitles', {
          params: {
            api_key: apiKeySubDL,
            imdb_id: imdbId,
            type: type === 'series' ? 'tv' : 'movie',
            languages,
            season: season,
            episode: episode,
            unpack: 1
          },
          timeout: 7000
        });
        return Array.isArray(r.data?.subtitles) ? r.data.subtitles : [];
      };

      const [viResult, enResult] = await Promise.allSettled([
        searchSubDL('VI'),
        searchSubDL('EN')
      ]);
      const viPacks = viResult.status === 'fulfilled' ? viResult.value : [];
      const enPacks = enResult.status === 'fulfilled' ? enResult.value : [];

      const flatten = (packs, wantedLang) => {
        const out = [];
        for (const sub of packs) {
          const files = Array.isArray(sub.unpack_files) && sub.unpack_files.length
            ? sub.unpack_files
            : [sub];
          for (const f of files) {
            const lang = f.language || sub.language || f.lang || sub.lang || '';
            if (!((wantedLang === 'vi' && isVietnamese(lang)) || (wantedLang === 'en' && isEnglish(lang)))) continue;
            const fileUrl = f.url || sub.url;
            if (!fileUrl) continue;
            out.push({
              ...sub,
              ...f,
              language: lang,
              url: fileUrl,
              release_name: f.release_name || sub.release_name || f.name || sub.name
            });
          }
        }
        return out;
      };

      const subdlVi = flatten(viPacks, 'vi').slice(0, 6);
      const subdlEn = flatten(enPacks, 'en').slice(0, 6);
      const mapped = [
        ...subdlVi.map(sub => ({ sub, vi: true })),
        ...subdlEn.map(sub => ({ sub, vi: false }))
      ];

      for (const { sub, vi } of mapped) {
        const lang = sub.language || sub.lang || '';
        const rawUrl = sub.url;
        if (!rawUrl) continue;
        const dlUrl = rawUrl.startsWith('http') ? rawUrl : `https://dl.subdl.com${rawUrl}`;
        const releaseName = subtitleName(sub, 'SubDL Sub');
        const idPart = sub.file_n_id || sub.n_id || sub.nId || sub.id || Math.random().toString(36).slice(2, 6);
        const pickerId = subtitlePickerId(releaseName, `subdl-${idPart}`);

        const sourceUrl =
          `\( {hostUrl}/proxy-subdl?url= \){encodeURIComponent(dlUrl)}` +
          `&config=${encodeURIComponent(encodedConfig || '')}`;
        if (vi && isVietnamese(lang)) {
          native.push({
            id: pickerId,
            url: sourceUrl,
            lang: 'vie',
            name: subtitleDisplayName(releaseName, 'vie', 'subdl')
          });
        } else if (!vi && isEnglish(lang)) {
          const aiUrl = `\( {hostUrl}/translate-sub?provider=subdl&sourceUrl= \){encodeURIComponent(dlUrl)}&model=\( {encodeURIComponent(modelToUse)}&config= \){encodeURIComponent(encodedConfig || '')}&imdbId=\( {encodeURIComponent(imdbId)}&type= \){type}&season=\( {season || ''}&episode= \){episode || ''}&source=en&target=vi&gate=\( {encodeURIComponent(activationToken)}&v= \){aiUrlVersion}`;
          englishOriginalSubtitles.push({
            id: pickerId,
            url: aiUrl,
            lang: 'eng',
            name: subtitleDisplayName(releaseName, 'eng', 'subdl')
          });
        }
      }
    } catch (err) {
      console.error('[SubDL]', err.response?.status || '', err.response?.data || err.message);
    }
    return { native, ai };
  };

  const fetchSubSource = async () => {
    const native = [];
    const ai = [];
    try {
      if (!imdbId || !config.subsourceKey) return { native, ai };

      let movieTitle = '';
      try {
        const metaRes = await axios.get(
          `https://v3-cinemeta.strem.io/meta/\( {type === 'series' ? 'series' : 'movie'}/ \){encodeURIComponent(imdbId)}.json`,
          { timeout: 5000 }
        );
        movieTitle = metaRes.data?.meta?.name || '';
      } catch (err) {
        console.error('[SubSource Cinemeta]', err.message);
      }

      if (!movieTitle) return { native, ai };

      const searchRes = await axios.get(`${SUBSOURCE_API}/movies/search`, {
        params: {
          searchType: 'text',
          q: movieTitle,
          ...(type === 'series' && season !== null ? { season } : {})
        },
        headers: getSubsourceHeaders(config.subsourceKey),
        timeout: 10000
      });

      const searchResults = Array.isArray(searchRes.data?.data) ? searchRes.data.data : [];
      const matchedMovie = searchResults.find(movie =>
        String(movie.imdbId || '').replace(/^tt/i, '') === String(imdbId).replace(/^tt/i, '') &&
        (type !== 'series' || season === null || movie.season == null || Number(movie.season) === season)
      );

      if (!matchedMovie?.movieId) return { native, ai };

      const getSubsourceSubs = async language => {
        const response = await axios.get(`${SUBSOURCE_API}/subtitles`, {
          params: {
            movieId: matchedMovie.movieId,
            language,
            page: 1,
            limit: 100,
            sort: 'rating'
          },
          headers: getSubsourceHeaders(config.subsourceKey),
          timeout: 10000
        });
        return Array.isArray(response.data?.data) ? response.data.data : [];
      };

      let [viPrimary, viFallback, english] = await Promise.all([
        getSubsourceSubs('vi').catch(() => []),
        getSubsourceSubs('vie').catch(() => []),
        getSubsourceSubs('english').catch(() => [])
      ]);

      let vietnameseSubs = [...viPrimary, ...viFallback]
        .filter(sub => isVietnamese(sub.language ?? sub.languageCode ?? sub.language_code ?? sub.lang));
      let englishSubs = english
        .filter(sub => isEnglish(sub.language ?? sub.languageCode ?? sub.language_code ?? sub.lang));

      const selectedSubs = [
        ...vietnameseSubs.slice(0, 6).map(sub => ({ sub, vi: true })),
        ...englishSubs.slice(0, 6).map(sub => ({ sub, vi: false }))
      ];

      for (const item of selectedSubs) {
        const sub = item.sub;
        const isViSelected = item.vi;
        if (!sub.subtitleId) continue;
        const releaseName = subtitleName(
          sub,
          sub.productionType || 'SubSource'
        );
        const pickerId = subtitlePickerId(releaseName, `subsource-${sub.subtitleId}`);
        const downloadUrl =
          `\( {hostUrl}/subsource-sub/ \){encodeURIComponent(sub.subtitleId)}` +
          `?config=${encodeURIComponent(encodedConfig || '')}`;
        const subLanguage = sub.language ?? sub.languageCode ?? sub.language_code ?? sub.lang;

        if (isViSelected && isVietnamese(subLanguage)) {
          native.push({
            id: pickerId,
            url: downloadUrl,
            lang: 'vie',
            name: subtitleDisplayName(releaseName, 'vie', 'subsource')
          });
        } else if (!isViSelected && isEnglish(subLanguage)) {
          const aiUrl =
            `${hostUrl}/translate-sub?provider=subsource` +
            `&subtitleId=${encodeURIComponent(sub.subtitleId)}` +
            `&model=${encodeURIComponent(modelToUse)}` +
            `&config=${encodeURIComponent(encodedConfig || '')}` +
            `&imdbId=${encodeURIComponent(imdbId)}` +
            `&type=${encodeURIComponent(type)}` +
            `&season=\( {season || ''}&episode= \){episode || ''}&source=en&target=vi&gate=\( {encodeURIComponent(activationToken)}&v= \){aiUrlVersion}`;
          englishOriginalSubtitles.push({
            id: pickerId,
            url: aiUrl,
            lang: 'eng',
            name: subtitleDisplayName(releaseName, 'eng', 'subsource')
          });
        }
      }
    } catch (err) {
      console.error('[SubSource]', err.response?.status || '', err.response?.data || err.message);
    }
    return { native, ai };
  };

  const [osResult, subdlResult, subsourceResult] = await Promise.allSettled([
    fetchOpenSubtitles(),
    fetchSubDL(),
    fetchSubSource()
  ]);

  for (const result of [osResult, subdlResult, subsourceResult]) {
    if (result.status !== 'fulfilled' || !result.value) continue;
    nativeVietSubtitles.push(...result.value.native);
  }

  console.log(
    '[Subtitles parallel]',
    `OS=${osResult.status}`,
    `SubDL=${subdlResult.status}`,
    `SubSource=${subsourceResult.status}`,
    `VI=${nativeVietSubtitles.length}`,
    `EN=${englishOriginalSubtitles.length}`,
    `AI=click-English`
  );

  const seenSubtitleKeys = new Set();

  const providerRank = sub => {
    const url = String(sub?.url || '').toLowerCase();
    if (url.includes('/proxy-os?') || url.includes('/translate-sub?provider=os')) return 0;
    if (url.includes('/subsource-sub/') || url.includes('/translate-sub?provider=subsource')) return 1;
    if (url.includes('/proxy-subdl?') || url.includes('/translate-sub?provider=subdl')) return 2;
    return 3;
  };

  const subtitles = [...nativeVietSubtitles, ...englishOriginalSubtitles].filter(sub => {
    const nameKey = String(sub?.name || '').trim().toLowerCase();
    const urlKey = String(sub?.url || '').trim();
    const key = nameKey ? `name:\( {nameKey}` : `url: \){urlKey}`;
    if (seenSubtitleKeys.has(key)) return false;
    seenSubtitleKeys.add(key);
    return true;
  });

  subtitles.sort((a, b) => providerRank(a) - providerRank(b));

  res.json({ subtitles });
}

app.get('/subsource-sub/:subtitleId', async (req, res) => {
  const { subtitleId } = req.params;
  const config = parseConfig(req.query.config || '');
  const apiKey = String(config.subsourceKey || '').trim();

  if (!subtitleId) return res.status(400).send('Missing subtitle ID');
  if (!apiKey) return res.status(401).send('Missing SubSource API Key');

  try {
    const text = await fetchSubsourceSubtitleText(subtitleId, apiKey);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(text);
  } catch (err) {
    console.error('[VI ORIGINAL SubSource]', err.response?.status || '', err.code || '', err.message);
    res.status(502).send(
      'Không thể tải phụ đề từ SubSource: ' + String(err.message || 'upstream error').slice(0, 180)
    );
  }
});

app.get('/proxy-os', async (req, res) => {
  const fileId = String(req.query.fileId || '');
  const directLink = String(req.query.link || '');
  const config = parseConfig(req.query.config || '');
  const apiKeyOS = String(config.opensubtitlesKey || '2015').trim();

  if (!fileId && !directLink) {
    return res.status(400).send('Missing OpenSubtitles file ID');
  }

  try {
    let link = directLink;

    if (!link && fileId) {
      const download = await axios.post(
        'https://api.opensubtitles.com/api/v1/download',
        { file_id: fileId },
        {
          headers: {
            'Api-Key': apiKeyOS,
            ...API_HEADERS,
            'Content-Type': 'application/json'
          },
          timeout: 10000,
          validateStatus: status => status >= 200 && status < 300
        }
      );

      link = download.data?.link || '';
      if (!link) {
        throw new Error(`OpenSubtitles /download không trả link (HTTP ${download.status || 'unknown'}).`);
      }
    }

    const subtitleText = await fetchSubtitleText(link, SUBTITLE_BROWSER_HEADERS, 30000, 2);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(subtitleText);
  } catch (err) {
    const status = err.response?.status || '';
    const detail =
      err.response?.data?.message ||
      err.response?.data?.errors?.[0]?.message ||
      err.message ||
      'upstream error';

    console.error('[VI ORIGINAL OpenSubtitles]', status, err.code || '', detail);
    return res.send('1\n00:00:01,000 --> 00:00:10,000\n[OpenSubtitles] Không thể tải phụ đề gốc: ' + String(detail).replace(/\r?\n/g, ' ').slice(0, 180));
  }
});

app.get('/proxy-subdl', async (req, res) => {
  const url = String(req.query.url || '');
  const config = parseConfig(req.query.config || '');
  const key = String(config.subdlKey || '').trim();

  if (!url) return res.status(400).send('Missing SubDL URL');
  if (!key) return res.status(401).send('Missing SubDL API Key');

  try {
    const subtitleText = await fetchSubtitleText(url, {
      ...SUBTITLE_BROWSER_HEADERS,
      'X-API-Key': key,
      'Authorization': `Bearer ${key}`
    }, 30000, 2);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(subtitleText);
  } catch (err) {
    console.error('[VI ORIGINAL SubDL]', err.response?.status || '', err.code || '', err.message);
    return res.send('1\n00:00:01,000 --> 00:00:10,000\n[SubDL] Không thể tải phụ đề gốc: ' + String(err.message || 'upstream error').replace(/\r?\n/g, ' ').slice(0, 180));
  }
});

app.get('/proxy-sub', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('Missing URL');
  try {
    const text = await fetchSubtitleText(url, SUBTITLE_BROWSER_HEADERS, 30000);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(text);
  } catch (err) {
    console.error('[proxy-sub]', err.response?.status || '', err.code || '', err.message);
    res.send('1\n00:00:01,000 --> 00:00:10,000\n[Proxy] Không thể tải phụ đề gốc: ' + String(err.message || 'upstream error').replace(/\r?\n/g, ' ').slice(0, 180));
  }
});

app.get('/ai-test-all', async (req, res) => {
  const config = parseConfig(req.query.config || '');
  const geminiKeys = (config.geminiKeys && config.geminiKeys.length > 0)
    ? config.geminiKeys
    : [process.env.GEMINI_API_KEY].filter(Boolean);
  const requestedModel = req.query.model || config.model || 'gemini-3.5-flash-lite';

  if (!geminiKeys.length) {
    return res.json({ ok: false, error: 'Chưa có Gemini API Key', keys: [] });
  }

  const results = await Promise.all(geminiKeys.slice(0, 3).map(async (key, index) => {
    const r = await callAIWithKey(
      'Trả lời đúng một câu: Gemini worker hoạt động bình thường.',
      key,
      requestedModel
    );
    return {
      worker: index + 1,
      keyHint: `\( {String(key).slice(0, 6)}... \){String(key).slice(-4)}`,
      ok: !!r.result,
      modelUsed: r.model || null,
      error: r.error || null
    };
  }));

  res.json({ ok: results.every(r => r.ok), modelRequested: requestedModel, workers: results });
});

app.get('/ai-test', async (req, res) => {
  const config = parseConfig(req.query.config || '');
  const geminiKeys = (config.geminiKeys && config.geminiKeys.length > 0)
    ? config.geminiKeys
    : [process.env.GEMINI_API_KEY].filter(Boolean);

  const requestedModel = req.query.model || config.model || 'gemini-3.5-flash-lite';

  if (!geminiKeys.length) {
    return res.json({
      ok: false,
      error: 'Chưa có Gemini API Key',
      model: requestedModel,
      configReceived: !!req.query.config
    });
  }

  const result = await callAI(
    'Trả lời đúng một câu: Gemini hoạt động bình thường.',
    geminiKeys,
    requestedModel
  );

  res.json({
    ok: !!result.result,
    modelRequested: requestedModel,
    modelUsed: result.model || null,
    result: result.result || '',
    error: result.error || null
  });
});

const characterGuideCache = new Map();
const CHARACTER_GUIDE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const translatedSubtitleCache = new Map();
const TRANSLATION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const TRANSLATION_CACHE_MAX = 40;
const translationInFlight = new Map();

const subtitleActivation = new Map();
const SUBTITLE_ACTIVATION_TTL_MS = 15 * 60 * 1000;

function makeActivationShowKey(imdbId, type) {
  return `\( {String(imdbId || '').trim().toLowerCase()}| \){String(type || '').trim().toLowerCase()}`;
}
function makeActivationEpisodeKey(season, episode) {
  const s = season === '' || season == null ? '-' : String(Number(season));
  const e = episode === '' || episode == null ? '-' : String(Number(episode));
  return `\( {s}| \){e}`;
}
function createSubtitleActivation(imdbId, type, season, episode) {
  const showKey = makeActivationShowKey(imdbId, type);
  const token = `\( {Date.now().toString(36)}- \){Math.random().toString(36).slice(2, 12)}`;
  subtitleActivation.set(showKey, { token, episodeKey: makeActivationEpisodeKey(season, episode), createdAt: Date.now() });
  const now = Date.now();
  for (const [key, entry] of subtitleActivation) {
    if (!entry || now - entry.createdAt > SUBTITLE_ACTIVATION_TTL_MS) subtitleActivation.delete(key);
  }
  return token;
}
function isSubtitleActivationValid(imdbId, type, season, episode, token) {
  if (!token) return false;
  const entry = subtitleActivation.get(makeActivationShowKey(imdbId, type));
  if (!entry || Date.now() - entry.createdAt > SUBTITLE_ACTIVATION_TTL_MS) return false;
  return entry.token === String(token) && entry.episodeKey === makeActivationEpisodeKey(season, episode);
}

function makeTranslationCacheKey({
  url,
  provider,
  fileId,
  sourceUrl,
  subtitleId,
  model,
  imdbId,
  type,
  season,
  episode
}) {
  const logicalSource =
    provider === 'os'
      ? `os:file:${fileId || ''}`
      : provider === 'subdl'
        ? `subdl:${sourceUrl || url || ''}`
        : provider === 'subsource'
          ? `subsource:${subtitleId || ''}`
          : `url:${url || sourceUrl || ''}`;

  const normalizedImdb = String(imdbId || '').trim().toLowerCase();
  const normalizedType = String(type || '').trim().toLowerCase();
  const normalizedSeason = season === '' || season == null ? '-' : String(Number(season));
  const normalizedEpisode = episode === '' || episode == null ? '-' : String(Number(episode));
  const normalizedModel = String(model || '').trim();

  return [
    'v3.9.55',
    logicalSource,
    normalizedModel,
    normalizedImdb,
    normalizedType,
    normalizedSeason,
    normalizedEpisode
  ].join('|');
}

function getCachedTranslation(key) {
  const hit = translatedSubtitleCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.createdAt > TRANSLATION_CACHE_TTL_MS) {
    translatedSubtitleCache.delete(key);
    return null;
  }
  return hit.srt;
}

function setCachedTranslation(key, srt) {
  translatedSubtitleCache.set(key, { createdAt: Date.now(), srt });
  while (translatedSubtitleCache.size > TRANSLATION_CACHE_MAX) {
    const oldestKey = translatedSubtitleCache.keys().next().value;
    if (oldestKey === undefined) break;
    translatedSubtitleCache.delete(oldestKey);
  }
}

function formatEta(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return `${s} giây`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m < 60) return sec ? `${m} phút \( {sec} giây` : ` \){m} phút`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h} giờ \( {mm} phút` : ` \){h} giờ`;
}

function makeStatusSrt(message = '', durationSeconds = 30) {
  const safeDuration = Math.max(5, Math.min(3600, Number(durationSeconds) || 30));
  const endMs = Math.round(safeDuration * 1000);
  const h = String(Math.floor(endMs / 3600000)).padStart(2, '0');
  const m = String(Math.floor((endMs % 3600000) / 60000)).padStart(2, '0');
  const sec = String(Math.floor((endMs % 60000) / 1000)).padStart(2, '0');
  const ms = String(endMs % 1000).padStart(3, '0');
  return `1\n00:00:00,000 --> \( {h}: \){m}:\( {sec}, \){ms}\n${String(message || '').trim()}`;
}

function shiftAndAppendSrt(baseNumber, srt) {
  const clean = String(srt || '').trim();
  if (!clean) return '';
  let n = baseNumber;
  return clean
    .split(/\r?\n\s*\r?\n/)
    .map(block => {
      const lines = block.split(/\r?\n/);
      if (!lines.length) return '';
      const first = lines[0].trim();
      if (/^\d+$/.test(first)) {
        lines[0] = String(n++);
      } else {
        lines.unshift(String(n++));
      }
      return lines.join('\n');
    })
    .filter(Boolean)
    .join('\n\n');
}

function writeLiveStatus(res, state, force = false) {
  if (!state || !res || res.writableEnded) return;
  const now = Date.now();
  if (!force && state.lastWrite && now - state.lastWrite < 350) return;
  state.lastWrite = now;

  const elapsed = (now - state.startedAt) / 1000;
  const done = Math.max(0, state.done || 0);
  const total = Math.max(1, state.total || 1);
  const percent = Math.min(100, Math.round((done / total) * 100));
  let eta = state.etaSeconds;
  if (done > 0 && elapsed > 0) {
    const avg = elapsed / done;
    eta = Math.max(0, Math.round(avg * (total - done)));
  }

  let text;
  if (state.error) {
    text = `❌ Gemini AI: ${state.error}`;
  } else if (state.finished) {
    text = '✅ Gemini AI: Dịch phụ đề hoàn tất.';
  } else if (state.fallback) {
    text = `🔁 Gemini AI: ${state.fallback}`;
  } else if (done > 0) {
    text = `🟡 Gemini AI đang dịch... \( {done}/ \){total} (${percent}%)\n⏱️ Còn khoảng: ${formatEta(eta)}`;
  } else {
    text = `🟡 Gemini AI đang dịch phụ đề...\n📦 ${total} đoạn cần dịch\n⏱️ Dự kiến: khoảng ${formatEta(eta)}\n🤖 Model: ${state.model}`;
  }

  const cueStart = Math.max(0, (state.statusCueIndex || 0) * 2500);
  const cueEnd = cueStart + 2200;
  state.statusCueIndex = (state.statusCueIndex || 0) + 1;
  res.write(makeStatusSrt(state.statusNumber++, cueStart, cueEnd, text));
}

app.get('/translate-sub', async (req, res) => {
  const { url, provider, fileId, sourceUrl, subtitleId, model, config: configQuery, imdbId, type, season, episode, source, target, gate } = req.query;

  console.log('[translate-sub headers]', JSON.stringify({
    ua: req.get('user-agent') || '',
    referer: req.get('referer') || '',
    accept: req.get('accept') || '',
    range: req.get('range') || '',
    xrw: req.get('x-requested-with') || '',
    fetchDest: req.get('sec-fetch-dest') || '',
    fetchMode: req.get('sec-fetch-mode') || '',
    fetchSite: req.get('sec-fetch-site') || '',
    cacheControl: req.get('cache-control') || ''
  }));

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Accel-Buffering', 'no');

  if (!url && !provider) {
    return res.send('1\n00:00:01,000 --> 00:00:05,000\n[LỖI]: Thiếu nguồn phụ đề tiếng Anh.');
  }

  if (source && String(source).toLowerCase() !== 'en') {
    return res.send('1\n00:00:01,000 --> 00:00:06,000\n[Gemini AI] Chỉ hỗ trợ dịch từ phụ đề tiếng Anh.');
  }
  if (target && String(target).toLowerCase() !== 'vi') {
    return res.send('1\n00:00:01,000 --> 00:00:06,000\n[Gemini AI] Đích dịch phải là tiếng Việt.');
  }

  let cacheKey = '';

  if (!isSubtitleActivationValid(imdbId, type, season, episode, gate)) {
    console.log('[translate-sub STALE/UNARMED BLOCKED]');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    return res.send('');
  }

  try {
    const config = parseConfig(configQuery);
    const geminiKeys = (config.geminiKeys && config.geminiKeys.length > 0)
      ? config.geminiKeys
      : [process.env.GEMINI_API_KEY].filter(Boolean);

    if (!geminiKeys.length) {
      return res.send('1\n00:00:01,000 --> 00:00:08,000\n[LỖI]: Chưa có Gemini API Key.');
    }

    const selectedModel = model || config.model || 'gemini-3.5-flash-lite';
    cacheKey = makeTranslationCacheKey({
      url,
      provider,
      fileId,
      sourceUrl,
      subtitleId,
      model: selectedModel,
      imdbId,
      type,
      season,
      episode
    });

    const cachedSrt = getCachedTranslation(cacheKey);
    if (cachedSrt) {
      console.log('[translate-sub CACHE HIT]', cacheKey.slice(0, 180));
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      return res.send(cachedSrt);
    }

    const existingJob = translationInFlight.get(cacheKey);
    if (existingJob) {
      console.log('[translate-sub REQUEST #2 WHILE RUNNING]', cacheKey.slice(0, 180));

      try {
        const result = await Promise.race([
          existingJob.promise,
          new Promise(resolve => setTimeout(() => resolve(null), 15000))
        ]);

        if (result) {
          console.log('[translate-sub REQUEST #2] FINAL READY FROM IN-FLIGHT JOB');
          return res.send(normalizeSrtForPlayback(result));
        }
      } catch (waitErr) {
        console.error('[translate-sub REQUEST #2 wait]', waitErr.message || waitErr);
      }

      const finalAfterWait = getCachedTranslation(cacheKey);
      if (finalAfterWait) {
        console.log('[translate-sub REQUEST #2] FINAL CACHE HIT AFTER WAIT');
        return res.send(normalizeSrtForPlayback(finalAfterWait));
      }

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      return res.send('');
    }

    const jobEntry = {
      promise: null,
      resolve: null
    };
    jobEntry.promise = new Promise(resolve => {
      jobEntry.resolve = resolve;
    });
    translationInFlight.set(cacheKey, jobEntry);

    const statusState = {
      startedAt: Date.now(),
      done: 0,
      total: 1,
      model: selectedModel,
      etaSeconds: 30,
      finished: false,
      fallback: '',
      error: ''
    };

    console.log('[translate-sub REQUEST #1 NEW JOB]', cacheKey.slice(0, 180));
    console.log(
      `🔄 [Gemini AI] Request #1: trả trạng thái ngay, bắt đầu dịch nền | ` +
      `\( {imdbId || 'unknown'} | nguồn= \){provider || 'legacy'} | model=${selectedModel}`
    );

    void (async () => {
      try {
        let originalSrt;
        try {
          const sourceConfig = config;
          if (provider === 'os') {
            const apiKeyOS = sourceConfig.opensubtitlesKey || '2015';
            if (!fileId) throw new Error('Thiếu OpenSubtitles file ID.');
            const download = await axios.post(
              'https://api.opensubtitles.com/api/v1/download',
              { file_id: String(fileId) },
              {
                headers: {
                  'Api-Key': apiKeyOS,
                  ...API_HEADERS,
                  'Content-Type': 'application/json'
                },
                timeout: 10000,
                validateStatus: status => status >= 200 && status < 300
              }
            );
            const link = download.data?.link || '';
            if (!link) throw new Error('OpenSubtitles không trả về link tải.');
            originalSrt = await fetchSubtitleText(link, SUBTITLE_BROWSER_HEADERS, 25000, 1);
          } else if (provider === 'subdl') {
            const key = String(sourceConfig.subdlKey || '');
            if (!key) throw new Error('Thiếu SubDL API Key.');
            if (!sourceUrl) throw new Error('Thiếu SubDL subtitle URL.');
            originalSrt = await fetchSubtitleText(sourceUrl, {
              ...SUBTITLE_BROWSER_HEADERS,
              'X-API-Key': key,
              'Authorization': `Bearer ${key}`
            }, 25000, 1);
          } else if (provider === 'subsource') {
            const key = String(sourceConfig.subsourceKey || '');
            if (!key) throw new Error('Thiếu SubSource API Key.');
            if (!subtitleId) throw new Error('Thiếu SubSource subtitle ID.');
            const response = await axios.get(
              `\( {SUBSOURCE_API}/subtitles/ \){encodeURIComponent(subtitleId)}/download`,
              {
                headers: getSubsourceHeaders(key),
                responseType: 'arraybuffer',
                timeout: 25000,
                maxRedirects: 5,
                validateStatus: status => status >= 200 && status < 300
              }
            );
            originalSrt = extractSubtitleText(Buffer.from(response.data));
          } else {
            if (!url) throw new Error('Thiếu đường dẫn file phụ đề.');
            originalSrt = await fetchSubtitleText(url, SUBTITLE_BROWSER_HEADERS, 25000, 1);
          }
        } catch (err) {
          console.error('[translate-sub source]', err.response?.status || '', err.code || '', err.message);
          throw new Error('Không tải được file phụ đề tiếng Anh: ' + String(err.message || 'upstream error').slice(0, 140));
        }

        console.log(`📥 [Gemini AI] Đã tải phụ đề gốc: ${String(originalSrt || '').length.toLocaleString()} ký tự`);

        let movieContext = 'Phim điện ảnh/truyền hình tổng quát. Chưa có metadata từ Cinemeta.';
        if (imdbId) {
          try {
            const metaRes = await axios.get(`https://v3-cinemeta.strem.io/meta/\( {type === 'series' ? 'series' : 'movie'}/ \){imdbId}.json`, { timeout: 5000 });
            const meta = metaRes.data?.meta;
            if (meta) {
              movieContext =
                `Tên phim: ${meta.name || ''}` +
                `\nThể loại: ${Array.isArray(meta.genres) ? meta.genres.join(', ') : ''}` +
                `\nMô tả Cinemeta: ${meta.description || ''}`;

              if (type === 'series' && season && episode && Array.isArray(meta.videos)) {
                const ep = meta.videos.find(v =>
                  v.season === parseInt(season, 10) &&
                  v.episode === parseInt(episode, 10)
                );
                if (ep) {
                  movieContext +=
                    `\nTập \( {season}x \){episode}: ${ep.name || ''}` +
                    `\nTóm tắt tập từ Cinemeta: ${ep.overview || ''}`;
                }
              }

              const [imdbWeb, wiki] = await Promise.all([
                fetchImdbWebContext(imdbId, meta.name || '').catch(() => ''),
                fetchWikipediaContext(meta.name || '', meta.year || '').catch(() => '')
              ]);
              if (imdbWeb) movieContext += `\n\n${imdbWeb}`;
              if (wiki) movieContext += `\n\n${wiki}`;
            }
          } catch (err) {
            console.error('[Movie web context]', err.message);
          }
        }

        const subtitleSample = buildSubtitleContextSample(originalSrt, 4000);
        let relationshipGuide = '';
        try {
          const guideKey = `\( {imdbId || 'unknown'}|S \){season || 0}E\( {episode || 0}| \){selectedModel}`;
          const cachedGuide = characterGuideCache.get(guideKey);
          if (cachedGuide && (Date.now() - cachedGuide.createdAt) < CHARACTER_GUIDE_CACHE_TTL_MS) {
            relationshipGuide = cachedGuide.text;
            console.log(`📚 [Character Guide] CACHE HIT | ${relationshipGuide.length.toLocaleString()} ký tự`);
          } else {
            relationshipGuide = await buildCharacterRelationshipGuide({
              movieContext,
              subtitleSample,
              geminiKeys,
              model: selectedModel
            });
            if (relationshipGuide) {
              characterGuideCache.set(guideKey, { createdAt: Date.now(), text: relationshipGuide });
              console.log(`📚 [Character Guide] Đã tạo + cache sổ tay (${relationshipGuide.length.toLocaleString()} ký tự)`);
            } else {
              console.warn('[Character Guide] Không tạo được guide; tiếp tục dịch với metadata + mẫu thoại.');
            }
          }
          while (characterGuideCache.size > 100) {
            const oldestKey = characterGuideCache.keys().next().value;
            characterGuideCache.delete(oldestKey);
          }
        } catch (err) {
          console.warn('[Character Guide] lỗi, bỏ qua guide:', err.message);
        }

        const contextGuide = `
[BẢNG THÔNG TIN PHIM & SỔ TAY NHÂN VẬT]

Thông tin phim:
${movieContext}

BẢNG NHÂN VẬT & QUAN HỆ (cách xưng hô theo tình huống):
${relationshipGuide ? JSON.stringify(relationshipGuide, null, 2) : 'Chưa có bảng phân tích nhân vật.'}

Mẫu thoại tham chiếu:
${subtitleSample}

QUY TẮC SỬ DỤNG:
- Xưng hô phải theo bảng trên + bằng chứng từ mẫu thoại.
- Giữ tên, biệt danh, chức danh nhất quán.
- Mỗi lần dịch chỉ dùng bảng này (không tự thêm quan hệ).
`;

        const chunks = splitSrtIntoChunks(originalSrt, 20000, 150);
        const translated = [];
        statusState.total = chunks.length;
        statusState.etaSeconds = String(type || '').toLowerCase() === 'movie' ? 120 : 60;

        const baseWorkerKeys = geminiKeys.slice(0, 3);
        const WORKERS_PER_KEY = 5;
        const workerSlots = [];
        const workerKeyIndexes = [];
        for (let slot = 0; slot < WORKERS_PER_KEY; slot++) {
          for (let keyIndex = 0; keyIndex < baseWorkerKeys.length; keyIndex++) {
            workerSlots.push(baseWorkerKeys[keyIndex]);
            workerKeyIndexes.push(keyIndex);
          }
        }
        const activeWorkerCount = Math.min(chunks.length, workerSlots.length);
        const activeWorkerSlots = workerSlots.slice(0, activeWorkerCount);
        workerKeyIndexes.length = activeWorkerCount;

        console.log(`🚀 [Gemini AI] Turbo concurrency: ${activeWorkerCount} worker | ${baseWorkerKeys.length} key`);

        let nextChunkIndex = 0;
        const worker = async (workerIndex, workerKey) => {
          while (true) {
            const i = nextChunkIndex++;
            if (i >= chunks.length) return;
            await translateChunk(i, workerKey, workerIndex);
          }
        };
        await Promise.all(activeWorkerSlots.map((key, index) => worker(index, key)));

        console.log(`🎉 [Gemini AI] Dịch hoàn tất \( {translated.length}/ \){chunks.length} chunk. Đang ghép SRT...`);

        translated.sort((a, b) => a.index - b.index);

        const finalSrt = rebuildTranslatedSrtFromSource(chunks, translated);
        const finalNormalizedSrt = normalizeSrtForPlayback(finalSrt);
        if (!finalNormalizedSrt) throw new Error('Bản dịch cuối rỗng sau khi chuẩn hóa SRT.');
        console.log(`📤 [Gemini AI] Đã ghép SRT theo timestamp gốc và lưu cache | ${finalNormalizedSrt.length.toLocaleString()} ký tự`);
        setCachedTranslation(cacheKey, finalNormalizedSrt);

        const verifiedFinalSrt = getCachedTranslation(cacheKey);
        if (!verifiedFinalSrt) {
          throw new Error('Không xác minh được FINAL SRT trong translation cache.');
        }
        console.log(`[translate-sub FINAL CACHE READY] ${cacheKey.slice(0, 180)} | ${verifiedFinalSrt.length.toLocaleString()} ký tự`);
        console.log(`🟢 [Gemini AI] SAME TRACK READY: lần request tiếp theo của chính URL Gemini này sẽ trả SRT Việt.`);

        if (jobEntry?.resolve) jobEntry.resolve(verifiedFinalSrt);
        statusState.finished = true;
        statusState.fallback = '';
        statusState.etaSeconds = 0;
        console.log(`🟢 [Gemini AI] Background job hoàn tất | cache ready | ${cacheKey.slice(0, 120)}`);
        return finalNormalizedSrt;

      } catch (err) {
        const errorMessage = String(err.message || err).replace(/\r?\n/g, ' ').slice(0, 300);
        console.error('❌ [Gemini AI] Dịch thất bại:', err.stack || err.message || err);
        const errorSrt =
          `1\n00:00:01,000 --> 00:00:10,000\n[Gemini AI] Không thể dịch phụ đề: ${errorMessage}`;
        statusState.error = errorMessage;
        if (jobEntry?.resolve) jobEntry.resolve(errorSrt);
        console.error('[translate-sub BACKGROUND ERROR]', errorMessage);
      } finally {
        const entry = translationInFlight.get(cacheKey);
        if (entry === jobEntry) {
          translationInFlight.delete(cacheKey);
        }
        console.log('[translate-sub JOB RELEASED]', cacheKey.slice(0, 180));
      }
    })().catch(err => {
      console.error('[translate-sub background detached]', err);
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const isMovie = String(type || '').toLowerCase() === 'movie';
    const expectedTime = isMovie ? '2 phút' : '1 phút';
    const mediaLabel = isMovie ? 'phim lẻ' : 'phim bộ';
    const statusMessage =
      `🟡 Gemini AI đang dịch phụ đề...\n` +
      `⏱️ Dự kiến ${mediaLabel}: khoảng ${expectedTime}\n` +
      `⚡ Đang sử dụng cơ chế đa luồng dịch phụ đề\n` +
      `🔄 Khi dịch xong, bấm Reload phụ đề để nhận bản Việt.`;
    return res.send(makeStatusSrt(statusMessage, 3600));
  } catch (err) {
    console.error('[translate-sub setup]', err.stack || err.message || err);
    return res.send(
      `1\n00:00:01,000 --> 00:00:10,000\n[Gemini AI] Không thể bắt đầu dịch: ${String(err.message || err).replace(/\r?\n/g, ' ')}`
    );
  }
});

app.get('/subtitles/:type/:id.json', (req, res) => handleSubtitles(req, res, null));
app.get('/subtitles/:type/:id/:extra.json', (req, res) => handleSubtitles(req, res, null));
app.get('/:config/subtitles/:type/:id.json', (req, res) => handleSubtitles(req, res, req.params.config));
app.get('/:config/subtitles/:type/:id/:extra.json', (req, res) => handleSubtitles(req, res, req.params.config));

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`NothingP AIOsubtitles đang chạy tại port ${PORT}`);
});

server.keepAliveTimeout = 120000;
server.headersTimeout = 125000;
server.requestTimeout = 0;
