const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

function parseConfig(encodedConfig) {
  if (!encodedConfig || encodedConfig === 'undefined' || encodedConfig === 'null') return {};
  try {
    const jsonStr = Buffer.from(encodedConfig, 'base64').toString('utf8');
    return JSON.parse(jsonStr);
  } catch (e) {
    try {
      return JSON.parse(decodeURIComponent(encodedConfig));
    } catch (err) {
      return {};
    }
  }
}

app.get('/', (req, res) => res.redirect('/configure'));
app.get('/configure', (req, res) => renderConfigPage(req, res, {}));
app.get('/:config/configure', (req, res) => {
  const savedConfig = parseConfig(req.params.config);
  renderConfigPage(req, res, savedConfig);
});

function renderConfigPage(req, res, savedConfig) {
  res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cấu hình AI Subtitle Pro</title>
        <style>
            body { background: #121212; color: #fff; font-family: Arial, sans-serif; padding: 20px; display: flex; justify-content: center; }
            .container { width: 100%; max-width: 520px; background: #1e1e1e; padding: 20px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
            h2 { text-align: center; color: #ff5252; margin-bottom: 20px; }
            label { display: block; margin-top: 12px; margin-bottom: 5px; font-size: 13px; color: #ccc; }
            input, select { width: 100%; padding: 10px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 4px; box-sizing: border-box; }
            .section-title { color: #4fc3f7; margin-top: 18px; font-size: 14px; font-weight: bold; border-bottom: 1px solid #333; padding-bottom: 4px; }
            .btn-install { width: 100%; padding: 12px; background: #e50914; color: #fff; border: none; border-radius: 4px; font-weight: bold; margin-top: 15px; cursor: pointer; }
            .btn-install:hover { background: #b00710; }
            .btn-copy { width: 100%; padding: 12px; background: #2196F3; color: #fff; border: none; border-radius: 4px; font-weight: bold; margin-top: 10px; cursor: pointer; }
            .btn-copy:hover { background: #0b7dda; }
            .link-box { margin-top: 15px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>Cấu hình AI Subtitle Pro</h2>
            <form id="configForm">
                <label>Mô hình AI dịch ưu tiên:</label>
                <select id="modelSelect">
                    <optgroup label="Google Gemini">
                        <option value="gemini-3.8-flash" ${savedConfig.model === 'gemini-3.8-flash' || !savedConfig.model ? 'selected' : ''}>Gemini 3.8 Flash (Mặc định)</option>
                        <option value="gemini-3.5-flash" ${savedConfig.model === 'gemini-3.5-flash' ? 'selected' : ''}>Gemini 3.5 Flash</option>
                        <option value="gemini-3.1-flash-lite" ${savedConfig.model === 'gemini-3.1-flash-lite' ? 'selected' : ''}>Gemini 3.1 Flash-Lite</option>
                    </optgroup>
                    <optgroup label="OpenAI ChatGPT">
                        <option value="gpt-4o-mini" ${savedConfig.model === 'gpt-4o-mini' ? 'selected' : ''}>ChatGPT: GPT-4o-mini</option>
                        <option value="gpt-4o" ${savedConfig.model === 'gpt-4o' ? 'selected' : ''}>ChatGPT: GPT-4o</option>
                    </optgroup>
                </select>

                <div class="section-title">🔑 Cấu hình Khóa AI (API Keys)</div>
                <label>Gemini API Key 1:</label>
                <input type="text" id="geminiKey1" value="${savedConfig.geminiKeys?.[0] || ''}" placeholder="AIzaSy..." />
                <label>Gemini API Key 2:</label>
                <input type="text" id="geminiKey2" value="${savedConfig.geminiKeys?.[1] || ''}" placeholder="AIzaSy..." />
                <label>Gemini API Key 3:</label>
                <input type="text" id="geminiKey3" value="${savedConfig.geminiKeys?.[2] || ''}" placeholder="AIzaSy..." />
                
                <label>OpenAI / ChatGPT API Key:</label>
                <input type="text" id="openaiKey" value="${savedConfig.openaiKey || ''}" placeholder="sk-proj-..." />

                <div class="section-title">📥 Cấu hình Nguồn Phụ Đề</div>
                <label>OpenSubtitles API Key:</label>
                <input type="text" id="opensubtitlesKey" value="${savedConfig.opensubtitlesKey || ''}" placeholder="Consumer Key từ opensubtitles.com" />
                <label>Subdl API Key:</label>
                <input type="text" id="subdlKey" value="${savedConfig.subdlKey || ''}" placeholder="API Key từ subdl.com" />
                <label>Subsource API Key:</label>
                <input type="text" id="subsourceKey" value="${savedConfig.subsourceKey || ''}" placeholder="Bearer Token từ subsource.net" />

                <button type="button" class="btn-install" id="installBtn">Cài đặt trực tiếp vào Stremio</button>
                <div class="link-box">
                    <label>Hoặc sao chép Link Addon thủ công:</label>
                    <input type="text" id="addonUrlOutput" readonly placeholder="Nhấn nút bên dưới để tạo link..." style="background: #111; color: #4fc3f7; font-size: 12px;" />
                    <button type="button" class="btn-copy" id="copyBtn">📋 Sao chép Link Addon</button>
                </div>
            </form>
        </div>
        <script>
            function getAddonUrl() {
                const config = {
                    model: document.getElementById('modelSelect').value,
                    geminiKeys: [
                        document.getElementById('geminiKey1').value.trim(),
                        document.getElementById('geminiKey2').value.trim(),
                        document.getElementById('geminiKey3').value.trim()
                    ].filter(k => k),
                    openaiKey: document.getElementById('openaiKey').value.trim(),
                    opensubtitlesKey: document.getElementById('opensubtitlesKey').value.trim(),
                    subdlKey: document.getElementById('subdlKey').value.trim(),
                    subsourceKey: document.getElementById('subsourceKey').value.trim()
                };
                const encoded = btoa(JSON.stringify(config));
                const currentUrl = window.location.origin;
                return \`\${currentUrl}/\${encoded}/manifest.json\`;
            }
            document.getElementById('installBtn').addEventListener('click', () => {
                const addonUrl = getAddonUrl();
                window.location.href = \`stremio://\${addonUrl.replace(/^https?:\\/\\//, '')}\`;
            });
            document.getElementById('copyBtn').addEventListener('click', () => {
                const addonUrl = getAddonUrl();
                const input = document.getElementById('addonUrlOutput');
                input.value = addonUrl;
                input.select();
                navigator.clipboard.writeText(addonUrl).then(() => {
                    alert('Đã sao chép link addon vào bộ nhớ tạm!');
                }).catch(err => {
                    alert('Không thể tự động sao chép, vui lòng copy thủ công trong ô!');
                });
            });
        </script>
    </body>
    </html>
  `);
}

const defaultManifest = {
  id: 'org.ai.subtitle.pro',
  version: '1.5.3',
  name: 'AI Subtitle Pro',
  description: 'Addon phụ đề tự động tiếng Việt (Gemini + ChatGPT + Đa nguồn Sub)',
  types: ['movie', 'series'],
  catalogs: [],
  resources: ['subtitles'],
  idPrefixes: ['tt'],
  configurable: true,
  behaviorHints: { configurable: true }
};

app.get('/manifest.json', (req, res) => res.json(defaultManifest));
app.get('/:config/manifest.json', (req, res) => res.json(defaultManifest));

const API_HEADERS = {
  'User-Agent': 'AISubtitlePro v1.5.3',
  'Accept': 'application/json'
};

async function handleSubtitles(req, res, encodedConfig) {
  const config = parseConfig(encodedConfig);
  const { type, id } = req.params;
  const idParts = id.split(':');
  const imdbId = idParts[0];
  const season = idParts[1] ? parseInt(idParts[1]) : null;
  const episode = idParts[2] ? parseInt(idParts[2]) : null;

  let subtitles = [];
  const hostUrl = `${req.protocol}://${req.get('host')}`;
  const modelToUse = config.model || 'gemini-3.8-flash';

  // 1. OpenSubtitles
  if (config.opensubtitlesKey) {
    try {
      const osParams = { languages: 'vi,en,vie' };
      if (imdbId && imdbId.startsWith('tt')) osParams.imdb_id = imdbId.replace('tt', '');
      if (type === 'series' && season !== null && episode !== null) {
        osParams.season_number = season;
        osParams.episode_number = episode;
      }
      const osResponse = await axios.get(`https://api.opensubtitles.com/api/v1/subtitles`, {
        params: osParams,
        headers: { 'Api-Key': config.opensubtitlesKey, ...API_HEADERS },
        timeout: 5000
      });
      if (osResponse.data?.data) {
        for (const item of osResponse.data.data.slice(0, 6)) {
          const subFile = item.attributes.files[0];
          const lang = (item.attributes.language || '').toLowerCase();
          if (!subFile || !subFile.file_id) continue;
          try {
            const downloadRes = await axios.post('https://api.opensubtitles.com/api/v1/download', {
              file_id: subFile.file_id
            }, {
              headers: { 'Api-Key': config.opensubtitlesKey, ...API_HEADERS, 'Content-Type': 'application/json' },
              timeout: 4000
            });
            const realDownloadUrl = downloadRes.data.link;
            if (!realDownloadUrl) continue;

            if (['vi', 'vie', 'vietnamese', 'viet'].includes(lang)) {
              subtitles.push({
                id: `os-vi-${item.id}`,
                url: `${hostUrl}/proxy-sub?url=${encodeURIComponent(realDownloadUrl)}`,
                lang: 'vie',
                name: '🇻🇳 Tiếng Việt (Gốc - OpenSubtitles)'
              });
            } else if (['en', 'eng', 'english'].includes(lang)) {
              subtitles.push({
                id: `ai-os-${item.id}`,
                url: `${hostUrl}/translate-sub?url=${encodeURIComponent(realDownloadUrl)}&model=${modelToUse}&config=${encodedConfig || ''}`,
                lang: 'vie',
                name: `🤖 AI Dịch (${modelToUse}) [EN->VI]`
              });
            }
          } catch (errDl) {}
        }
      }
    } catch (e) {}
  }

  // 2. Subdl
  if (config.subdlKey && imdbId) {
    try {
      const subdlRes = await axios.get('https://api.subdl.com/api/v1/subtitles', {
        params: {
          api_key: config.subdlKey,
          imdb_id: imdbId,
          type: type === 'series' ? 'tv' : 'movie',
          season,
          episode,
          languages: 'vi,en,vie'
        },
        headers: API_HEADERS,
        timeout: 5000
      });
      if (subdlRes.data?.subtitles) {
        for (const sub of subdlRes.data.subtitles.slice(0, 6)) {
          const lang = (sub.lang || '').toLowerCase();
          let dlUrl = sub.url;
          if (dlUrl) {
            if (!dlUrl.startsWith('http')) dlUrl = `https://subdl.com${dlUrl}`;
            if (['vi', 'vie', 'vietnamese', 'viet'].includes(lang)) {
              subtitles.push({
                id: `subdl-vi-${sub.les_id || Math.random()}`,
                url: `${hostUrl}/proxy-sub?url=${encodeURIComponent(dlUrl)}`,
                lang: 'vie',
                name: '🇻🇳 Tiếng Việt (Gốc - Subdl)'
              });
            } else if (['en', 'eng', 'english'].includes(lang)) {
              subtitles.push({
                id: `ai-subdl-${sub.les_id || Math.random()}`,
                url: `${hostUrl}/translate-sub?url=${encodeURIComponent(dlUrl)}&model=${modelToUse}&config=${encodedConfig || ''}`,
                lang: 'vie',
                name: `🤖 AI Dịch (${modelToUse}) [EN->VI]`
              });
            }
          }
        }
      }
    } catch (e) {}
  }

  // 3. Subsource
  if (config.subsourceKey && imdbId) {
    try {
      const subsourceRes = await axios.get(`https://api.subsource.dev/api/subtitles`, {
        params: { imdb: imdbId, lang: 'vi,en,vie' },
        headers: { 'Authorization': `Bearer ${config.subsourceKey}`, ...API_HEADERS },
        timeout: 5000
      });
      if (Array.isArray(subsourceRes.data)) {
        for (const sub of subsourceRes.data.slice(0, 6)) {
          const lang = (sub.language || '').toLowerCase();
          let dlUrl = sub.url || sub.downloadUrl;
          if (dlUrl) {
            if (!dlUrl.startsWith('http')) {
              dlUrl = `https://subsource.net${dlUrl}`;
            }
            if (['vi', 'vie', 'vietnamese', 'viet'].includes(lang)) {
              subtitles.push({
                id: `subsource-vi-${sub.id || Math.random()}`,
                url: `${hostUrl}/proxy-sub?url=${encodeURIComponent(dlUrl)}&provider=subsource&key=${encodeURIComponent(config.subsourceKey)}`,
                lang: 'vie',
                name: '🇻🇳 Tiếng Việt (Gốc - Subsource)'
              });
            } else if (['en', 'eng', 'english'].includes(lang)) {
              subtitles.push({
                id: `ai-subsource-${sub.id || Math.random()}`,
                url: `${hostUrl}/translate-sub?url=${encodeURIComponent(dlUrl)}&model=${modelToUse}&config=${encodedConfig || ''}`,
                lang: 'vie',
                name: `🤖 AI Dịch (${modelToUse}) [EN->VI]`
              });
            }
          }
        }
      }
    } catch (e) {}
  }

  // Sắp xếp đưa sub Việt gốc lên đầu danh sách hiển thị
  subtitles.sort((a, b) => {
    const isAOriginal = a.name.includes('Tiếng Việt (Gốc');
    const isBOriginal = b.name.includes('Tiếng Việt (Gốc');
    if (isAOriginal && !isBOriginal) return -1;
    if (!isAOriginal && isBOriginal) return 1;
    return 0;
  });

  if (subtitles.length === 0) {
    subtitles.push({
      id: 'ai-notice',
      url: 'https://raw.githubusercontent.com/SubtitleEdit/subtitleedit/master/CHANGELOG.txt',
      lang: 'vie',
      name: '⚠️ [AI Subtitle Pro] Chưa tìm thấy sub. Hãy cấu hình API Key.'
    });
  }

  res.json({ subtitles });
}

app.get('/proxy-sub', async (req, res) => {
  const { url, provider, key } = req.query;
  if (!url) return res.status(400).send('Missing URL');
  try {
    const headers = { 'User-Agent': 'AISubtitlePro v1.5.3' };
    if (provider === 'subsource' && key) headers['Authorization'] = `Bearer ${key}`;
    const response = await axios.get(url, { headers, responseType: 'text', timeout: 8000 });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(response.data);
  } catch (error) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(`1\n00:00:01,000 --> 00:00:08,000\n[LỖI TẢI SUB GỐC]: ${error.message}`);
  }
});

const translationJobs = new Map();

function splitSrtIntoChunks(srt, maxChars = 6500) {
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

function etaText(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return 'Đang tính...';
  const n = Math.ceil(seconds);
  return n < 60 ? n + ' giây' : Math.floor(n / 60) + ' phút ' + (n % 60) + ' giây';
}

app.get('/status', (req, res) => {
  res.type('html').send(`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI Subtitle Pro - Tiến độ</title><style>body{font:16px Arial;background:#121212;color:#eee;padding:20px;max-width:760px;margin:auto}h2{color:#ff5252}.job{background:#222;padding:14px;border-radius:8px;margin:12px 0}.bar{height:10px;background:#444;border-radius:8px;overflow:hidden}.fill{height:100%;background:#4caf50;width:0}.muted{color:#bbb;font-size:13px}</style><h2>AI Subtitle Pro — Tiến độ dịch</h2><p class="muted">Trang tự cập nhật mỗi 2,5 giây. Giữ trang này mở trong khi Stremio tải phụ đề.</p><div id="jobs">Đang tải trạng thái...</div><script>async function refresh(){try{const r=await fetch("/status.json");const d=await r.json();const root=document.getElementById("jobs");if(!d.jobs.length){root.textContent="Chưa có tác vụ dịch gần đây.";return;}root.innerHTML=d.jobs.map(j=>{const pct=j.total?Math.floor(j.done/j.total*100):0;return "<div class=\\"job\\"><b>"+j.status+"</b><p>"+j.done+" / "+j.total+" phần ("+pct+"%)</p><div class=\\"bar\\"><div class=\\"fill\\" style=\\"width:"+pct+"%\\"></div></div><p>Ước tính còn: "+j.eta+"</p><p class=\\"muted\\">"+j.detail+"</p></div>"}).join("");}catch(e){document.getElementById("jobs").textContent="Không đọc được trạng thái: "+e.message;}}refresh();setInterval(refresh,2500);</script></html>`);
});

app.get('/status.json', (req, res) => {
  const jobs = [...translationJobs.values()]
    .sort((a, b) => b.started - a.started)
    .slice(0, 15)
    .map(j => ({
      status: j.status,
      done: j.done,
      total: j.total,
      eta: j.status === 'Hoàn tất' || j.status === 'Lỗi' ? '0 giây' : etaText(j.avgSeconds * (j.total - j.done)),
      detail: j.detail
    }));
  res.json({ jobs });
});

app.get('/translate-sub', async (req, res) => {
  const { url, model, config: configQuery } = req.query;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  if (!url) return res.send('1\n00:00:01,000 --> 00:00:08,000\n[LỖI]: Đường link tải phụ đề bị trống.');

  const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const job = { started: Date.now(), done: 0, total: 0, avgSeconds: 12, status: 'Đang tải phụ đề', detail: 'Đang tải file SRT' };
  translationJobs.set(jobId, job);

  try {
    const config = parseConfig(configQuery);
    const geminiKeys = (config.geminiKeys || [process.env.GEMINI_API_KEY].filter(Boolean)).filter(Boolean);
    const openaiKey = config.openaiKey || process.env.OPENAI_API_KEY;
    const selectedModel = model || config.model || 'gemini-3.8-flash';

    let originalSrt;
    try {
      const subResponse = await axios.get(url, {
        headers: { 'User-Agent': 'AISubtitlePro v1.5.3', 'Accept': 'text/plain, */*' },
        responseType: 'text',
        timeout: 20000
      });
      originalSrt = typeof subResponse.data === 'string' ? subResponse.data : JSON.stringify(subResponse.data);
    } catch (e) {
      job.status = 'Lỗi';
      job.detail = 'Không tải được SRT: ' + e.message;
      return res.send('1\n00:00:01,000 --> 00:00:08,000\n[LỖI TẢI FILE ĐỂ DỊCH]: ' + e.message);
    }

    const chunks = splitSrtIntoChunks(originalSrt, 6500);
    job.total = chunks.length;
    job.status = 'Đang dịch';
    job.detail = 'Đã chia SRT thành ' + chunks.length + ' phần';

    const translated = [];
    const models = [...new Set([selectedModel, 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'].filter(m => typeof m === 'string' && m.startsWith('gemini-')))];

    for (let i = 0; i < chunks.length; i++) {
      const prompt = 'Bạn là dịch giả phụ đề chuyên nghiệp. Dịch nội dung SRT sau sang tiếng Việt tự nhiên. BẮT BUỘC giữ nguyên tuyệt đối số thứ tự, timestamp và cấu trúc từng mục; không gộp, không bỏ, không thêm mục. Chỉ trả về SRT đã dịch, không giải thích.\n\n' + chunks[i];
      let result = '';
      let lastError = 'Chưa rõ nguyên nhân';

      if (selectedModel.startsWith('gpt-') && openaiKey) {
        try {
          const r = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: selectedModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3
          }, {
            headers: { Authorization: 'Bearer ' + openaiKey, 'Content-Type': 'application/json' },
            timeout: 90000
          });
          result = r.data.choices?.[0]?.message?.content || '';
        } catch (e) {
          lastError = e.response?.data?.error?.message || e.message;
        }
      }

      if (!result && geminiKeys.length) {
        for (const key of geminiKeys) {
          let keyExhausted = false;
          for (const m of models) {
            try {
              const u = 'https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent?key=' + key;
              const r = await axios.post(u, { contents: [{ parts: [{ text: prompt }] }] }, { timeout: 90000 });
              result = r.data?.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('') || '';
              if (result) break;
            } catch (e) {
              lastError = e.response?.data?.error?.message || e.message;
              if (e.response?.status === 429 || /quota|RESOURCE_EXHAUSTED/i.test(lastError)) {
                keyExhausted = true;
                break;
              }
            }
          }
          if (result) break;         // Đã dịch thành công phần này, thoát vòng lặp key
          if (keyExhausted) continue; // Key này hết quota, chuyển sang key tiếp theo (Key 2, Key 3)
        }
      }

      if (!result) {
        job.status = 'Lỗi';
        job.detail = 'Lỗi ở phần ' + (i + 1) + '/' + chunks.length + ': ' + lastError;
        return res.send('1\n00:00:01,000 --> 00:00:10,000\n[LỖI AI DỊCH - phần ' + (i + 1) + ']: ' + lastError);
      }

      translated.push(result.trim());
      job.done = i + 1;
      const elapsed = (Date.now() - job.started) / 1000;
      job.avgSeconds = elapsed / job.done;
      job.detail = 'Đã dịch xong phần ' + job.done + '/' + job.total;
    }

    job.status = 'Hoàn tất';
    job.detail = 'Đã dịch xong toàn bộ ' + job.total + ' phần';
    return res.send(translated.join('\n\n'));
  } catch (e) {
    job.status = 'Lỗi';
    job.detail = e.message;
    return res.send('1\n00:00:01,000 --> 00:00:10,000\n[LỖI AI DỊCH]: ' + e.message);
  } finally {
    setTimeout(() => translationJobs.delete(jobId), 30 * 60 * 1000);
  }
});

app.get('/subtitles/:type/:id.json', (req, res) => handleSubtitles(req, res, null));
app.get('/subtitles/:type/:id/:extra.json', (req, res) => handleSubtitles(req, res, null));
app.get('/:config/subtitles/:type/:id.json', (req, res) => handleSubtitles(req, res, req.params.config));
app.get('/:config/subtitles/:type/:id/:extra.json', (req, res) => handleSubtitles(req, res, req.params.config));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
