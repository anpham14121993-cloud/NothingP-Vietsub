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
  'User-Agent': 'AISubtitlePro v2.1.0',
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
  version: '2.1.0',
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
  for (const key of geminiKeys) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const response = await axios.post(url, {
        contents: [{ parts: [{ text: prompt }] }]
      }, { timeout: 60000 });

      const result = response.data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('');
      if (result) return { result, error: null };
    } catch (err) {
      lastError = err.response?.data?.error?.message || err.message;
    }
  }
  return { result: '', error: lastError };
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
  const { url, model, config: configQuery, imdbId, type, season, episode } = req.query;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');

  if (!url) return res.send('1\n00:00:01,000 --> 00:00:05,000\n[LỖI]: Thiếu đường dẫn file phụ đề.');

  try {
    const config = parseConfig(configQuery);
    const geminiKeys = (config.geminiKeys && config.geminiKeys.length > 0)
      ? config.geminiKeys
      : [process.env.GEMINI_API_KEY].filter(Boolean);

    if (!geminiKeys.length) {
      return res.send('1\n00:00:01,000 --> 00:00:08,000\n[LỖI]: Chưa có Gemini API Key.');
    }

    const selectedModel = model || config.model || 'gemini-3.6-flash';

    let originalSrt;
    try {
      const subsourceMatch = String(url).match(
        /^https?:\/\/[^/]+\/subsource-sub\/([^?]+)\?key=([^&]+)/
      );

      if (subsourceMatch) {
        originalSrt = await fetchSubsourceSubtitleText(
          decodeURIComponent(subsourceMatch[1]),
          decodeURIComponent(subsourceMatch[2])
        );
      } else {
        originalSrt = await fetchSubtitleText(url);
      }
    } catch (err) {
      return res.send('1\n00:00:01,000 --> 00:00:08,000\n[LỖI]: Không tải được file phụ đề tiếng Anh.');
    }

    let movieContext = 'Phim điện ảnh/truyền hình tổng quát.';
    if (imdbId) {
      try {
        const metaRes = await axios.get(`https://v3-cinemeta.strem.io/meta/${type === 'series' ? 'series' : 'movie'}/${imdbId}.json`, { timeout: 4000 });
        const meta = metaRes.data?.meta;
        if (meta) {
          movieContext = `Tên phim: ${meta.name || ''}\nThể loại: ${meta.genres?.join(', ') || ''}\nMô tả: ${meta.description || ''}`;
          if (type === 'series' && season && episode && Array.isArray(meta.videos)) {
            const ep = meta.videos.find(v => v.season === parseInt(season, 10) && v.episode === parseInt(episode, 10));
            if (ep) movieContext += `\nTập ${season}x${episode}: ${ep.name || ''}\nTóm tắt tập: ${ep.overview || ''}`;
          }
        }
      } catch {}
    }

    const guideRes = await callAI(`Dựa vào thông tin phim sau, đề xuất ngắn gọn đại từ nhân xưng tiếng Việt phù hợp nhất:\n${movieContext}`, geminiKeys, selectedModel);
    const pronounGuide = guideRes.result ? `\n[Quy tắc xưng hô tham khảo]: ${guideRes.result}` : '';

    const chunks = splitSrtIntoChunks(originalSrt, 7500);
    const translated = [];

    for (let i = 0; i < chunks.length; i++) {
      const prompt = `Bạn là dịch giả phụ đề chuyên nghiệp. Dịch đoạn mã SRT sau sang tiếng Việt điện ảnh, tự nhiên.${pronounGuide}
BẮT BUỘC: Giữ nguyên tuyệt đối số thứ tự phụ đề, thời gian (timestamps) và định dạng. Không giải thích gì thêm, chỉ trả về nội dung SRT đã dịch.

${chunks[i]}`;

      const aiRes = await callAI(prompt, geminiKeys, selectedModel);
      if (!aiRes.result) {
        translated.push({ index: i, text: chunks[i] });
      } else {
        translated.push({ index: i, text: aiRes.result.trim() });
      }

      if (i < chunks.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    translated.sort((a, b) => a.index - b.index);
    const finalSrt = cleanAndRebuildSrt(translated.map(t => t.text).join('\n\n'));
    return res.send(finalSrt);

  } catch (err) {
    return res.send('1\n00:00:01,000 --> 00:00:08,000\n[LỖI HỆ THỐNG]: ' + err.message);
  }
});

app.get('/subtitles/:type/:id.json', (req, res) => handleSubtitles(req, res, null));
app.get('/subtitles/:type/:id/:extra.json', (req, res) => handleSubtitles(req, res, null));
app.get('/:config/subtitles/:type/:id.json', (req, res) => handleSubtitles(req, res, req.params.config));
app.get('/:config/subtitles/:type/:id/:extra.json', (req, res) => handleSubtitles(req, res, req.params.config));

app.listen(PORT, () => {
  console.log(`Gemini AI Subtitle Pro đang chạy tại port ${PORT}`);
});
