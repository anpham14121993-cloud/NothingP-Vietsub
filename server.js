const express = require('express');
const axios = require('axios');
const cors = require('cors');
const AdmZip = require('adm-zip');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const API_HEADERS = {
  'User-Agent': 'AISubtitlePro v1.5.9',
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
<title>Cấu hình AI Subtitle Pro</title>
<style>
body{background:#121212;color:#fff;font-family:Arial,sans-serif;padding:20px;display:flex;justify-content:center}
.container{width:100%;max-width:520px;background:#1e1e1e;padding:20px;border-radius:8px}
h2{text-align:center;color:#ff5252}
label{display:block;margin:12px 0 5px;font-size:13px;color:#ccc}
input,select{width:100%;padding:10px;background:#2a2a2a;border:1px solid #444;color:#fff;border-radius:4px;box-sizing:border-box}
.section-title{color:#4fc3f7;margin-top:18px;font-size:14px;font-weight:bold;border-bottom:1px solid #333;padding-bottom:4px}
button{width:100%;padding:12px;border:0;border-radius:4px;color:#fff;font-weight:bold;margin-top:12px;cursor:pointer}
#installBtn{background:#e50914}#copyBtn{background:#2196F3}
</style>
</head>
<body>
<div class="container">
<h2>Cấu hình AI Subtitle Pro</h2>
<form id="configForm">
<label>Mô hình AI dịch ưu tiên:</label>
<select id="modelSelect">
<optgroup label="Google Gemini">
<option value="gemini-3.8-flash" ${savedConfig.model === 'gemini-3.8-flash' || !savedConfig.model ? 'selected' : ''}>Gemini 3.8 Flash</option>
<option value="gemini-3.5-flash" ${savedConfig.model === 'gemini-3.5-flash' ? 'selected' : ''}>Gemini 3.5 Flash</option>
<option value="gemini-3.1-flash-lite" ${savedConfig.model === 'gemini-3.1-flash-lite' ? 'selected' : ''}>Gemini 3.1 Flash-Lite</option>
</optgroup>
<optgroup label="OpenAI">
<option value="gpt-4o-mini" ${savedConfig.model === 'gpt-4o-mini' ? 'selected' : ''}>GPT-4o-mini</option>
<option value="gpt-4o" ${savedConfig.model === 'gpt-4o' ? 'selected' : ''}>GPT-4o</option>
</optgroup>
</select>
<div class="section-title">🔑 API Keys AI</div>
<label>Gemini API Key 1</label><input id="geminiKey1" value="${escapeHtml(geminiKeys[0])}">
<label>Gemini API Key 2</label><input id="geminiKey2" value="${escapeHtml(geminiKeys[1])}">
<label>Gemini API Key 3</label><input id="geminiKey3" value="${escapeHtml(geminiKeys[2])}">
<label>OpenAI API Key</label><input id="openaiKey" value="${escapeHtml(savedConfig.openaiKey)}">
<div class="section-title">📥 Nguồn phụ đề</div>
<label>OpenSubtitles API Key</label><input id="opensubtitlesKey" value="${escapeHtml(savedConfig.opensubtitlesKey)}">
<label>SubDL API Key</label><input id="subdlKey" value="${escapeHtml(savedConfig.subdlKey)}">
<label>Subsource API Key</label><input id="subsourceKey" value="${escapeHtml(savedConfig.subsourceKey)}">
<button type="button" id="installBtn">Cài đặt trực tiếp vào Nuvio</button>
<label>Link Addon</label><input id="addonUrlOutput" readonly>
<button type="button" id="copyBtn">📋 Sao chép Link Addon</button>
</form>
</div>
<script>
function getAddonUrl(){
  const config={
    model:document.getElementById('modelSelect').value,
    geminiKeys:['geminiKey1','geminiKey2','geminiKey3'].map(id=>document.getElementById(id).value.trim()).filter(Boolean),
    openaiKey:document.getElementById('openaiKey').value.trim(),
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
  catch{alert('Hãy sao chép link trong ô bên trên.')}
};
</script>
</body>
</html>`);
}

const defaultManifest = {
  id: 'org.ai.subtitle.pro',
  version: '1.5.9',
  name: 'AI Subtitle Pro',
  description: 'Addon phụ đề tự động tiếng Việt thông minh',
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
  return String(value || '').trim().toLowerCase();
}

function isVietnamese(value) {
  return ['vi', 'vie', 'vietnamese', 'viet'].includes(languageCode(value));
}

function isEnglish(value) {
  return ['en', 'eng', 'english'].includes(languageCode(value));
}

function subtitleName(sub, fallback) {
  return sub?.releaseName || sub?.release_name ||
    sub?.fileName || sub?.file_name ||
    sub?.name || fallback;
}

function getProviderHeaders(provider, key) {
  const headers = {
    'User-Agent': 'AISubtitlePro v1.5.9',
    Accept: '*/*'
  };
  if (provider === 'subsource' && key) headers['X-API-Key'] = key;
  if (provider === 'opensubtitles' && key) headers['Api-Key'] = key;
  return headers;
}

function extractSubtitleText(buffer) {
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || '');
  const isZip = data.length >= 4 &&
    data[0] === 0x50 && data[1] === 0x4b;

  if (!isZip) {
    return data.toString('utf8').replace(/^\uFEFF/, '');
  }

  const entries = new AdmZip(data).getEntries().filter(entry =>
    !entry.isDirectory &&
    /\.(srt|vtt|ass|ssa|sub)$/i.test(entry.entryName)
  );

  const selected =
    entries.find(entry => /\.srt$/i.test(entry.entryName)) ||
    entries.find(entry => /\.vtt$/i.test(entry.entryName)) ||
    entries.find(entry => /\.ass$/i.test(entry.entryName)) ||
    entries.find(entry => /\.ssa$/i.test(entry.entryName)) ||
    entries.find(entry => /\.sub$/i.test(entry.entryName));

  if (!selected) throw new Error('ZIP không chứa file phụ đề hỗ trợ');

  return selected.getData().toString('utf8').replace(/^\uFEFF/, '');
}

async function fetchSubtitleText(url, headers = {}, timeout = 20000) {
  const response = await axios.get(url, {
    headers,
    responseType: 'arraybuffer',
    timeout,
    maxRedirects: 5
  });
  return extractSubtitleText(Buffer.from(response.data));
}

function splitSrtIntoChunks(srt, maxChars = 8000) {
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

  return entries.map((entry, index) =>
    `${index + 1}\n${entry.start} --> ${entry.end}\n${entry.text}`
  ).join('\n\n') || srtText;
}

async function callAI(prompt, modelOrder, geminiKeys, openaiKey, timeout = 90000) {
  let lastError = 'Chưa rõ nguyên nhân';

  for (const model of modelOrder) {
    if (model.startsWith('gemini-')) {
      for (const key of geminiKeys) {
        try {
          const url =
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
          const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }]
          }, { timeout });

          const result = response.data?.candidates?.[0]?.content?.parts
            ?.map(part => part.text || '').join('');

          if (result) return { result, lastError: '' };
        } catch (error) {
          lastError = error.response?.data?.error?.message || error.message;
          if (error.response?.status !== 429 && !/quota|RESOURCE_EXHAUSTED/i.test(lastError)) break;
        }
      }
    } else if (model.startsWith('gpt-') && openaiKey) {
      try {
        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3
          },
          {
            headers: {
              Authorization: `Bearer ${openaiKey}`,
              'Content-Type': 'application/json'
            },
            timeout
          }
        );

        const result = response.data?.choices?.[0]?.message?.content || '';
        if (result) return { result, lastError: '' };
      } catch (error) {
        lastError = error.response?.data?.error?.message || error.message;
      }
    }
  }

  return { result: '', lastError };
}

async function handleSubtitles(req, res, encodedConfig) {
  const config = parseConfig(encodedConfig);
  const { type, id } = req.params;
  const parts = id.split(':');
  const imdbId = parts[0];
  const season = parts[1] ? parseInt(parts[1], 10) : null;
  const episode = parts[2] ? parseInt(parts[2], 10) : null;
  const hostUrl = makeHostUrl(req);
  const modelToUse = config.model || 'gemini-3.8-flash';
  const estTimeStr = type === 'series' ? '15-20s' : '25-35s';
  
  let nativeVietSubtitles = [];
  let englishSubtitles = [];

  // 1. OpenSubtitles
  if (config.opensubtitlesKey) {
    try {
      const params = { languages: 'vi,en,vie' };
      if (imdbId.startsWith('tt')) params.imdb_id = imdbId.replace(/^tt/, '');
      if (type === 'series' && season !== null && episode !== null) {
        params.season_number = season;
        params.episode_number = episode;
      }

      const response = await axios.get(
        'https://api.opensubtitles.com/api/v1/subtitles',
        {
          params,
          headers: { 'Api-Key': config.opensubtitlesKey, ...API_HEADERS },
          timeout: 8000
        }
      );

      for (const item of (response.data?.data || []).slice(0, 6)) {
        const file = item.attributes?.files?.[0];
        const lang = item.attributes?.language || '';
        if (!file?.file_id) continue;

        try {
          const download = await axios.post(
            'https://api.opensubtitles.com/api/v1/download',
            { file_id: file.file_id },
            {
              headers: {
                'Api-Key': config.opensubtitlesKey,
                ...API_HEADERS,
                'Content-Type': 'application/json'
              },
              timeout: 8000
            }
          );

          if (!download.data?.link) continue;
          const originalName = item.attributes?.release || file.file_name || 'OpenSubtitles';

          if (isVietnamese(lang)) {
            nativeVietSubtitles.push({
              id: `os-vi-${item.id}`,
              url: `${hostUrl}/proxy-sub?url=${encodeURIComponent(download.data.link)}&provider=opensubtitles&key=${encodeURIComponent(config.opensubtitlesKey)}`,
              lang: 'vie',
              name: `🇻🇳 [OpenSubtitles] ${originalName}`
            });
          } else if (isEnglish(lang)) {
            englishSubtitles.push({
              id: `ai-os-${item.id}`,
              url: `${hostUrl}/translate-sub?url=${encodeURIComponent(download.data.link)}&model=${encodeURIComponent(modelToUse)}&config=${encodeURIComponent(encodedConfig || '')}&imdbId=${encodeURIComponent(imdbId)}&type=${type}&season=${season || ''}&episode=${episode || ''}&provider=opensubtitles&key=${encodeURIComponent(config.opensubtitlesKey)}`,
              lang: 'vie',
              name: `🤖 AI [${modelToUse}] (OpenSubtitles) [⏱️ ~${estTimeStr}]: ${originalName}`
            });
          }
        } catch (error) {}
      }
    } catch (error) {}
  }

  // 2. SubDL API v1
  if (config.subdlKey && imdbId) {
    try {
      const params = {
        api_key: config.subdlKey,
        imdb_id: imdbId,
        type: type === 'series' ? 'tv' : 'movie',
        languages: 'VI,EN',
        subs_per_page: 30,
        unpack: 1
      };

      if (type === 'series' && season !== null && episode !== null) {
        params.season_number = season;
        params.episode_number = episode;
      }

      const response = await axios.get(
        'https://api.subdl.com/api/v1/subtitles',
        { params, timeout: 10000 }
      );

      const list = Array.isArray(response.data?.subtitles)
        ? response.data.subtitles
        : [];

      for (const sub of list.slice(0, 6)) {
        const lang = sub.language || sub.lang || '';
        if (!sub.url) continue;

        const downloadUrl = /^https?:\/\//i.test(sub.url)
          ? sub.url
          : `https://dl.subdl.com${sub.url.startsWith('/') ? '' : '/'}${sub.url}`;

        const name = subtitleName(sub, 'SubDL subtitle');
        const subId = sub.n_id || sub.id || sub.url;

        if (isVietnamese(lang)) {
          nativeVietSubtitles.push({
            id: `subdl-vi-${subId}`,
            url: `${hostUrl}/proxy-sub?url=${encodeURIComponent(downloadUrl)}&provider=subdl`,
            lang: 'vie',
            name: `🇻🇳 [SubDL] ${name}`
          });
        } else if (isEnglish(lang)) {
          englishSubtitles.push({
            id: `ai-subdl-${subId}`,
            url: `${hostUrl}/translate-sub?url=${encodeURIComponent(downloadUrl)}&model=${encodeURIComponent(modelToUse)}&config=${encodeURIComponent(encodedConfig || '')}&imdbId=${encodeURIComponent(imdbId)}&type=${type}&season=${season || ''}&episode=${episode || ''}&provider=subdl`,
            lang: 'vie',
            name: `🤖 AI [${modelToUse}] (SubDL) [⏱️ ~${estTimeStr}]: ${name}`
          });
        }
      }
    } catch (error) {}
  }

  // 3. Subsource
  if (config.subsourceKey && imdbId) {
    try {
      const headers = {
        'X-API-Key': config.subsourceKey,
        ...API_HEADERS
      };

      const searchResponse = await axios.get(
        'https://api.subsource.net/api/v1/subtitles',
        {
          params: { imdb_id: imdbId, languages: 'vi,en' },
          headers,
          timeout: 10000
        }
      );

      const searchData = searchResponse.data;
      const list = Array.isArray(searchData)
        ? searchData
        : Array.isArray(searchData?.data)
          ? searchData.data
          : Array.isArray(searchData?.subtitles)
            ? searchData.subtitles
            : [];

      for (const item of list.slice(0, 6)) {
        const subId = item?.id;
        if (subId === undefined || subId === null) continue;

        try {
          const detailResponse = await axios.get(
            `https://api.subsource.net/api/v1/subtitles/${encodeURIComponent(subId)}`,
            { headers, timeout: 10000 }
          );

          const detailData = detailResponse.data;
          const detail = detailData?.data || detailData?.subtitle || detailData;
          const lang = detail?.language || detail?.lang || item?.language || item?.lang || '';
          const name = subtitleName(detail, subtitleName(item, `Subsource ${subId}`));

          const downloadUrl =
            `${hostUrl}/subsource-download/${encodeURIComponent(subId)}` +
            `?key=${encodeURIComponent(config.subsourceKey)}`;

          if (isVietnamese(lang)) {
            nativeVietSubtitles.push({
              id: `subsource-vi-${subId}`,
              url: downloadUrl,
              lang: 'vie',
              name: `🇻🇳 [Subsource] ${name}`
            });
          } else if (isEnglish(lang)) {
            englishSubtitles.push({
              id: `ai-subsource-${subId}`,
              url: `${hostUrl}/translate-sub?url=${encodeURIComponent(downloadUrl)}&model=${encodeURIComponent(modelToUse)}&config=${encodeURIComponent(encodedConfig || '')}&imdbId=${encodeURIComponent(imdbId)}&type=${type}&season=${season || ''}&episode=${episode || ''}&provider=subsource`,
              lang: 'vie',
              name: `🤖 AI [${modelToUse}] (Subsource) [⏱️ ~${estTimeStr}]: ${name}`
            });
          }
        } catch (error) {}
      }
    } catch (error) {}
  }

  let subtitles = [];
  if (nativeVietSubtitles.length > 0) {
    // Nếu đã có phụ đề tiếng Việt gốc -> Chỉ trả về sub Việt gốc, tự động ẩn toàn bộ tùy chọn AI dịch
    subtitles = nativeVietSubtitles;
  } else {
    // Nếu chưa có sub Việt -> Mới hiển thị các tùy chọn dịch AI từ sub tiếng Anh
    subtitles = englishSubtitles;
  }

  if (!subtitles.length) {
    subtitles.push({
      id: 'ai-notice',
      url: 'https://raw.githubusercontent.com/SubtitleEdit/subtitleedit/master/CHANGELOG.txt',
      lang: 'vie',
      name: '⚠️ [AI Subtitle Pro] Chưa tìm thấy sub. Hãy cấu hình API Key.'
    });
  }

  res.json({ subtitles });
}

// Subsource download endpoint
app.get('/subsource-download/:id', async (req, res) => {
  const { id } = req.params;
  const key = req.query.key;

  if (!id || !key) return res.status(400).send('Missing ID or API key');

  try {
    const url =
      `https://api.subsource.net/api/v1/subtitles/${encodeURIComponent(id)}/download`;

    const text = await fetchSubtitleText(url, {
      'X-API-Key': key,
      ...API_HEADERS
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(text);
  } catch (error) {
    return res.status(error.response?.status || 502)
      .send('Không thể tải hoặc giải nén phụ đề Subsource');
  }
});

// Proxy endpoint
app.get('/proxy-sub', async (req, res) => {
  const { url, provider, key } = req.query;
  if (!url) return res.status(400).send('Missing URL');

  try {
    const text = await fetchSubtitleText(
      url,
      getProviderHeaders(provider, key)
    );
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(text);
  } catch (error) {
    return res.status(error.response?.status || 502)
      .send('Không thể tải hoặc giải nén phụ đề');
  }
});

app.get('/translate-sub', async (req, res) => {
  const {
    url, model, config: configQuery, imdbId,
    type, season, episode, provider, key
  } = req.query;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');

  if (!url) {
    return res.send('1\n00:00:01,000 --> 00:00:08,000\n[LỖI]: Đường link tải phụ đề bị trống.');
  }

  try {
    const config = parseConfig(configQuery);
    const geminiKeys = (config.geminiKeys || [process.env.GEMINI_API_KEY].filter(Boolean)).filter(Boolean);
    const openaiKey = config.openaiKey || process.env.OPENAI_API_KEY;
    const selectedModel = model || config.model || 'gemini-3.8-flash';

    let originalSrt;
    try {
      originalSrt = await fetchSubtitleText(
        url,
        getProviderHeaders(provider, key)
      );
    } catch (error) {
      return res.send(
        '1\n00:00:01,000 --> 00:00:08,000\n[LỖI TẢI FILE ĐỂ DỊCH]: ' +
        error.message
      );
    }

    const geminiModels = [
      'gemini-3.8-flash',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite'
    ];
    const gptModels = ['gpt-4o-mini', 'gpt-4o'];

    const modelOrder = selectedModel.startsWith('gpt-')
      ? [selectedModel, ...gptModels.filter(m => m !== selectedModel), ...geminiModels]
      : [selectedModel, ...geminiModels.filter(m => m !== selectedModel), ...gptModels];

    let movieContext = 'Phim điện ảnh/truyền hình tổng quát.';

    if (imdbId) {
      try {
        const metaResponse = await axios.get(
          `https://v3-cinemeta.strem.io/meta/${type === 'series' ? 'series' : 'movie'}/${imdbId}.json`,
          { timeout: 5000 }
        );

        const meta = metaResponse.data?.meta;
        if (meta) {
          movieContext =
            `Tên phim: ${meta.name || ''}\n` +
            `Thể loại: ${meta.genres?.join(', ') || ''}\n` +
            `Mô tả: ${meta.description || ''}`;

          if (type === 'series' && season && episode && Array.isArray(meta.videos)) {
            const currentEpisode = meta.videos.find(video =>
              video.season === parseInt(season, 10) &&
              video.episode === parseInt(episode, 10)
            );

            if (currentEpisode) {
              movieContext +=
                `\nTập ${season}x${episode}: ${currentEpisode.name || ''}\n` +
                `Mô tả tập: ${currentEpisode.overview || currentEpisode.description || ''}`;
            }
          }
        }
      } catch {}
    }

    const guidePrompt =
      `Dựa vào thông tin phim và mẫu phụ đề, hãy đề xuất quy tắc xưng hô tiếng Việt phù hợp.\n\n` +
      `[THÔNG TIN PHIM]\n${movieContext}\n\n` +
      `[MẪU PHỤ ĐỀ]\n${originalSrt.slice(0, 2000)}\n\n` +
      `Trả lời ngắn gọn bằng tiếng Việt.`;

    const guide = await callAI(
      guidePrompt, modelOrder, geminiKeys, openaiKey, 30000
    );

    const pronounGuide = guide.result
      ? `\n\n[QUY TẮC XƯNG HÔ & NGỮ CẢNH]\n${guide.result}`
      : '';

    const chunks = splitSrtIntoChunks(originalSrt, 8000);

    const translated = await Promise.all(chunks.map(async (chunk, index) => {
      const prompt =
        `Bạn là dịch giả phụ đề chuyên nghiệp. Dịch SRT sang tiếng Việt tự nhiên, điện ảnh.${pronounGuide}\n\n` +
        `BẮT BUỘC: giữ nguyên timestamp, không gộp, không bỏ mục. ` +
        `Chỉ trả về SRT đã dịch, không giải thích.\n\n${chunk}`;

      const result = await callAI(
        prompt, modelOrder, geminiKeys, openaiKey, 90000
      );

      if (!result.result) {
        throw new Error(`Lỗi phần ${index + 1}/${chunks.length}: ${result.lastError}`);
      }

      return { index, text: result.result.trim() };
    }));

    translated.sort((a, b) => a.index - b.index);
    const finalSrt = cleanAndRebuildSrt(
      translated.map(item => item.text).join('\n\n')
    );

    return res.send(finalSrt);
  } catch (error) {
    return res.send(
      '1\n00:00:01,000 --> 00:00:10,000\n[LỖI AI DỊCH]: ' +
      error.message
    );
  }
});

app.get('/subtitles/:type/:id.json', (req, res) =>
  handleSubtitles(req, res, null)
);

app.get('/subtitles/:type/:id/:extra.json', (req, res) =>
  handleSubtitles(req, res, null)
);

app.get('/:config/subtitles/:type/:id.json', (req, res) =>
  handleSubtitles(req, res, req.params.config)
);

app.get('/:config/subtitles/:type/:id/:extra.json', (req, res) =>
  handleSubtitles(req, res, req.params.config)
);

app.listen(PORT, () => {
  console.log(`AI Subtitle Pro v1.5.9 đang chạy trên port ${PORT}`);
});

