const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// Hàm phân tích cấu hình hỗ trợ cả dạng JSON trực tiếp lẫn Base64
function parseConfig(encodedConfig) {
    if (!encodedConfig) return {};
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

// 1. Tự động chuyển hướng từ trang chủ sang trang cấu hình
app.get('/', (req, res) => res.redirect('/configure'));

// 2. Giao diện trang cấu hình (Đầy đủ mọi mục)
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
            .btn-install { width: 100%; padding: 12px; background: #e50914; color: #fff; border: none; border-radius: 4px; font-weight: bold; margin-top: 20px; cursor: pointer; }
            .btn-install:hover { background: #b00710; }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>Cấu hình AI Subtitle Pro</h2>
            <form id="configForm">
                <label>Mô hình AI dịch ưu tiên:</label>
                <select id="modelSelect">
                    <optgroup label="Google Gemini">
                        <option value="gemini-2.5-flash" ${savedConfig.model === 'gemini-2.5-flash' ? 'selected' : ''}>Gemini 2.5 Flash (Khuyên dùng)</option>
                        <option value="gemini-2.5-pro" ${savedConfig.model === 'gemini-2.5-pro' ? 'selected' : ''}>Gemini 2.5 Pro (Chất lượng cao)</option>
                    </optgroup>
                    <optgroup label="OpenAI ChatGPT">
                        <option value="gpt-4o-mini" ${savedConfig.model === 'gpt-4o-mini' ? 'selected' : ''}>ChatGPT: GPT-4o-mini</option>
                        <option value="gpt-4o" ${savedConfig.model === 'gpt-4o' ? 'selected' : ''}>ChatGPT: GPT-4o</option>
                    </optgroup>
                </select>

                <div class="section-title">🔑 Cấu hình Khóa AI (API Keys)</div>

                <label>Gemini API Key 1:</label>
                <input type="text" id="geminiKey1" value="${savedConfig.geminiKeys?.[0] || ''}" placeholder="AIzaSy..." />

                <label>Gemini API Key 2 (Dự phòng):</label>
                <input type="text" id="geminiKey2" value="${savedConfig.geminiKeys?.[1] || ''}" placeholder="AIzaSy..." />

                <label>Gemini API Key 3 (Dự phòng):</label>
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

                <button type="button" class="btn-install" id="installBtn">Cài đặt vào Stremio</button>
            </form>
        </div>

        <script>
            document.getElementById('installBtn').addEventListener('click', () => {
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
                const addonUrl = \`\${currentUrl}/\${encoded}/manifest.json\`;
                window.location.href = \`stremio://\${addonUrl.replace(/^https?:\\/\\//, '')}\`;
            });
        </script>
    </body>
    </html>
    `);
}

// 3. Manifest Addon
const defaultManifest = {
    id: 'org.ai.subtitle.pro',
    version: '1.4.0',
    name: 'AI Subtitle Pro',
    description: 'Addon phụ đề tự động tiếng Việt (Gemini + ChatGPT + Đa nguồn Sub)',
    types: ['movie', 'series'],
    catalogs: [],
    resources: ['subtitles'],
    idPrefixes: ['tt']
};

app.get('/manifest.json', (req, res) => res.json(defaultManifest));
app.get('/:config/manifest.json', (req, res) => res.json(defaultManifest));

// 4. Hàm xử lý quét đa nguồn phụ đề
async function handleSubtitles(req, res, encodedConfig) {
    const config = parseConfig(encodedConfig);
    const { type, id } = req.params;
    
    const idParts = id.split(':');
    const imdbId = idParts[0];
    const season = idParts[1] ? parseInt(idParts[1]) : null;
    const episode = idParts[2] ? parseInt(idParts[2]) : null;

    let subtitles = [];
    const hostUrl = `${req.protocol}://${req.get('host')}`;
    const hasAiKey = (config.geminiKeys && config.geminiKeys.length > 0) || config.openaiKey;
    const modelToUse = config.model || 'gemini-2.5-flash';

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
                headers: { 'Api-Key': config.opensubtitlesKey, 'User-Agent': 'AiSubtitlePro v1.4.0' },
                timeout: 5000
            });

            if (osResponse.data?.data) {
                for (const item of osResponse.data.data.slice(0, 5)) {
                    const subFile = item.attributes.files[0];
                    const lang = (item.attributes.language || '').toLowerCase();
                    if (!subFile || !subFile.file_id) continue;

                    try {
                        const downloadRes = await axios.post('https://api.opensubtitles.com/api/v1/download', { file_id: subFile.file_id }, {
                            headers: { 'Api-Key': config.opensubtitlesKey, 'User-Agent': 'AiSubtitlePro v1.4.0', 'Content-Type': 'application/json' },
                            timeout: 4000
                        });
                        const realDownloadUrl = downloadRes.data.link;
                        if (!realDownloadUrl) continue;

                        if (['vi', 'vie', 'vietnamese', 'viet'].includes(lang)) {
                            subtitles.push({ id: `os-vi-${item.id}`, url: `${hostUrl}/proxy-sub?url=${encodeURIComponent(realDownloadUrl)}`, lang: 'vie', name: 'OpenSubtitles [VI]' });
                        } else if (['en', 'eng', 'english'].includes(lang) && hasAiKey) {
                            subtitles.push({ id: `ai-os-${item.id}`, url: `${hostUrl}/translate-sub?url=${encodeURIComponent(realDownloadUrl)}&model=${modelToUse}&config=${encodedConfig || ''}`, lang: 'vie', name: `🤖 AI Dịch (${modelToUse}) [EN->VI]` });
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
                params: { api_key: config.subdlKey, imdb_id: imdbId, type: type === 'series' ? 'tv' : 'movie', season, episode, languages: 'vi,en,vie' },
                timeout: 5000
            });

            if (subdlRes.data?.subtitles) {
                for (const sub of subdlRes.data.subtitles.slice(0, 5)) {
                    const lang = (sub.lang || '').toLowerCase();
                    let dlUrl = sub.url;
                    if (dlUrl && !dlUrl.startsWith('http')) dlUrl = `https://subdl.com${dlUrl}`;
                    if (!dlUrl) continue;

                    if (['vi', 'vie', 'vietnamese', 'viet'].includes(lang)) {
                        subtitles.push({ id: `subdl-vi-${sub.les_id || Math.random()}`, url: `${hostUrl}/proxy-sub?url=${encodeURIComponent(dlUrl)}`, lang: 'vie', name: 'Subdl [VI]' });
                    } else if (['en', 'eng', 'english'].includes(lang) && hasAiKey) {
                        subtitles.push({ id: `ai-subdl-${sub.les_id || Math.random()}`, url: `${hostUrl}/translate-sub?url=${encodeURIComponent(dlUrl)}&model=${modelToUse}&config=${encodedConfig || ''}`, lang: 'vie', name: `🤖 AI Dịch (${modelToUse}) [EN->VI]` });
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
                headers: { 'Authorization': `Bearer ${config.subsourceKey}` },
                timeout: 5000
            });

            if (Array.isArray(subsourceRes.data)) {
                for (const sub of subsourceRes.data.slice(0, 5)) {
                    const lang = (sub.language || '').toLowerCase();
                    const dlUrl = sub.url || sub.downloadUrl;
                    if (!dlUrl) continue;

                    if (['vi', 'vie', 'vietnamese', 'viet'].includes(lang)) {
                        subtitles.push({ id: `subsource-vi-${sub.id || Math.random()}`, url: `${hostUrl}/proxy-sub?url=${encodeURIComponent(dlUrl)}&provider=subsource&key=${encodeURIComponent(config.subsourceKey)}`, lang: 'vie', name: 'Subsource [VI]' });
                    } else if (['en', 'eng', 'english'].includes(lang) && hasAiKey) {
                        subtitles.push({ id: `ai-subsource-${sub.id || Math.random()}`, url: `${hostUrl}/translate-sub?url=${encodeURIComponent(dlUrl)}&model=${modelToUse}&config=${encodedConfig || ''}`, lang: 'vie', name: `🤖 AI Dịch (${modelToUse}) [EN->VI]` });
                    }
                }
            }
        } catch (e) {}
    }

    if (subtitles.length === 0) {
        subtitles.push({
            id: 'ai-notice',
            url: 'https://raw.githubusercontent.com/SubtitleEdit/subtitleedit/master/CHANGELOG.txt',
            lang: 'vie',
            name: '⚠️ [AI Subtitle Pro] Chưa tìm thấy sub. Hãy cấu hình API Key OpenSubtitles/Subdl/Subsource.'
        });
    }

    res.json({ subtitles });
}

// 5. Proxy Sub Gốc
app.get('/proxy-sub', async (req, res) => {
    const { url, provider, key } = req.query;
    if (!url) return res.status(400).send('Missing URL');

    try {
        const headers = { 'User-Agent': 'AiSubtitlePro v1.4.0' };
        if (provider === 'subsource' && key) headers['Authorization'] = `Bearer ${key}`;

        const response = await axios.get(url, { headers, responseType: 'text', timeout: 8000 });
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send(response.data);
    } catch (error) {
        res.status(500).send('1\n00:00:01,000 --> 00:00:05,000\n[Lỗi tải phụ đề gốc]');
    }
});

// 6. Endpoint Dịch AI (Hỗ trợ 3 Key Gemini + ChatGPT)
app.get('/translate-sub', async (req, res) => {
    const { url, model, config: configQuery } = req.query;
    const config = parseConfig(configQuery);
    
    const geminiKeys = config.geminiKeys || [process.env.GEMINI_API_KEY].filter(Boolean);
    const openaiKey = config.openaiKey || process.env.OPENAI_API_KEY;
    const selectedModel = model || config.model || 'gemini-2.5-flash';

    let originalSrt = "";
    try {
        const subResponse = await axios.get(url, { responseType: 'text', timeout: 6000 });
        originalSrt = typeof subResponse.data === 'string' ? subResponse.data : JSON.stringify(subResponse.data);
    } catch (e) {
        originalSrt = "1\n00:00:01,000 --> 00:00:05,000\n[Không thể tải sub tiếng Anh để dịch]";
    }

    const prompt = `Bạn là dịch giả chuyên nghiệp. Hãy dịch toàn bộ nội dung file phụ đề SRT sau sang tiếng Việt tự nhiên, giữ nguyên cấu trúc thời gian (timestamps) và số thứ tự của SRT gốc. Chỉ trả về nội dung SRT đã dịch, không kèm giải thích:\n\n${originalSrt}`;

    let translatedSrt = "";
    let success = false;

    // A. Thử ChatGPT nếu chọn model gpt hoặc có openaiKey
    if (selectedModel.startsWith('gpt-') || (openaiKey && !selectedModel.startsWith('gemini'))) {
        try {
            const openaiRes = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: selectedModel.startsWith('gpt-') ? selectedModel : 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3
            }, {
                headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
                timeout: 45000
            });
            translatedSrt = openaiRes.data.choices[0].message.content;
            success = true;
        } catch (err) {}
    }

    // B. Thử Gemini (Vòng lặp qua các key 1, 2, 3)
    if (!success && geminiKeys.length > 0) {
        const modelsToTry = [selectedModel, 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];
        const uniqueModels = [...new Set(modelsToTry.filter(m => !m.startsWith('gpt-')))];

        for (const key of geminiKeys) {
            if (success) break;
            for (const m of uniqueModels) {
                try {
                    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`;
                    const aiResponse = await axios.post(geminiUrl, {
                        contents: [{ parts: [{ text: prompt }] }]
                    }, { timeout: 35000 });

                    if (aiResponse.data?.candidates?.[0]?.content) {
                        translatedSrt = aiResponse.data.candidates[0].content.parts[0].text;
                        success = true;
                        break;
                    }
                } catch (err) {}
            }
        }
    }

    if (!success) {
        translatedSrt = `1\n00:00:01,000 --> 00:00:05,000\n🤖 AI Subtitle Pro: Lỗi dịch AI (Kiểm tra lại API Key hoặc hạn mức).\n` + originalSrt;
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(translatedSrt);
});

// 7. Định tuyến Subtitles (Đầy đủ cả 4 trường hợp Stremio gọi)
app.get('/subtitles/:type/:id.json', (req, res) => handleSubtitles(req, res, null));
app.get('/subtitles/:type/:id/:extra.json', (req, res) => handleSubtitles(req, res, null));
app.get('/:config/subtitles/:type/:id.json', (req, res) => handleSubtitles(req, res, req.params.config));
app.get('/:config/subtitles/:type/:id/:extra.json', (req, res) => handleSubtitles(req, res, req.params.config));

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

