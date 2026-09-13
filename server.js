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
  'User-Agent': 'AISubtitlePro v3.9.8',
  Accept: 'application/json'
};

function parseConfig(encodedConfig) {
  if (!encodedConfig || encodedConfig === 'undefined' || encodedConfig === 'null') return {};
  try {
    return JSON.parse(Buffer.from(encodedConfig, 'base64').toString('utf8'));
  } catch {
    try {
      return JSON.parse(decodeURIComponent(encodedConfig));
    } catch {
      return {};
    }
  }
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
<h2>Gemini AI Subtitle Pro</h2>
<form id="configForm">
<label>Mô hình AI dịch ưu tiên:</label>
<select id="modelSelect">
<option value="gemini-3.6-flash" ${savedConfig.model === 'gemini-3.6-flash' || !savedConfig.model ? 'selected' : ''}>Gemini 3.6 Flash (Khuyên dùng)</option>
<option value="gemini-3.5-flash-lite" ${savedConfig.model === 'gemini-3.5-flash-lite' ? 'selected' : ''}>Gemini 3.5 Flash-Lite</option>
<option value="gemini-2.5-flash" ${savedConfig.model === 'gemini-2.5-flash' ? 'selected' : ''}>Gemini 2.5 Flash (Dự phòng)</option>
</select>
<div class="section-title">🔑 Google Gemini API Keys (Hỗ trợ xoay vòng nhiều Key)</div>
<label>Gemini API Key 1</label><input id="geminiKey1" value="${escapeHtml(geminiKeys[0])}" placeholder="AIzaSy...">
<label>Gemini API Key 2</label><input id="geminiKey2" value="${escapeHtml(geminiKeys[1])}">
<label>Gemini API Key 3</label><input id="geminiKey3" value="${escapeHtml(geminiKeys[2])}">
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
  version: '3.9.8',
  name: 'Gemini AI Subtitle Pro',
  description: 'Tự động tìm sub Việt chuẩn từ OpenSubtitles, SubDL, Subsource hoặc dịch AI cực mượt.',
  types: ['movie', 'series'],
  catalogs: [],
  resources: ['subtitles'],
  idPrefixes: ['tt'],
  configurable: true,
  behaviorHints: { configurable: true }
};

app.get('/manifest.json', (req, res) => res.json(defaultManifest));
app.get('/:config/manifest.json', (req, res) => res.json(defaultManifest));

function makeHostUrl(req) {
  const forwardedProto = req.get('x-forwarded-proto');
  const protocol = forwardedProto ? forwardedProto.split(',')[0] : req.protocol;
  return `${protocol}://${req.get('host')}`;
}

function languageCode(value) {
  if (value && typeof value === 'object') {
    value = value.code || value.iso639_2 || value.iso639_1 || value.name || value.language || '';
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

async function fetchSubtitleText(url, headers = {}, timeout = 20000) {
  const response = await axios.get(url, { headers, responseType: 'arraybuffer', timeout, maxRedirects: 5 });
  return extractSubtitleText(Buffer.from(response.data));
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

function splitSrtIntoChunks(srt, maxChars = 7500) {
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

async function callAI(prompt, geminiKeys, model) {
  let lastError = 'Lỗi không xác định';

  const modelCandidates = [...new Set([
    model || 'gemini-3.8-flash',
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash'
  ].filter(Boolean))];

  for (const rawKey of geminiKeys || []) {
    const key = String(rawKey || '').trim();
    if (!key) continue;

    let authFailed = false;

    for (const modelName of modelCandidates) {
      try {
        const url =
          `https://generativelanguage.googleapis.com/v1beta/models/` +
          `${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(key)}`;

        const generationConfig =
          /^gemini-3\./i.test(modelName)
            ? { thinkingConfig: { thinkingLevel: 'low' } }
            : { temperature: 0.2 };

        const response = await axios.post(
          url,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig
          },
          {
            timeout: 60000,
            headers: { 'Content-Type': 'application/json' }
          }
        );

        const result = response.data?.candidates?.[0]?.content?.parts
          ?.map(p => p.text || '')
          .join('')
          .trim();

        if (result) {
          console.log(`[Gemini OK] model=${modelName}`);
          return { result, error: null, model: modelName };
        }

        lastError = `Gemini ${modelName}: không có nội dung trả về.`;
      } catch (err) {
        const status = err.response?.status;
        const message =
          err.response?.data?.error?.message ||
          err.message ||
          'Gemini request failed';

        lastError = message;

        const lower = String(message).toLowerCase();
        const isAuthError =
          status === 401 ||
          status === 403 ||
          lower.includes('invalid authentication credentials') ||
          lower.includes('api key not valid') ||
          lower.includes('invalid api key') ||
          lower.includes('authentication') ||
          lower.includes('unauthorized');

        console.error(`[Gemini ${modelName}] ${message}`);

        if (isAuthError) {
          authFailed = true;
          console.error('[Gemini] Key lỗi authentication -> chuyển key tiếp theo.');
          break;
        }
      }
    }

    if (authFailed) continue;
  }

  return { result: '', error: lastError };
}

const translatedSubtitleCache = new Map();
const TRANSLATION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const TRANSLATION_CACHE_MAX = 40;
const translationInFlight = new Map();

async function fetchLegacySubtitleUrl(url, config) {
  const parsed = new URL(url);

  const subsourceMatch = parsed.pathname.match(/^\/subsource-sub\/([^/]+)$/);
  if (subsourceMatch) {
    const subtitleId = decodeURIComponent(subsourceMatch[1]);
    const apiKey = parsed.searchParams.get('key') || config.subsourceKey || '';
    if (!apiKey) throw new Error('Thiếu SubSource API Key.');
    return fetchSubsourceSubtitleText(subtitleId, apiKey);
  }

  if (parsed.pathname === '/proxy-sub') {
    const sourceUrl = parsed.searchParams.get('url');
    if (!sourceUrl) throw new Error('Legacy proxy-sub thiếu URL.');
    return fetchSubtitleText(sourceUrl, SUBTITLE_BROWSER_HEADERS, 30000);
  }

  if (parsed.pathname === '/proxy-os') {
    const fileId = parsed.searchParams.get('fileId') || parsed.searchParams.get('file_id');
    const oldConfig = parseConfig(parsed.searchParams.get('config')) || {};
    const apiKey = oldConfig.opensubtitlesKey || config.opensubtitlesKey || '';

    if (!fileId) {
      const directUrl = parsed.searchParams.get('url');
      if (directUrl) return fetchSubtitleText(directUrl, SUBTITLE_BROWSER_HEADERS, 30000);
      throw new Error('Legacy OpenSubtitles URL thiếu fileId.');
    }
    if (!apiKey) throw new Error('Thiếu OpenSubtitles API Key.');

    const download = await axios.post(
      'https://api.opensubtitles.com/api/v1/download',
      { file_id: Number(fileId) },
      {
        headers: {
          'Api-Key': apiKey,
          ...API_HEADERS,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    if (!download.data?.link) {
      throw new Error('OpenSubtitles không trả về link download.');
    }

    return fetchSubtitleText(download.data.link, SUBTITLE_BROWSER_HEADERS, 30000);
  }

  if (parsed.pathname === '/proxy-subdl') {
    const sourceUrl = parsed.searchParams.get('url');
    const oldConfig = parseConfig(parsed.searchParams.get('config')) || {};
    const apiKey = oldConfig.subdlKey || config.subdlKey || '';

    if (!sourceUrl) throw new Error('Legacy proxy-subdl thiếu URL.');
    if (!apiKey) throw new Error('Thiếu SubDL API Key.');

    return fetchSubtitleText(
      sourceUrl,
      {
        ...SUBTITLE_BROWSER_HEADERS,
        'X-API-Key': apiKey,
        'Authorization': `Bearer ${apiKey}`
      },
      30000
    );
  }

  return fetchSubtitleText(url, SUBTITLE_BROWSER_HEADERS, 30000);
}

async function handleSubtitles(req, res, encodedConfig) {
  const config = parseConfig(encodedConfig);
  const { type, id } = req.params;
  const parts = id.split(':');
  const imdbId = parts[0];
  const season = parts[1] ? parseInt(parts[1], 10) : null;
  const episode = parts[2] ? parseInt(parts[2], 10) : null;
  const hostUrl = makeHostUrl(req);
  const modelToUse = config.model || 'gemini-3.6-flash';

  let nativeVietSubtitles = [];
  let englishSubtitlesForAI = [];

  // 1. Quét OpenSubtitles
  try {
    const osParams = { languages: 'vi,en,vie' };
    if (imdbId.startsWith('tt')) osParams.imdb_id = imdbId.replace(/^tt/, '');
    if (type === 'series' && season !== null && episode !== null) {
      osParams.season_number = season;
      osParams.episode_number = episode;
    }

    const apiKeyOS = config.opensubtitlesKey || '2015';
    const osRes = await axios.get('https://api.opensubtitles.com/api/v1/subtitles', {
      params: osParams,
      headers: { 'Api-Key': apiKeyOS, ...API_HEADERS },
      timeout: 7000
    });

    for (const item of (osRes.data?.data || []).slice(0, 6)) {
      const file = item.attributes?.files?.[0];
      const lang = item.attributes?.language || '';
      if (!file?.file_id) continue;

      const download = await axios.post('https://api.opensubtitles.com/api/v1/download', { file_id: file.file_id }, {
        headers: { 'Api-Key': apiKeyOS, ...API_HEADERS, 'Content-Type': 'application/json' },
        timeout: 7000
      }).catch(() => null);

      if (!download?.data?.link) continue;
      const releaseName = item.attributes?.release || file.file_name || 'OpenSubtitles Sub';

      if (isVietnamese(lang)) {
        nativeVietSubtitles.push({
          id: `os-vi-${item.id}`,
          url: `${hostUrl}/proxy-sub?url=${encodeURIComponent(download.data.link)}`,
          lang: 'vie',
          name: `🇻🇳 [Tiếng Việt] ${releaseName}`
        });
      } else if (isEnglish(lang)) {
        englishSubtitlesForAI.push({
          id: `ai-os-${item.id}`,
          url: `${hostUrl}/translate-sub?url=${encodeURIComponent(download.data.link)}&model=${encodeURIComponent(modelToUse)}&config=${encodeURIComponent(encodedConfig || '')}&imdbId=${encodeURIComponent(imdbId)}&type=${type}&season=${season || ''}&episode=${episode || ''}`,
          lang: 'eng',
          name: `[GEMINI AI] Tiếng Anh\n${releaseName}`
        });
      }
    }
  } catch (err) {
    console.error('[OpenSubtitles]', err.response?.status || '', err.response?.data || err.message);
  }

  // 2. Quét SubDL
  try {
    if (imdbId) {
      const subdlRes = await axios.get('https://api.subdl.com/api/v1/subtitles', {
        params: {
          api_key: config.subdlKey || '',
          imdb_id: imdbId,
          type: type === 'series' ? 'tv' : 'movie',
          languages: 'VI,EN',
          season: season,
          episode: episode,
          unpack: 1
        },
        timeout: 7000
      });

      for (const sub of (subdlRes.data?.subtitles || []).slice(0, 6)) {
        const lang = sub.language || '';
        if (!sub.url) continue;
        const dlUrl = sub.url.startsWith('http') ? sub.url : `https://dl.subdl.com${sub.url}`;
        const releaseName = subtitleName(sub, 'SubDL Sub');

        if (isVietnamese(lang)) {
          nativeVietSubtitles.push({
            id: `subdl-vi-${sub.n_id || sub.id}`,
            url: `${hostUrl}/proxy-sub?url=${encodeURIComponent(dlUrl)}`,
            lang: 'vie',
            name: `🇻🇳 [Tiếng Việt] ${releaseName}`
          });
        } else if (isEnglish(lang)) {
          englishSubtitlesForAI.push({
            id: `ai-subdl-${sub.n_id || sub.id}`,
            url: `${hostUrl}/translate-sub?url=${encodeURIComponent(dlUrl)}&model=${encodeURIComponent(modelToUse)}&config=${encodeURIComponent(encodedConfig || '')}&imdbId=${encodeURIComponent(imdbId)}&type=${type}&season=${season || ''}&episode=${episode || ''}`,
            lang: 'eng',
            name: `[GEMINI AI] Tiếng Anh\n${releaseName}`
          });
        }
      }
    }
  } catch (err) {
    console.error('[SubDL]', err.response?.status || '', err.response?.data || err.message);
  }

  // 3. Quét SubSource API
  try {
    if (imdbId && config.subsourceKey) {
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

      if (movieTitle) {
        const searchRes = await axios.get(`${SUBSOURCE_API}/movies/search`, {
          params: {
            searchType: 'text',
            q: movieTitle,
            ...(type === 'series' && season !== null ? { season } : {})
          },
          headers: getSubsourceHeaders(config.subsourceKey),
          timeout: 10000
        });

        const searchResults = Array.isArray(searchRes.data?.data)
          ? searchRes.data.data
          : [];

        const matchedMovie = searchResults.find(movie =>
          String(movie.imdbId || '').replace(/^tt/i, '') ===
          String(imdbId).replace(/^tt/i, '') &&
          (
            type !== 'series' ||
            season === null ||
            movie.season == null ||
            Number(movie.season) === season
          )
        );

        if (matchedMovie?.movieId) {
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

          let vietnameseSubs = await getSubsourceSubs('vi').catch(() => []);
          if (!vietnameseSubs.length) {
            vietnameseSubs = await getSubsourceSubs('vie').catch(() => []);
          }
          vietnameseSubs = vietnameseSubs.filter(sub =>
            isVietnamese(sub.language ?? sub.languageCode ?? sub.language_code ?? sub.lang)
          );

          let englishSubs = [];
          if (!vietnameseSubs.length) {
            englishSubs = (await getSubsourceSubs('english').catch(() => []))
              .filter(sub => isEnglish(sub.language ?? sub.languageCode ?? sub.language_code ?? sub.lang));
          }

          const selectedSubs = (vietnameseSubs.length ? vietnameseSubs : englishSubs).slice(0, 6);

          for (const sub of selectedSubs) {
            if (!sub.subtitleId) continue;

            const releaseName = Array.isArray(sub.releaseInfo)
              ? sub.releaseInfo.join(' ')
              : (sub.releaseInfo || sub.productionType || 'SubSource');

            const downloadUrl =
              `${hostUrl}/subsource-sub/${encodeURIComponent(sub.subtitleId)}` +
              `?key=${encodeURIComponent(config.subsourceKey)}`;

            const subLanguage = sub.language ?? sub.languageCode ?? sub.language_code ?? sub.lang;
            if (isVietnamese(subLanguage)) {
              nativeVietSubtitles.push({
                id: `subsource-vi-${sub.subtitleId}`,
                url: downloadUrl,
                lang: 'vie',
                name: `🇻🇳 [Tiếng Việt] ${releaseName}`
              });
            } else if (isEnglish(subLanguage)) {
              englishSubtitlesForAI.push({
                id: `ai-subsource-${sub.subtitleId}`,
                url:
                  `${hostUrl}/translate-sub?url=${encodeURIComponent(downloadUrl)}` +
                  `&model=${encodeURIComponent(modelToUse)}` +
                  `&config=${encodeURIComponent(encodedConfig || '')}` +
                  `&imdbId=${encodeURIComponent(imdbId)}` +
                  `&type=${encodeURIComponent(type)}` +
                  `&season=${season || ''}&episode=${episode || ''}`,
                lang: 'eng',
                name: `[GEMINI AI] Tiếng Anh\n${releaseName}`
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[SubSource]', err.response?.status || '', err.response?.data || err.message);
  }

  if (nativeVietSubtitles.length > 0) englishSubtitlesForAI = [];

  let subtitles = [...nativeVietSubtitles, ...englishSubtitlesForAI];

  if (!subtitles.length) {
    subtitles.push({
      id: 'ai-notice',
      url: 'https://raw.githubusercontent.com/SubtitleEdit/subtitleedit/master/CHANGELOG.txt',
      lang: 'vie',
      name: '⚠️ [Gemini AI] Không tìm thấy phụ đề từ OpenSubtitles, SubDL và Subsource.'
    });
  }

  res.json({ subtitles });
}

app.get('/subsource-sub/:subtitleId', async (req, res) => {
  const { subtitleId } = req.params;
  const apiKey = String(req.query.key || '');

  if (!subtitleId) return res.status(400).send('Missing subtitle ID');
  if (!apiKey) return res.status(401).send('Missing SubSource API Key');

  try {
    const text = await fetchSubsourceSubtitleText(subtitleId, apiKey);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(text);
  } catch (err) {
    console.error('[SubSource download]', err.response?.status || '', err.message);
    res.status(502).send('Không thể tải phụ đề từ SubSource.');
  }
});

app.get('/proxy-sub', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('Missing URL');
  try {
    const text = await fetchSubtitleText(url);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(text);
  } catch (err) {
    res.status(502).send('Không thể tải phụ đề gốc.');
  }
});

app.get('/translate-sub', async (req, res) => {
  const {
    url,
    model,
    config: configQuery,
    imdbId,
    type,
    season,
    episode,
    provider
  } = req.query;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  // Fix 502/crash: these must live outside try.
  let releaseJob = null;
  let rejectJob = null;

  try {
    const config = parseConfig(configQuery);

    const geminiKeys = (
      Array.isArray(config.geminiKeys) && config.geminiKeys.length
        ? config.geminiKeys
        : [process.env.GEMINI_API_KEY].filter(Boolean)
    ).map(k => String(k).trim()).filter(Boolean);

    if (!geminiKeys.length) {
      return res.status(200).send(
        '1\n00:00:01,000 --> 00:00:08,000\n[LỖI]: Chưa có Gemini API Key.'
      );
    }

    if (!url) {
      return res.status(200).send(
        '1\n00:00:01,000 --> 00:00:08,000\n[LỖI]: Thiếu đường dẫn file phụ đề.'
      );
    }

    const selectedModel = model || config.model || 'gemini-3.8-flash';

    console.log('[translate-sub start]', JSON.stringify({
      provider: provider || 'legacy',
      model: selectedModel,
      imdbId: imdbId || '',
      type: type || '',
      season: season || '',
      episode: episode || ''
    }));

    // Translation cache.
    const cacheKey = [
      String(url),
      selectedModel,
      imdbId || '',
      type || '',
      season || '',
      episode || ''
    ].join('|');

    const cached = translatedSubtitleCache?.get?.(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      console.log('[translate-sub cache hit]');
      return res.status(200).send(cached.text);
    }

    // Prevent duplicate translations for the same English subtitle.
    if (typeof translationInFlight !== 'undefined' &&
        translationInFlight.has(cacheKey)) {
      try {
        const existing = await translationInFlight.get(cacheKey);
        return res.status(200).send(existing);
      } catch (err) {
        return res.status(200).send(
          `1\n00:00:01,000 --> 00:00:08,000\n[LỖI GEMINI AI]: ${String(err.message || err).replace(/\r?\n/g, ' ')}`
        );
      }
    }

    const currentJob = new Promise((resolve, reject) => {
      releaseJob = resolve;
      rejectJob = reject;
    });

    if (typeof translationInFlight !== 'undefined') {
      translationInFlight.set(cacheKey, currentJob);
    }

    let originalSrt;

    try {
      if (provider) {
        if (provider === 'subsource') {
          const parsed = new URL(String(url));
          const subtitleId = parsed.pathname.split('/').pop();
          const apiKey = config.subsourceKey || parsed.searchParams.get('key') || '';

          if (!subtitleId || !apiKey) {
            throw new Error('Thiếu SubSource subtitleId hoặc API key.');
          }

          originalSrt = await fetchSubsourceSubtitleText(
            decodeURIComponent(subtitleId),
            apiKey
          );
        } else if (provider === 'subdl') {
          if (!config.subdlKey) throw new Error('Thiếu SubDL API Key.');

          originalSrt = await fetchSubtitleText(
            String(url),
            {
              ...SUBTITLE_BROWSER_HEADERS,
              'X-API-Key': config.subdlKey,
              'Authorization': `Bearer ${config.subdlKey}`
            },
            30000
          );
        } else if (provider === 'os') {
          originalSrt = await fetchSubtitleText(
            String(url),
            SUBTITLE_BROWSER_HEADERS,
            30000
          );
        } else {
          originalSrt = await fetchSubtitleText(
            String(url),
            SUBTITLE_BROWSER_HEADERS,
            30000
          );
        }
      } else {
        // Old addon URLs are resolved locally instead of self-fetching a proxy.
        originalSrt = await fetchLegacySubtitleUrl(String(url), config);
      }
    } catch (err) {
      console.error(
        '[translate-sub source]',
        err.response?.status || '',
        err.code || '',
        err.message
      );
      throw new Error(`Không tải được file phụ đề tiếng Anh: ${err.message}`);
    }

    if (!originalSrt || !String(originalSrt).trim()) {
      throw new Error('File phụ đề tiếng Anh rỗng.');
    }

    let movieContext = 'Phim điện ảnh/truyền hình tổng quát.';

    if (imdbId) {
      try {
        const metaRes = await axios.get(
          `https://v3-cinemeta.strem.io/meta/${type === 'series' ? 'series' : 'movie'}/${encodeURIComponent(imdbId)}.json`,
          { timeout: 5000 }
        );

        const meta = metaRes.data?.meta;

        if (meta) {
          movieContext =
            `Tên phim: ${meta.name || ''}\n` +
            `Thể loại: ${meta.genres?.join(', ') || ''}\n` +
            `Mô tả: ${meta.description || ''}`;

          if (
            type === 'series' &&
            season &&
            episode &&
            Array.isArray(meta.videos)
          ) {
            const ep = meta.videos.find(
              v =>
                v.season === parseInt(season, 10) &&
                v.episode === parseInt(episode, 10)
            );

            if (ep) {
              movieContext +=
                `\nTập ${season}x${episode}: ${ep.name || ''}` +
                `\nTóm tắt tập: ${ep.overview || ''}`;
            }
          }
        }
      } catch (err) {
        console.error('[Cinemeta]', err.message);
      }
    }

    // One short context call; if it fails, translation can still continue.
    let pronounGuide = '';

    try {
      const guideRes = await callAI(
        `Dựa vào thông tin phim sau, đề xuất ngắn gọn đại từ nhân xưng tiếng Việt phù hợp nhất.
Chỉ trả lời hướng dẫn xưng hô ngắn gọn.

${movieContext}`,
        geminiKeys,
        selectedModel
      );

      if (guideRes.result) {
        pronounGuide =
          `\n[Quy tắc xưng hô tham khảo]: ${guideRes.result}`;
      }
    } catch (err) {
      console.error('[Gemini guide]', err.message);
    }

    const chunks = splitSrtIntoChunks(
      String(originalSrt),
      12000
    );

    console.log(
      `[Gemini translation] ${chunks.length} chunk(s), ${geminiKeys.length} key(s)`
    );

    const translated = [];

    // Up to three workers, one per configured key.
    const workerCount = Math.min(
      Math.max(geminiKeys.length, 1),
      3,
      chunks.length
    );

    let nextIndex = 0;

    async function worker(workerId) {
      while (true) {
        const index = nextIndex++;

        if (index >= chunks.length) return;

        const prompt =
          `Bạn là dịch giả phụ đề phim chuyên nghiệp.
Dịch đoạn SRT tiếng Anh sau sang tiếng Việt tự nhiên, đúng ngữ cảnh phim.
${pronounGuide}

BẮT BUỘC:
- Giữ nguyên tuyệt đối số thứ tự.
- Giữ nguyên tuyệt đối timestamps.
- Không thêm giải thích.
- Không thêm markdown.
- Chỉ trả về SRT đã dịch.
- Không dịch timestamps.

${chunks[index]}`;

        const key = geminiKeys[
          workerId % geminiKeys.length
        ];

        let result = '';

        // Try the worker's assigned key first.
        try {
          const aiRes = await callAI(
            prompt,
            [key],
            selectedModel
          );

          result = aiRes.result || '';
        } catch (err) {
          console.error(
            `[Gemini worker ${workerId} chunk ${index + 1}]`,
            err.message
          );
        }

        // If assigned key fails, rotate through the remaining keys.
        if (!result && geminiKeys.length > 1) {
          const fallbackKeys = geminiKeys.filter(
            k => k !== key
          );

          try {
            const aiRes = await callAI(
              prompt,
              fallbackKeys,
              selectedModel
            );

            result = aiRes.result || '';
          } catch (err) {
            console.error(
              `[Gemini fallback chunk ${index + 1}]`,
              err.message
            );
          }
        }

        translated.push({
          index,
          text: result || chunks[index]
        });

        console.log(
          `[Gemini translation chunk ${index + 1}/${chunks.length}] ` +
          `${result ? 'OK' : 'FALLBACK ORIGINAL'}`
        );
      }
    }

    await Promise.all(
      Array.from(
        { length: workerCount },
        (_, i) => worker(i)
      )
    );

    translated.sort((a, b) => a.index - b.index);

    const finalSrt = cleanAndRebuildSrt(
      translated.map(x => x.text).join('\n\n')
    );

    if (
      typeof translatedSubtitleCache !== 'undefined' &&
      translatedSubtitleCache instanceof Map
    ) {
      translatedSubtitleCache.set(cacheKey, {
        text: finalSrt,
        expiresAt: Date.now() + TRANSLATION_CACHE_TTL_MS
      });

      while (
        translatedSubtitleCache.size >
        TRANSLATION_CACHE_MAX
      ) {
        const firstKey =
          translatedSubtitleCache.keys().next().value;

        if (firstKey === undefined) break;

        translatedSubtitleCache.delete(firstKey);
      }
    }

    if (typeof releaseJob === 'function') {
      releaseJob(finalSrt);
    }

    return res.status(200).send(finalSrt);

  } catch (err) {
    console.error(
      '[translate-sub ERROR]',
      err.stack || err.message || err
    );

    if (typeof rejectJob === 'function') {
      try {
        rejectJob(err);
      } catch {}
    }

    if (!res.headersSent) {
      return res.status(200).send(
        `1
00:00:01,000 --> 00:00:08,000
[LỖI GEMINI AI]: ${String(err.message || err).replace(/\r?\n/g, ' ')}`
      );
    }

  } finally {
    // Always clean the in-flight entry; never let cleanup crash the server.
    try {
      if (
        typeof translationInFlight !== 'undefined' &&
        translationInFlight instanceof Map &&
        url
      ) {
        const key = [
          String(url),
          model || 'gemini-3.8-flash',
          imdbId || '',
          type || '',
          season || '',
          episode || ''
        ].join('|');

        if (translationInFlight.has(key)) {
          translationInFlight.delete(key);
        }
      }
    } catch (cleanupErr) {
      console.error('[translate-sub cleanup]', cleanupErr.message);
    }
  }
});

app.get('/subtitles/:type/:id.json', (req, res) => handleSubtitles(req, res, null));
app.get('/subtitles/:type/:id/:extra.json', (req, res) => handleSubtitles(req, res, null));
app.get('/:config/subtitles/:type/:id.json', (req, res) => handleSubtitles(req, res, req.params.config));
app.get('/:config/subtitles/:type/:id/:extra.json', (req, res) => handleSubtitles(req, res, req.params.config));

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gemini AI Subtitle Pro v3.9.8 đang chạy tại port ${PORT}`);
});
server.keepAliveTimeout = 120000;
server.headersTimeout = 125000;
server.requestTimeout = 0;

