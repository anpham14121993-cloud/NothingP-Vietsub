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
  'User-Agent': 'AISubtitlePro v3.9.15',
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
<title>Cấu hình Gemini AI Subtitle Pro</title>
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
<h2>Gemini AI Subtitle Pro v3.9.15</h2>
<form id="configForm">
<label>Mô hình AI dịch:</label>
<select id="modelSelect">
<option value="gemini-3.5-flash-lite" ${savedConfig.model === 'gemini-3.5-flash-lite' || !savedConfig.model ? 'selected' : ''}>Gemini 3.5 Flash-Lite (Chính)</option>
<option value="gemini-2.5-flash" ${savedConfig.model === 'gemini-2.5-flash' ? 'selected' : ''}>Gemini 2.5 Flash (Dự phòng)</option>
</select>
<div style="font-size:12px;color:#aaa;margin-top:8px;line-height:1.45">Đã tích hợp cơ chế chống Timeout 100s của Render và xoay vòng 3 API Key song song.</div>
<div class="section-title">🔑 Google Gemini API Keys</div>
<label>Gemini API Key 1</label><input id="geminiKey1" value="${escapeHtml(geminiKeys[0])}" placeholder="AIzaSy...">
<label>Gemini API Key 2</label><input id="geminiKey2" value="${escapeHtml(geminiKeys[1])}">
<label>Gemini API Key 3</label><input id="geminiKey3" value="${escapeHtml(geminiKeys[2])}">
<div class="section-title">📥 Nguồn phụ đề</div>
<label>OpenSubtitles API Key</label><input id="opensubtitlesKey" value="${escapeHtml(savedConfig.opensubtitlesKey)}">
<label>SubDL API Key</label><input id="subdlKey" value="${escapeHtml(savedConfig.subdlKey)}">
<label>SubSource API Key</label><input id="subsourceKey" value="${escapeHtml(savedConfig.subsourceKey)}">
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

const defaultManifest = {
  id: 'org.gemini.ai.subtitle.pro',
  version: '3.9.15',
  name: 'Gemini AI Subtitle Pro',
  description: 'Tự động tìm sub Việt chuẩn hoặc dịch AI tốc độ cao với cơ chế chống timeout.',
  types: ['movie', 'series'],
  catalogs: [],
  resources: ['subtitles'],
  idPrefixes: ['tt'],
  configurable: true,
  behaviorHints: { configurable: true }
};

app.get('/healthz', (req, res) => {
  res.status(200).json({ ok: true, version: '3.9.15', uptime: Math.round(process.uptime()) });
});

app.get('/manifest.json', (req, res) => res.json(defaultManifest));
app.get('/:config/manifest.json', (req, res) => res.json(defaultManifest));

function makeHostUrl(req) {
  const forwardedProto = req.get('x-forwarded-proto');
  const protocol = forwardedProto ? forwardedProto.split(',')[0] : req.protocol;
  return `${protocol}://${req.get('host')}`;
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

function subtitleName(sub, fallback) {
  return sub?.releaseName || sub?.release_name || sub?.fileName || sub?.file_name || sub?.name || fallback;
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
    `${SUBSOURCE_API}/subtitles/${encodeURIComponent(subtitleId)}/download`,
    {
      headers: getSubsourceHeaders(apiKey),
      responseType: 'arraybuffer',
      timeout: 30000,
      maxRedirects: 5
    }
  );
  return extractSubtitleText(Buffer.from(response.data));
}

function splitSrtIntoChunks(srt, maxChars = 12000) {
  const blocks = srt.replace(/\r/g, '').trim().split(/\n\s*\n/).filter(Boolean);
  const chunks = [];
  let current = '';

  for (const block of blocks) {
    if (current && current.length + block.length + 2 > maxChars) {
      chunks.push(current);
      current = '';
    }
    current += (current ? '\n\n' : '') + block;
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
  const blocks = srtText.replace(/\r/g, '').trim().split(/\n\s*\n/).filter(Boolean);
  const entries = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    const timeLineIdx = lines.findIndex(line => line.includes('-->'));
    if (timeLineIdx < 0) continue;

    const [start, end] = lines[timeLineIdx].split('-->').map(s => s.trim());
    const text = lines.slice(timeLineIdx + 1).join('\n');
    if (start && end && text) {
      entries.push({ start, end, text, startMs: parseTimeToMs(start) });
    }
  }
  entries.sort((a, b) => a.startMs - b.startMs);
  return entries.map((e, index) => `${index + 1}\n${e.start} --> ${e.end}\n${e.text}`).join('\n\n') || srtText;
}

const GEMINI_MIN_INTERVAL_MS = 5000; // Cân bằng tốt giữa tốc độ và chống quota
const geminiKeyState = new Map();

function getGeminiKeyState(key) {
  if (!geminiKeyState.has(key)) {
    geminiKeyState.set(key, { lastRequestAt: 0, queue: Promise.resolve() });
  }
  return geminiKeyState.get(key);
}

async function withGeminiKeySlot(key, fn) {
  const state = getGeminiKeyState(key);
  let release;
  const next = new Promise(resolve => { release = resolve; });
  const previous = state.queue;
  state.queue = previous.then(() => next);

  await previous;
  try {
    const now = Date.now();
    const waitMs = Math.max(0, GEMINI_MIN_INTERVAL_MS - (now - state.lastRequestAt));
    if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs));
    state.lastRequestAt = Date.now();
    return await fn();
  } finally {
    release();
  }
}

const geminiCooldowns = new Map();

function geminiCooldownKey(model, key) {
  return `${model}::${key}`;
}

function getRetryAfterMs(message) {
  const m = String(message || '').match(/retry(?: in| after)\s+([0-9]+(?:\.[0-9]+)?)s/i);
  if (!m) return 0;
  const seconds = Math.min(300, Math.max(5, Number(m[1])));
  return seconds * 1000;
}

function markGeminiCooldown(model, key, ms) {
  if (!model || !key || !ms) return;
  geminiCooldowns.set(geminiCooldownKey(model, key), Date.now() + ms);
}

function isGeminiCoolingDown(model, key) {
  const until = geminiCooldowns.get(geminiCooldownKey(model, key)) || 0;
  if (!until) return false;
  if (until <= Date.now()) {
    geminiCooldowns.delete(geminiCooldownKey(model, key));
    return false;
  }
  return true;
}

function buildGeminiModelOrder(selectedModel) {
  const primary = selectedModel === 'gemini-2.5-flash'
    ? 'gemini-2.5-flash'
    : 'gemini-3.5-flash-lite';

  const fallback = primary === 'gemini-3.5-flash-lite'
    ? 'gemini-2.5-flash'
    : 'gemini-3.5-flash-lite';

  return [primary, fallback];
}

async function callAI(prompt, geminiKeys, model, startKeyIndex = 0) {
  const keys = [...new Set((geminiKeys || []).filter(Boolean))];
  if (!keys.length) {
    return { result: '', error: 'Thiếu Gemini API Key.' };
  }

  const models = buildGeminiModelOrder(model);
  let lastError = 'Lỗi không xác định';
  let attempted = 0;

  const orderedKeys = keys.map((_, offset) =>
    keys[(Math.max(0, startKeyIndex) + offset) % keys.length]
  );

  for (const modelName of models) {
    for (let keyPos = 0; keyPos < orderedKeys.length; keyPos++) {
      const key = orderedKeys[keyPos];

      if (isGeminiCoolingDown(modelName, key)) continue;
      attempted++;

      try {
        const response = await withGeminiKeySlot(key, async () => {
          const url =
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(key)}`;

          return axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2 }
          }, {
            timeout: 50000,
            headers: { 'Content-Type': 'application/json' }
          });
        });

        const result = response.data?.candidates?.[0]?.content?.parts
          ?.map(p => p.text || '')
          .join('')
          .trim();

        if (result) {
          return {
            result,
            error: null,
            model: modelName,
            keyIndex: keys.indexOf(key)
          };
        }
      } catch (err) {
        const status = err.response?.status;
        const message = err.response?.data?.error?.message || err.message;
        lastError = message;

        if (status === 401 || status === 403 || /invalid api key|unauthorized|permission denied/i.test(message)) {
          markGeminiCooldown(modelName, key, 30 * 60 * 1000);
          continue;
        }
        if (status === 429 || /RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(message)) {
          markGeminiCooldown(modelName, key, getRetryAfterMs(message) || 60 * 1000);
          continue;
        }
      }
    }
  }

  return { result: '', error: `Gemini failed: ${lastError}` };
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

  let nativeVietSubtitles = [];
  let englishOriginalSubtitles = [];

  const fetchOpenSubtitles = async () => {
    const native = [];
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

      const [osViResult, osEnResult] = await Promise.allSettled([searchOS('vi'), searchOS('en')]);
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

        const releaseName = item.attributes?.release || file.file_name || 'OpenSubtitles Sub';
        const isVi = isVietnamese(lang);
        const sourceUrl = `${hostUrl}/proxy-os?fileId=${encodeURIComponent(file.file_id)}&config=${encodeURIComponent(encodedConfig || '')}`;

        if (isVi) {
          return { id: `os-vi-${item.id}`, url: sourceUrl, lang: 'vie', name: `🇻🇳 [Tiếng Việt] ${releaseName}` };
        }

        const aiUrl = `${hostUrl}/translate-sub?provider=os&fileId=${encodeURIComponent(file.file_id)}&model=${encodeURIComponent(modelToUse)}&config=${encodeURIComponent(encodedConfig || '')}&imdbId=${encodeURIComponent(imdbId)}&type=${type}&season=${season || ''}&episode=${episode || ''}&source=en&target=vi`;
        return { id: `os-en-${item.id}`, url: aiUrl, lang: 'eng', name: `🇺🇸 [English → Gemini AI Việt] ${releaseName}` };
      }));

      for (const r of osMapped) {
        if (r.status === 'fulfilled' && r.value) {
          if (r.value.lang === 'eng') englishOriginalSubtitles.push(r.value);
          else native.push(r.value);
        }
      }
    } catch (err) {}
    return native;
  };

  const fetchSubDL = async () => {
    const native = [];
    try {
      if (!imdbId || !config.subdlKey) return native;
      const r = await axios.get('https://api.subdl.com/api/v1/subtitles', {
        params: { api_key: config.subdlKey, imdb_id: imdbId, type: type === 'series' ? 'tv' : 'movie', languages: 'VI,EN', season, episode, unpack: 1 },
        timeout: 7000
      });
      const subtitles = Array.isArray(r.data?.subtitles) ? r.data.subtitles : [];
      for (const sub of subtitles.slice(0, 10)) {
        const lang = sub.language || sub.lang || '';
        const rawUrl = sub.url;
        if (!rawUrl) continue;
        const dlUrl = rawUrl.startsWith('http') ? rawUrl : `https://dl.subdl.com${rawUrl}`;
        const releaseName = subtitleName(sub, 'SubDL Sub');
        const idPart = sub.file_n_id || sub.id || Math.random().toString(36).slice(2);
        const sourceUrl = `${hostUrl}/proxy-subdl?url=${encodeURIComponent(dlUrl)}&config=${encodeURIComponent(encodedConfig || '')}`;

        if (isVietnamese(lang)) {
          native.push({ id: `subdl-vi-${idPart}`, url: sourceUrl, lang: 'vie', name: `🇻🇳 [Tiếng Việt] ${releaseName}` });
        } else if (isEnglish(lang)) {
          const aiUrl = `${hostUrl}/translate-sub?provider=subdl&sourceUrl=${encodeURIComponent(dlUrl)}&model=${encodeURIComponent(modelToUse)}&config=${encodeURIComponent(encodedConfig || '')}&imdbId=${encodeURIComponent(imdbId)}&type=${type}&season=${season || ''}&episode=${episode || ''}&source=en&target=vi`;
          englishOriginalSubtitles.push({ id: `subdl-en-${idPart}`, url: aiUrl, lang: 'eng', name: `🇺🇸 [English → Gemini AI Việt] ${releaseName}` });
        }
      }
    } catch (err) {}
    return native;
  };

  const [osRes, subdlRes] = await Promise.allSettled([fetchOpenSubtitles(), fetchSubDL()]);
  if (osRes.status === 'fulfilled') nativeVietSubtitles.push(...osRes.value);
  if (subdlRes.status === 'fulfilled') nativeVietSubtitles.push(...subdlRes.value);

  res.json({ subtitles: [...nativeVietSubtitles, ...englishOriginalSubtitles] });
}

app.get('/proxy-os', async (req, res) => {
  const fileId = String(req.query.fileId || '');
  const config = parseConfig(req.query.config || '');
  try {
    const download = await axios.post('https://api.opensubtitles.com/api/v1/download', { file_id: fileId }, {
      headers: { 'Api-Key': config.opensubtitlesKey || '2015', ...API_HEADERS, 'Content-Type': 'application/json' },
      timeout: 10000
    });
    const link = download.data?.link;
    if (!link) throw new Error();
    const text = await fetchSubtitleText(link, SUBTITLE_BROWSER_HEADERS, 30000, 2);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(text);
  } catch (err) {
    res.send('1\n00:00:01,000 --> 00:00:10,000\n[Lỗi tải OpenSubtitles]');
  }
});

app.get('/proxy-subdl', async (req, res) => {
  const url = String(req.query.url || '');
  const config = parseConfig(req.query.config || '');
  try {
    const text = await fetchSubtitleText(url, { ...SUBTITLE_BROWSER_HEADERS, 'X-API-Key': config.subdlKey }, 30000, 2);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(text);
  } catch (err) {
    res.send('1\n00:00:01,000 --> 00:00:10,000\n[Lỗi tải SubDL]');
  }
});

const translatedSubtitleCache = new Map();
const TRANSLATION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const translationInFlight = new Map();

app.get('/translate-sub', async (req, res) => {
  const { url, provider, fileId, sourceUrl, subtitleId, model, config: configQuery, imdbId, type, season, episode } = req.query;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');

  if (!url && !provider) return res.send('1\n00:00:01,000 --> 00:00:05,000\n[LỖI]: Thiếu nguồn phụ đề.');

  let cacheKey = '';
  try {
    const config = parseConfig(configQuery);
    const geminiKeys = (config.geminiKeys && config.geminiKeys.length > 0)
      ? config.geminiKeys
      : [process.env.GEMINI_API_KEY].filter(Boolean);

    if (!geminiKeys.length) {
      return res.send('1\n00:00:01,000 --> 00:00:08,000\n[LỖI]: Chưa cấu hình Gemini API Key.');
    }

    const selectedModel = model || config.model || 'gemini-3.5-flash-lite';
    cacheKey = [url || provider, fileId || sourceUrl || subtitleId, selectedModel, imdbId].join('|');

    const cachedSrt = translatedSubtitleCache.get(cacheKey);
    if (cachedSrt && Date.now() - cachedSrt.createdAt < TRANSLATION_CACHE_TTL_MS) {
      res.setHeader('Cache-Control', 'public, max-age=21600');
      return res.send(cachedSrt.srt);
    }

    // Tải file phụ đề gốc tiếng Anh
    let originalSrt = '';
    if (provider === 'os') {
      const dl = await axios.post('https://api.opensubtitles.com/api/v1/download', { file_id: String(fileId) }, {
        headers: { 'Api-Key': config.opensubtitlesKey || '2015', ...API_HEADERS, 'Content-Type': 'application/json' }
      });
      originalSrt = await fetchSubtitleText(dl.data?.link);
    } else if (provider === 'subdl') {
      originalSrt = await fetchSubtitleText(sourceUrl, { ...SUBTITLE_BROWSER_HEADERS, 'X-API-Key': config.subdlKey });
    } else {
      originalSrt = await fetchSubtitleText(url, SUBTITLE_BROWSER_HEADERS);
    }

    const chunks = splitSrtIntoChunks(originalSrt, 10000);
    const translatedResults = new Array(chunks.length);
    const workerKeys = geminiKeys.slice(0, 3);

    const translateChunk = async (i, workerKey) => {
      const prompt = `Dịch đoạn SRT tiếng Anh sau sang tiếng Việt tự nhiên, giữ nguyên định dạng số thứ tự và timestamps. Chỉ trả về SRT đã dịch:\n\n${chunks[i]}`;
      const aiRes = await callAI(prompt, workerKeys, selectedModel, workerKey);
      if (aiRes.result) {
        translatedResults[i] = aiRes.result.trim();
      } else {
        // Fallback giữ nguyên bản gốc nếu lỗi
        translatedResults[i] = chunks[i];
      }
    };

    const worker = async (workerIndex) => {
      for (let i = workerIndex; i < chunks.length; i += workerKeys.length) {
        await translateChunk(i, workerIndex);
      }
    };

    // 🛡️ CHỐT CHẶN AN TOÀN CHỐNG TIMEOUT (80 giây)
    const translationTask = Promise.all(workerKeys.map((_, index) => worker(index)));
    const timeoutTask = new Promise(resolve => setTimeout(resolve, 80000));

    await Promise.race([translationTask, timeoutTask]);

    // Điền các đoạn chưa dịch kịp bằng bản gốc
    for (let i = 0; i < chunks.length; i++) {
      if (!translatedResults[i]) {
        translatedResults[i] = chunks[i];
      }
    }

    const finalSrt = cleanAndRebuildSrt(translatedResults.join('\n\n'));
    translatedSubtitleCache.set(cacheKey, { createdAt: Date.now(), srt: finalSrt });

    res.setHeader('Cache-Control', 'public, max-age=21600');
    return res.send(finalSrt);

  } catch (err) {
    return res.send(`1\n00:00:01,000 --> 00:00:10,000\n[Gemini AI] Lỗi xử lý: ${String(err.message || err)}`);
  }
});

app.get('/subtitles/:type/:id.json', (req, res) => handleSubtitles(req, res, null));
app.get('/subtitles/:type/:id/:extra.json', (req, res) => handleSubtitles(req, res, null));
app.get('/:config/subtitles/:type/:id.json', (req, res) => handleSubtitles(req, res, req.params.config));
app.get('/:config/subtitles/:type/:id/:extra.json', (req, res) => handleSubtitles(req, res, req.params.config));

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gemini AI Subtitle Pro đang chạy tại port ${PORT}`);
});

server.keepAliveTimeout = 120000;
server.headersTimeout = 125000;

