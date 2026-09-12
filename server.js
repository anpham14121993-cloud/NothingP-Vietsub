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
  version: '1.5.9',
  name: 'AI Subtitle Pro',
  description: 'Addon phụ đề tự động tiếng Việt thông minh (Gemini + ChatGPT + Ước tính thời gian dịch)',
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
  'User-Agent': 'AISubtitlePro v1.5.9',
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
  
  // Ước tính thời gian dựa theo loại video (Series tập ngắn: ~15-20s, Phim lẻ: ~25-35s)
  const estTimeStr = type === 'series' ? '15-20s' : '25-35s';

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

            const originalName = item.attributes.release || subFile.file_name || 'OpenSubtitles File';

            if (['vi', 'vie', 'vietnamese', 'viet'].includes(lang)) {
              subtitles.push({
                id: `os-vi-${item.id}`,
                url: `${hostUrl}/proxy-sub?url=${encodeURIComponent(realDownloadUrl)}`,
                lang: 'vie',
                name: `🇻🇳 [OpenSubtitles] ${originalName}`
              });
            } else if (['en', 'eng', 'english'].includes(lang)) {
              subtitles.push({
                id: `ai-os-${item.id}`,
                url: `${hostUrl}/translate-sub?url=${encodeURIComponent(realDownloadUrl)}&model=${modelToUse}&config=${encodedConfig || ''}&imdbId=${imdbId}&type=${type}&season=${season || ''}&episode=${episode || ''}`,
                lang: 'vie',
                name: `🤖 AI [${modelToUse}] (OpenSubtitles) [⏱️ Dự kiến ~${estTimeStr}]: ${originalName}`
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
            
            const originalName = sub.release_name || sub.name || sub.filename || 'Subdl File';

            if (['vi', 'vie', 'vietnamese', 'viet'].includes(lang)) {
              subtitles.push({
                id: `subdl-vi-${sub.les_id || Math.random()}`,
                url: `${hostUrl}/proxy-sub?url=${encodeURIComponent(dlUrl)}`,
                lang: 'vie',
                name: `🇻🇳 [Subdl] ${originalName}`
              });
            } else if (['en', 'eng', 'english'].includes(lang)) {
              subtitles.push({
                id: `ai-subdl-${sub.les_id || Math.random()}`,
                url: `${hostUrl}/translate-sub?url=${encodeURIComponent(dlUrl)}&model=${modelToUse}&config=${encodedConfig || ''}&imdbId=${imdbId}&type=${type}&season=${season || ''}&episode=${episode || ''}`,
                lang: 'vie',
                name: `🤖 AI [${modelToUse}] (Subdl) [⏱️ Dự kiến ~${estTimeStr}]: ${originalName}`
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
            
            const originalName = sub.releaseName || sub.fileName || sub.name || 'Subsource File';

            if (['vi', 'vie', 'vietnamese', 'viet'].includes(lang)) {
              subtitles.push({
                id: `subsource-vi-${sub.id || Math.random()}`,
                url: `${hostUrl}/proxy-sub?url=${encodeURIComponent(dlUrl)}&provider=subsource&key=${encodeURIComponent(config.subsourceKey)}`,
                lang: 'vie',
                name: `🇻🇳 [Subsource] ${originalName}`
              });
            } else if (['en', 'eng', 'english'].includes(lang)) {
              subtitles.push({
                id: `ai-subsource-${sub.id || Math.random()}`,
                url: `${hostUrl}/translate-sub?url=${encodeURIComponent(dlUrl)}&model=${modelToUse}&config=${encodedConfig || ''}&imdbId=${imdbId}&type=${type}&season=${season || ''}&episode=${episode || ''}`,
                lang: 'vie',
                name: `🤖 AI [${modelToUse}] (Subsource) [⏱️ Dự kiến ~${estTimeStr}]: ${originalName}`
              });
            }
          }
        }
      }
    } catch (e) {}
  }

  subtitles.sort((a, b) => {
    const isAOriginal = a.name.includes('🇻🇳');
    const isBOriginal = b.name.includes('🇻🇳');
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
    const headers = { 'User-Agent': 'AISubtitlePro v1.5.9' };
    if (provider === 'subsource' && key) headers['Authorization'] = `Bearer ${key}`;
    const response = await axios.get(url, { headers, responseType: 'text', timeout: 8000 });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(response.data);
  } catch (error) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(`1\n00:00:01,000 --> 00:00:08,000\n[LỖI TẢI SUB GỐC]: ${error.message}`);
  }
});

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
  const sParts = parts[2].split(',');
  const s = parseInt(sParts[0], 10) || 0;
  const ms = parseInt(sParts[1], 10) || 0;
  return h * 3600000 + m * 60000 + s * 1000 + ms;
}

function cleanAndRebuildSrt(srtText) {
  const cleaned = srtText.replace(/\r/g, '').trim();
  const blockStrs = cleaned.split(/\n\s*\n/).filter(Boolean);
  const entries = [];

  for (const blockStr of blockStrs) {
    const lines = blockStr.split('\n');
    let timeLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        timeLineIdx = i;
        break;
      }
    }
    if (timeLineIdx !== -1) {
      const timeLine = lines[timeLineIdx];
      const [start, end] = timeLine.split('-->').map(s => s.trim());
      const textLines = lines.slice(timeLineIdx + 1);
      if (start && end && textLines.length > 0) {
        entries.push({
          start: start,
          end: end,
          text: textLines.join('\n'),
          startMs: parseTimeToMs(start)
        });
      }
    }
  }

  entries.sort((a, b) => a.startMs - b.startMs);

  let resultSrt = '';
  for (let i = 0; i < entries.length; i++) {
    resultSrt += `${i + 1}\n${entries[i].start} --> ${entries[i].end}\n${entries[i].text}\n\n`;
  }
  return resultSrt.trim() || srtText;
}

async function callAI(prompt, modelOrder, geminiKeys, openaiKey, timeout = 90000) {
  let result = '';
  let lastError = 'Chưa rõ nguyên nhân';

  for (const m of modelOrder) {
    if (m.startsWith('gemini-')) {
      if (!geminiKeys.length) continue;
      geminiKeyLoop: for (const key of geminiKeys) {
        try {
          const u = 'https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent?key=' + key;
          const r = await axios.post(u, { contents: [{ parts: [{ text: prompt }] }] }, { timeout });
          result = r.data?.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('') || '';
          if (result) break geminiKeyLoop;
        } catch (e) {
          lastError = e.response?.data?.error?.message || e.message;
          if (e.response?.status === 429 || /quota|RESOURCE_EXHAUSTED/i.test(lastError)) {
            continue; 
          } else {
            break;
          }
        }
      }
    } else if (m.startsWith('gpt-')) {
      if (!openaiKey) continue;
      try {
        const r = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: m,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3
        }, {
          headers: { Authorization: 'Bearer ' + openaiKey, 'Content-Type': 'application/json' },
          timeout
        });
        result = r.data.choices?.[0]?.message?.content || '';
      } catch (e) {
        lastError = e.response?.data?.error?.message || e.message;
      }
    }

    if (result) break;
  }

  return { result, lastError };
}

app.get('/translate-sub', async (req, res) => {
  const { url, model, config: configQuery, imdbId, type, season, episode } = req.query;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  if (!url) return res.send('1\n00:00:01,000 --> 00:00:08,000\n[LỖI]: Đường link tải phụ đề bị trống.');

  try {
    const config = parseConfig(configQuery);
    const geminiKeys = (config.geminiKeys || [process.env.GEMINI_API_KEY].filter(Boolean)).filter(Boolean);
    const openaiKey = config.openaiKey || process.env.OPENAI_API_KEY;
    const selectedModel = model || config.model || 'gemini-3.8-flash';

    let originalSrt;
    try {
      const subResponse = await axios.get(url, {
        headers: { 'User-Agent': 'AISubtitlePro v1.5.9', 'Accept': 'text/plain, */*' },
        responseType: 'text',
        timeout: 20000
      });
      originalSrt = typeof subResponse.data === 'string' ? subResponse.data : JSON.stringify(subResponse.data);
    } catch (e) {
      return res.send('1\n00:00:01,000 --> 00:00:08,000\n[LỖI TẢI FILE ĐỂ DỊCH]: ' + e.message);
    }

    const allGeminiModels = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'];
    const allGptModels = ['gpt-4o-mini', 'gpt-4o'];
    
    let modelOrder = [];
    if (selectedModel.startsWith('gpt-')) {
      modelOrder = [selectedModel, ...allGptModels.filter(m => m !== selectedModel), ...allGeminiModels];
    } else {
      modelOrder = [selectedModel, ...allGeminiModels.filter(m => m !== selectedModel), ...allGptModels];
    }

    let movieContextStr = "Phim điện ảnh/truyền hình tổng quát.";
    if (imdbId) {
      try {
        const metaRes = await axios.get(`https://v3-cinemeta.strem.io/meta/${type === 'series' ? 'series' : 'movie'}/${imdbId}.json`, { timeout: 4000 });
        const meta = metaRes.data?.meta;
        if (meta) {
          movieContextStr = `Tên phim: ${meta.name || ''}\nThể loại: ${meta.genres?.join(', ') || ''}\nMô tả chung: ${meta.description || ''}`;
          
          if (type === 'series' && season && episode && Array.isArray(meta.videos)) {
            const currentEp = meta.videos.find(v => v.season === parseInt(season) && v.episode === parseInt(episode));
            if (currentEp) {
              movieContextStr += `\n\n--- THÔNG TIN CHI TIẾT TẬP HIỆN TẠI ---\nPhần ${season} Tập ${episode}: ${currentEp.name || ''}\nMô tả cốt truyện tập này: ${currentEp.overview || currentEp.description || 'Không có mô tả riêng'}`;
            }
          }
        }
      } catch (e) {}
    }

    const sampleText = originalSrt.slice(0, 2000);
    const guidePrompt = `Dựa vào thông tin chi tiết về bộ phim và tập phim dưới đây, kết hợp với mẫu phụ đề, hãy phân tích và thiết lập quy tắc xưng hô tiếng Việt chuẩn xác nhất cho các nhân vật trong tập này:\n\n[THÔNG TIN PHIM & TẬP PHIM]:\n${movieContextStr}\n\n[MẪU PHỤ ĐỀ]:\n${sampleText}\n\nHãy tóm tắt ngắn gọn quy tắc xưng hô và bối cảnh cụ thể của tập này (bằng tiếng Việt):`;
    
    const guideRes = await callAI(guidePrompt, modelOrder, geminiKeys, openaiKey, 30000);
    const pronounGuide = guideRes.result ? `\n\n[QUY TẮC XƯNG HÔ & NGỮ CẢNH CỦA TẬP NÀY]:\n${guideRes.result}` : '';

    const chunks = splitSrtIntoChunks(originalSrt, 8000);

    const translationPromises = chunks.map(async (chunk, i) => {
      const prompt = `Bạn là dịch giả phụ đề chuyên nghiệp. Dịch nội dung SRT sau sang tiếng Việt tự nhiên.${pronounGuide}\n\nBẮT BUỘC giữ nguyên tuyệt đối cấu trúc timestamp, không gộp, không bỏ mục. Chỉ trả về SRT đã dịch, không giải thích.\n\n` + chunk;
      
      const { result, lastError } = await callAI(prompt, modelOrder, geminiKeys, openaiKey, 90000);

      if (!result) {
        throw new Error(`Lỗi ở phần ${i + 1}/${chunks.length}: ${lastError}`);
      }

      return { index: i, text: result.trim() };
    });

    const translatedResults = await Promise.all(translationPromises);
    translatedResults.sort((a, b) => a.index - b.index);
    
    const combinedSrt = translatedResults.map(r => r.text).join('\n\n');
    const finalSrt = cleanAndRebuildSrt(combinedSrt);

    return res.send(finalSrt);
  } catch (e) {
    return res.send('1\n00:00:01,000 --> 00:00:10,000\n[LỖI AI DỊCH]: ' + e.message);
  }
});

app.get('/subtitles/:type/:id.json', (req, res) => handleSubtitles(req, res, null));
app.get('/subtitles/:type/:id/:extra.json', (req, res) => handleSubtitles(req, res, null));
app.get('/:config/subtitles/:type/:id.json', (req, res) => handleSubtitles(req, res, req.params.config));
app.get('/:config/subtitles/:type/:id/:extra.json', (req, res) => handleSubtitles(req, res, req.params.config));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
