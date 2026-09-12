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
  'User-Agent': 'AISubtitlePro v2.0.0',
  Accept: 'application/json'
};

// Giải mã cấu hình từ URL của Stremio
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

// Giao diện trang cấu hình Addon (Cài đặt API Key trực tiếp)
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
<option value="gemini-2.5-flash" ${savedConfig.model === 'gemini-2.5-flash' || !savedConfig.model ? 'selected' : ''}>Gemini 2.5 Flash (Khuyên dùng)</option>
<option value="gemini-2.0-flash" ${savedConfig.model === 'gemini-2.0-flash' ? 'selected' : ''}>Gemini 2.0 Flash</option>
<option value="gemini-1.5-flash" ${savedConfig.model === 'gemini-1.5-flash' ? 'selected' : ''}>Gemini 1.5 Flash</option>
</select>
<div class="section-title">🔑 Google Gemini API Keys (Có thể nhập nhiều key để xoay vòng)</div>
<label>Gemini API Key 1</label><input id="geminiKey1" value="${escapeHtml(geminiKeys[0])}" placeholder="AIzaSy...">
<label>Gemini API Key 2</label><input id="geminiKey2" value="${escapeHtml(geminiKeys[1])}">
<label>Gemini API Key 3</label><input id="geminiKey3" value="${escapeHtml(geminiKeys[2])}">
<div class="section-title">📥 Nguồn phụ đề (Tùy chọn)</div>
<label>OpenSubtitles API Key (Bỏ trống nếu dùng bản public)</label><input id="opensubtitlesKey" value="${escapeHtml(savedConfig.opensubtitlesKey)}">
<label>SubDL API Key</label><input id="subdlKey" value="${escapeHtml(savedConfig.subdlKey)}">
<button type="button" id="installBtn">Cài đặt trực tiếp vào Stremio</button>
<label style="margin-top:20px">Link Addon (Cập nhật tự động):</label><input id="addonUrlOutput" readonly>
<button type="button" id="copyBtn">📋 Sao chép Link Addon</button>
</form>
</div>
<script>
function getAddonUrl(){
  const config={
    model:document.getElementById('modelSelect').value,
    geminiKeys:['geminiKey1','geminiKey2','geminiKey3'].map(id=>document.getElementById(id).value.trim()).filter(Boolean),
    opensubtitlesKey:document.getElementById('opensubtitlesKey').value.trim(),
    subdlKey:document.getElementById('subdlKey').value.trim()
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
  version: '2.0.0',
  name: 'Gemini AI Subtitle Pro',
  description: 'Tự động tìm sub Việt hoặc dịch phụ đề Tiếng Anh sang Tiếng Việt cực mượt bằng Google Gemini AI.',
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
  const code = languageCode(value);
  return code === 'vi' || code === 'vie' || code === 'vnm' || code === 'vn' || code.startsWith('vi') || code.includes('viet');
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

// Gọi AI luân phiên các key và chống lỗi Rate Limit
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

// Xử lý yêu cầu trả về danh sách phụ đề cho Stremio giống hệt giao diện bạn muốn
async function handleSubtitles(req, res, encodedConfig) {
  const config = parseConfig(encodedConfig);
  const { type, id } = req.params;
  const parts = id.split(':');
  const imdbId = parts[0];
  const season = parts[1] ? parseInt(parts[1], 10) : null;
  const episode = parts[2] ? parseInt(parts[2], 10) : null;
  const hostUrl = makeHostUrl(req);
  const modelToUse = config.model || 'gemini-2.5-flash';

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
      timeout: 8000
    });

    for (const item of (osRes.data?.data || []).slice(0, 8)) {
      const file = item.attributes?.files?.[0];
      const lang = item.attributes?.language || '';
      if (!file?.file_id) continue;

      const download = await axios.post('https://api.opensubtitles.com/api/v1/download', { file_id: file.file_id }, {
        headers: { 'Api-Key': apiKeyOS, ...API_HEADERS, 'Content-Type': 'application/json' },
        timeout: 8000
      }).catch(() => null);

      if (!download?.data?.link) continue;
      const releaseName = item.attributes?.release || file.file_name || 'OpenSubtitles Sub';

      if (isVietnamese(lang)) {
        nativeVietSubtitles.push({
          id: `os-vi-${item.id}`,
          url: `${hostUrl}/proxy-sub?url=${encodeURIComponent(download.data.link)}`,
          lang: 'vie',
          name: `🇻🇳 [Việt Nam] ${releaseName}`
        });
      } else if (isEnglish(lang)) {
        // Tạo link dịch AI format giống hệt ảnh mẫu của bạn: [GEMINI AI] Tiếng Anh - Tên file gốc
        englishSubtitlesForAI.push({
          id: `ai-os-${item.id}`,
          url: `${hostUrl}/translate-sub?url=${encodeURIComponent(download.data.link)}&model=${encodeURIComponent(modelToUse)}&config=${encodeURIComponent(encodedConfig || '')}&imdbId=${encodeURIComponent(imdbId)}&type=${type}&season=${season || ''}&episode=${episode || ''}`,
          lang: 'vie',
          name: `[GEMINI AI] Tiếng Anh\n${releaseName}`
        });
      }
    }
  } catch (err) {}

  // 2. Quét SubDL nếu cần thêm
  try {
    if (imdbId && englishSubtitlesForAI.length < 5) {
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
        timeout: 8000
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
            name: `🇻🇳 [Việt Nam] ${releaseName}`
          });
        } else if (isEnglish(lang)) {
          englishSubtitlesForAI.push({
            id: `ai-subdl-${sub.n_id || sub.id}`,
            url: `${hostUrl}/translate-sub?url=${encodeURIComponent(dlUrl)}&model=${encodeURIComponent(modelToUse)}&config=${encodeURIComponent(encodedConfig || '')}&imdbId=${encodeURIComponent(imdbId)}&type=${type}&season=${season || ''}&episode=${episode || ''}`,
            lang: 'vie',
            name: `[GEMINI AI] Tiếng Anh\n${releaseName}`
          });
        }
      }
    }
  } catch (err) {}

  // Gom kết quả: Hiển thị cả sub Việt gốc lẫn danh sách sub Anh được tích hợp sẵn tùy chọn dịch AI
  let subtitles = [...nativeVietSubtitles, ...englishSubtitlesForAI];

  if (!subtitles.length) {
    subtitles.push({
      id: 'ai-notice',
      url: 'https://raw.githubusercontent.com/SubtitleEdit/subtitleedit/master/CHANGELOG.txt',
      lang: 'vie',
      name: '⚠️ [Gemini AI] Không tìm thấy phụ đề. Hãy cấu hình API Key ở trang cài đặt addon.'
    });
  }

  res.json({ subtitles });
}

// Proxy tải phụ đề thường
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

// Endpoint thực hiện dịch thuật thông minh từng phần (chống lỗi 1/7, 1/8 và quota)
app.get('/translate-sub', async (req, res) => {
  const { url, model, config: configQuery, imdbId, type, season, episode } = req.query;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');

  if (!url) return res.send('1\n00:00:01,000 --> 00:00:05,000\n[LỖI]: Thiếu đường dẫn file phụ đề để dịch.');

  try {
    const config = parseConfig(configQuery);
    const geminiKeys = (config.geminiKeys && config.geminiKeys.length > 0)
      ? config.geminiKeys
      : [process.env.GEMINI_API_KEY].filter(Boolean);

    if (!geminiKeys.length) {
      return res.send('1\n00:00:01,000 --> 00:00:08,000\n[LỖI]: Bạn chưa cấu hình Gemini API Key. Hãy truy cập trang cấu hình addon để nhập Key.');
    }

    const selectedModel = model || config.model || 'gemini-2.5-flash';

    // Tải nội dung phụ đề tiếng Anh gốc
    let originalSrt;
    try {
      originalSrt = await fetchSubtitleText(url);
    } catch (err) {
      return res.send('1\n00:00:01,000 --> 00:00:08,000\n[LỖI]: Không tải được file phụ đề tiếng Anh.');
    }

    // Lấy thông tin ngữ cảnh phim từ Cinemeta để AI dịch chuẩn xưng hô
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

    // Gợi ý phong cách xưng hô
    const guideRes = await callAI(`Dựa vào thông tin phim sau, đề xuất ngắn gọn đại từ nhân xưng tiếng Việt phù hợp nhất:\n${movieContext}`, geminiKeys, selectedModel);
    const pronounGuide = guideRes.result ? `\n[Quy tắc xưng hô tham khảo]: ${guideRes.result}` : '';

    // Chia file thành các chunk an toàn
    const chunks = splitSrtIntoChunks(originalSrt, 7500);
    const translated = [];

    // Dịch tuần tự từng chunk kèm delay 1.5s để chống tràn giới hạn (Rate Limit / Quota Exceeded)
    for (let i = 0; i < chunks.length; i++) {
      const prompt = `Bạn là dịch giả phụ đề chuyên nghiệp. Dịch đoạn mã SRT sau sang tiếng Việt điện ảnh, tự nhiên.${pronounGuide}
BẮT BUỘC: Giữ nguyên tuyệt đối số thứ tự phụ đề, thời gian (timestamps) và định dạng. Không giải thích gì thêm, chỉ trả về nội dung SRT đã dịch.

${chunks[i]}`;

      const aiRes = await callAI(prompt, geminiKeys, selectedModel);
      if (!aiRes.result) {
        // Nếu lỗi ở chunk nào, giữ nguyên bản gốc chunk đó để không làm hỏng file
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

