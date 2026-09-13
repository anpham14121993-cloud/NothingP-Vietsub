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
  'User-Agent': 'AISubtitlePro v3.9.13',
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
<h2>Gemini AI Subtitle Pro v3.9.13</h2>
<form id="configForm">
<label>Mô hình AI dịch:</label>
<select id="modelSelect">
<option value="gemini-3.5-flash-lite" ${savedConfig.model === 'gemini-3.5-flash-lite' || !savedConfig.model ? 'selected' : ''}>Gemini 3.5 Flash-Lite (Chính)</option>
<option value="gemini-2.5-flash" ${savedConfig.model === 'gemini-2.5-flash' ? 'selected' : ''}>Gemini 2.5 Flash (Dự phòng / có thể chọn làm chính)</option>
</select>
<div style="font-size:12px;color:#aaa;margin-top:8px;line-height:1.45">Cơ chế dịch: xoay Key 1 → Key 2 → Key 3 trên model chính. Nếu cả 3 Key đều lỗi/quota, tự chuyển sang model còn lại và tiếp tục xoay 3 Key. Không dùng Gemini 3.8 / 3.7 / 3.6.</div>
<div class="section-title">🔑 Google Gemini API Keys (Hỗ trợ xoay vòng nhiều Key)</div>
<label>Gemini API Key 1</label><input id="geminiKey1" value="${escapeHtml(geminiKeys[0])}" placeholder="AIzaSy...">
<label>Gemini API Key 2</label><input id="geminiKey2" value="${escapeHtml(geminiKeys[1])}">
<label>Gemini API Key 3</label><input id="geminiKey3" value="${escapeHtml(geminiKeys[2])}">
<div style="font-size:12px;color:#aaa;margin-top:8px;line-height:1.45">v3.9.1: 3 Key thuộc 3 Google Project khác nhau sẽ chạy 3 worker dịch song song. Mỗi Project có limiter riêng.</div>
<div class="section-title">📥 Nguồn phụ đề (OpenSubtitles, SubDL, Subsource)</div>
<label>OpenSubtitles API Key</label><input id="opensubtitlesKey" value="${escapeHtml(savedConfig.opensubtitlesKey)}">
<label>SubDL API Key</label><input id="subdlKey" value="${escapeHtml(savedConfig.subdlKey)}">
<label>SubSource API Key</label><input id="subsourceKey" value="${escapeHtml(savedConfig.subsourceKey)}" placeholder="Nhập SubSource API Key">
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
  version: '3.9.10',
  name: 'Gemini AI Subtitle Pro',
  description: 'Tự động tìm sub Việt chuẩn hoặc dịch AI với sổ tay nhân vật, quan hệ và xưng hô theo bối cảnh.',
  types: ['movie', 'series'],
  catalogs: [],
  resources: ['subtitles'],
  idPrefixes: ['tt'],
  configurable: true,
  behaviorHints: { configurable: true }
};

app.get('/healthz', (req, res) => {
  res.status(200).json({ ok: true, version: '3.9.10', uptime: Math.round(process.uptime()) });
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

const GEMINI_MIN_INTERVAL_MS = 4500;
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
    let modelHadUsableKey = false;

    for (let keyPos = 0; keyPos < orderedKeys.length; keyPos++) {
      const key = orderedKeys[keyPos];

      if (isGeminiCoolingDown(modelName, key)) {
        console.log(`[Gemini ${modelName} / key #${keys.indexOf(key) + 1}] cooldown -> skip`);
        continue;
      }

      modelHadUsableKey = true;
      attempted++;

      try {
        const response = await withGeminiKeySlot(key, async () => {
          const url =
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(key)}`;

          return axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2 }
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
          console.log(`[Gemini ${modelName} / key #${keys.indexOf(key) + 1}] success`);
          return {
            result,
            error: null,
            model: modelName,
            keyIndex: keys.indexOf(key)
          };
        }

        lastError = `Gemini ${modelName}: không trả về nội dung`;
      } catch (err) {
        const status = err.response?.status;
        const message =
          err.response?.data?.error?.message ||
          err.message ||
          `Gemini ${modelName}: lỗi không xác định`;

        lastError = message;
        console.error(`[Gemini ${modelName} / key #${keys.indexOf(key) + 1}]`, message);

        if (
          status === 401 || status === 403 ||
          /invalid authentication credentials|api key not valid|invalid api key|authentication|unauthorized|permission denied/i.test(message)
        ) {
          markGeminiCooldown(modelName, key, 30 * 60 * 1000);
          continue;
        }

        if (
          status === 429 ||
          /RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(message)
        ) {
          const cooldown = getRetryAfterMs(message) || 60 * 1000;
          markGeminiCooldown(modelName, key, cooldown);
          continue;
        }

        if (
          status === 408 || status === 425 || status === 500 ||
          status === 502 || status === 503 || status === 504 ||
          /high demand|temporarily unavailable|timeout|timed out|ECONNRESET|ETIMEDOUT/i.test(message)
        ) {
          try {
            const response = await withGeminiKeySlot(key, async () => {
              const url =
                `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(key)}`;

              return axios.post(url, {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2 }
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
              return {
                result,
                error: null,
                model: modelName,
                keyIndex: keys.indexOf(key)
              };
            }
          } catch (retryErr) {
            lastError = retryErr.response?.data?.error?.message || retryErr.message;
          }
          continue;
        }

        continue;
      }
    }
  }

  return {
    result: '',
    error: `Gemini failed after ${attempted} request attempt(s): ${lastError}`
  };
}

async function callAIWithKey(prompt, key, model) {
  if (!key) return { result: '', error: 'Thiếu Gemini API Key.' };
  return callAI(prompt, [key], model, 0);
}

function buildSubtitleContextSample(srt, maxChars = 14000) {
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

        const releaseName = item.attributes?.release || file.file_name || 'OpenSubtitles Sub';
        const isVi = isVietnamese(lang);

        const sourceUrl =
          `${hostUrl}/proxy-os?fileId=${encodeURIComponent(file.file_id)}` +
          `&config=${encodeURIComponent(encodedConfig || '')}`;
        if (isVi) {
          return {
            id: `os-vi-${item.id}`,
            url: sourceUrl,
            lang: 'vie',
            name: `🇻🇳 [Tiếng Việt] ${releaseName}`
          };
        }

        const aiUrl = `${hostUrl}/translate-sub?provider=os&fileId=${encodeURIComponent(file.file_id)}&model=${encodeURIComponent(modelToUse)}&config=${encodeURIComponent(encodedConfig || '')}&imdbId=${encodeURIComponent(imdbId)}&type=${type}&season=${season || ''}&episode=${episode || ''}&source=en&target=vi`;
        return {
          id: `os-en-${item.id}`,
          url: aiUrl,
          lang: 'eng',
          name: `🇺🇸 [English → Gemini AI Việt] ${releaseName}`
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
      console.error('[OpenSubtitles]', err.message);
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
        const idPart = sub.file_n_id || sub.n_id || sub.nId || sub.id || Math.random().toString(36).slice(2);

        const sourceUrl =
          `${hostUrl}/proxy-subdl?url=${encodeURIComponent(dlUrl)}` +
          `&config=${encodeURIComponent(encodedConfig || '')}`;
        if (vi && isVietnamese(lang)) {
          native.push({
            id: `subdl-vi-${idPart}`,
            url: sourceUrl,
            lang: 'vie',
            name: `🇻🇳 [Tiếng Việt] ${releaseName}`
          });
        } else if (!vi && isEnglish(lang)) {
          const aiUrl = `${hostUrl}/translate-sub?provider=subdl&sourceUrl=${encodeURIComponent(dlUrl)}&model=${encodeURIComponent(modelToUse)}&config=${encodeURIComponent(encodedConfig || '')}&imdbId=${encodeURIComponent(imdbId)}&type=${type}&season=${season || ''}&episode=${episode || ''}&source=en&target=vi`;
          englishOriginalSubtitles.push({
            id: `subdl-en-${idPart}`,
            url: aiUrl,
            lang: 'eng',
            name: `🇺🇸 [English → Gemini AI Việt] ${releaseName}`
          });
        }
      }
    } catch (err) {
      console.error('[SubDL]', err.message);
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
          `https://v3-cinemeta.strem.io/meta/${type === 'series' ? 'series' : 'movie'}/${encodeURIComponent(imdbId)}.json`,
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
        const releaseName = Array.isArray(sub.releaseInfo)
          ? sub.releaseInfo.join(' ')
          : (sub.releaseInfo || sub.productionType || 'SubSource');
        const downloadUrl =
          `${hostUrl}/subsource-sub/${encodeURIComponent(sub.subtitleId)}` +
          `?config=${encodeURIComponent(encodedConfig || '')}`;
        const subLanguage = sub.language ?? sub.languageCode ?? sub.language_code ?? sub.lang;

        if (isViSelected && isVietnamese(subLanguage)) {
          native.push({
            id: `subsource-vi-${sub.subtitleId}`,
            url: downloadUrl,
            lang: 'vie',
            name: `🇻🇳 [Tiếng Việt] ${releaseName}`
          });
        } else if (!isViSelected && isEnglish(subLanguage)) {
          const aiUrl =
            `${hostUrl}/translate-sub?provider=subsource` +
            `&subtitleId=${encodeURIComponent(sub.subtitleId)}` +
            `&model=${encodeURIComponent(modelToUse)}` +
            `&config=${encodeURIComponent(encodedConfig || '')}` +
            `&imdbId=${encodeURIComponent(imdbId)}` +
            `&type=${encodeURIComponent(type)}` +
            `&season=${season || ''}&episode=${episode || ''}&source=en&target=vi`;
          englishOriginalSubtitles.push({
            id: `subsource-en-${sub.subtitleId}`,
            url: aiUrl,
            lang: 'eng',
            name: `🇺🇸 [English → Gemini AI Việt] ${releaseName}`
          });
        }
      }
    } catch (err) {
      console.error('[SubSource]', err.message);
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

  let subtitles = [...nativeVietSubtitles, ...englishOriginalSubtitles];
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
    res.status(502).send('Không thể tải phụ đề từ SubSource');
  }
});

app.get('/proxy-os', async (req, res) => {
  const fileId = String(req.query.fileId || '');
  const config = parseConfig(req.query.config || '');
  const apiKeyOS = String(config.opensubtitlesKey || '2015').trim();

  if (!fileId) return res.status(400).send('Missing OpenSubtitles file ID');

  try {
    const download = await axios.post(
      'https://api.opensubtitles.com/api/v1/download',
      { file_id: fileId },
      {
        headers: { 'Api-Key': apiKeyOS, ...API_HEADERS, 'Content-Type': 'application/json' },
        timeout: 10000,
        validateStatus: status => status >= 200 && status < 300
      }
    );
    const link = download.data?.link || '';
    if (!link) throw new Error('OpenSubtitles không trả link');

    const subtitleText = await fetchSubtitleText(link, SUBTITLE_BROWSER_HEADERS, 30000, 2);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(subtitleText);
  } catch (err) {
    return res.send('1\n00:00:01,000 --> 00:00:10,000\n[OpenSubtitles] Không thể tải phụ đề gốc');
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
    return res.send('1\n00:00:01,000 --> 00:00:10,000\n[SubDL] Không thể tải phụ đề gốc');
  }
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
      model: requestedModel
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

const translatedSubtitleCache = new Map();
const TRANSLATION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const TRANSLATION_CACHE_MAX = 40;
const translationInFlight = new Map();

function makeTranslationCacheKey({ url, model, imdbId, type, season, episode }) {
  return [url, model || '', imdbId || '', type || '', season || '', episode || ''].join('|');
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

app.get('/translate-sub', async (req, res) => {
  const { url, provider, fileId, sourceUrl, subtitleId, model, config: configQuery, imdbId, type, season, episode, source, target } = req.query;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');

  const startKeepAlive = () => {};
  const stopKeepAlive = () => {};

  if (!url && !provider) return res.send('1\n00:00:01,000 --> 00:00:05,000\n[LỖI]: Thiếu nguồn phụ đề tiếng Anh.');

  if (source && String(source).toLowerCase() !== 'en') {
    return res.send('1\n00:00:01,000 --> 00:00:06,000\n[Gemini AI] Chỉ hỗ trợ dịch từ phụ đề tiếng Anh.');
  }
  if (target && String(target).toLowerCase() !== 'vi') {
    return res.send('1\n00:00:01,000 --> 00:00:06,000\n[Gemini AI] Đích dịch phải là tiếng Việt.');
  }

  let cacheKey = '';
  let ownsTranslationJob = false;
  let releaseJob = null;

  try {
    const config = parseConfig(configQuery);
    const geminiKeys = (config.geminiKeys && config.geminiKeys.length > 0)
      ? config.geminiKeys
      : [process.env.GEMINI_API_KEY].filter(Boolean);

    if (!geminiKeys.length) {
      return res.send('1\n00:00:01,000 --> 00:00:08,000\n[LỖI]: Chưa có Gemini API Key.');
    }

    const selectedModel = model || config.model || 'gemini-3.5-flash-lite';
    const sourceCacheId = url || `${provider || ''}|${fileId || ''}|${sourceUrl || ''}|${subtitleId || ''}`;
    cacheKey = makeTranslationCacheKey({ url: sourceCacheId, model: selectedModel, imdbId, type, season, episode });

    const cachedSrt = getCachedTranslation(cacheKey);
    if (cachedSrt) {
      res.setHeader('Cache-Control', 'public, max-age=21600');
      return res.send(cachedSrt);
    }

    const existingJob = translationInFlight.get(cacheKey);
    if (existingJob) {
      startKeepAlive();
      try {
        const readySrt = await existingJob;
        stopKeepAlive();
        res.setHeader('Cache-Control', 'public, max-age=21600');
        return res.send(readySrt);
      } catch (err) {
        stopKeepAlive();
        return res.send('1\n00:00:01,000 --> 00:00:10,000\n[Gemini AI] Lỗi dịch phụ đề');
      }
    }

    const currentJob = new Promise(resolve => { releaseJob = resolve; });
    translationInFlight.set(cacheKey, currentJob);
    ownsTranslationJob = true;
    startKeepAlive();

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
            headers: { 'Api-Key': apiKeyOS, ...API_HEADERS, 'Content-Type': 'application/json' },
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
          `${SUBSOURCE_API}/subtitles/${encodeURIComponent(subtitleId)}/download`,
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
      throw new Error('Không tải được file phụ đề tiếng Anh: ' + String(err.message || 'upstream error').slice(0, 140));
    }

    let movieContext = 'Phim điện ảnh/truyền hình tổng quát.';
    if (imdbId) {
      try {
        const metaRes = await axios.get(`https://v3-cinemeta.strem.io/meta/${type === 'series' ? 'series' : 'movie'}/${imdbId}.json`, { timeout: 5000 });
        const meta = metaRes.data?.meta;
        if (meta) {
          movieContext = `Tên phim: ${meta.name || ''}\nMô tả: ${meta.description || ''}`;
        }
      } catch (err) {}
    }

    const subtitleSample = buildSubtitleContextSample(originalSrt, 4500);
    const contextGuide = `\n[NGỮ CẢNH NHÂN VẬT & XƯNG HÔ]\nThông tin phim:\n${movieContext}\n\nMẫu thoại:\n${subtitleSample}`;

    const chunks = splitSrtIntoChunks(originalSrt, 12000);
    const translated = [];

    const translateChunk = async (i, workerKey) => {
      const prompt = `Bạn là dịch giả phụ đề phim chuyên nghiệp. Dịch đoạn SRT tiếng Anh sau sang tiếng Việt tự nhiên. ${contextGuide}
Giữ nguyên số thứ tự, định dạng SRT và timestamps. Chỉ trả về SRT đã dịch, không markdown, không giải thích.

SRT CẦN DỊCH:
${chunks[i]}`;

      // Đã sửa workerIndex thành workerKey ở đây:
      const aiRes = await callAI(prompt, workerKeys, selectedModel, workerKey);

      if (!aiRes.result) {
        throw new Error(`Gemini không dịch được đoạn ${i + 1}/${chunks.length}: ${aiRes.error || 'không phản hồi'}`);
      }

      translated.push({ index: i, text: aiRes.result.trim() });
    };

    const workerKeys = geminiKeys.slice(0, 3);
    const worker = async (workerIndex) => {
      for (let i = workerIndex; i < chunks.length; i += workerKeys.length) {
        await translateChunk(i, workerIndex);
      }
    };
    await Promise.all(workerKeys.map((_, index) => worker(index)));

    translated.sort((a, b) => a.index - b.index);
    const finalSrt = cleanAndRebuildSrt(translated.map(t => t.text).join('\n\n'));
    setCachedTranslation(cacheKey, finalSrt);
    releaseJob(finalSrt);
    stopKeepAlive();
    res.setHeader('Cache-Control', 'public, max-age=21600');
    return res.send(finalSrt);

  } catch (err) {
    stopKeepAlive();
    const errorSrt = `1\n00:00:01,000 --> 00:00:10,000\n[Gemini AI] Lỗi: ${String(err.message || err)}`;
    if (typeof releaseJob === 'function') releaseJob(errorSrt);
    return res.send(errorSrt);
  } finally {
    if (ownsTranslationJob && cacheKey) {
      translationInFlight.delete(cacheKey);
    }
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
server.requestTimeout = 0;

