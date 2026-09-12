const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 7000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function parseConfig(encodedConfig) {
    try {
        return JSON.parse(decodeURIComponent(encodedConfig));
    } catch (e) {
        return null;
    }
}

// 1. Giao diện trang cấu hình
app.get('/:config?/configure', (req, res) => {
    const savedConfig = parseConfig(req.params.config) || {};
    
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
            .note { font-size: 11px; color: #888; margin-top: 3px; }
            .btn-install { width: 100%; padding: 12px; background: #e50914; color: #fff; border: none; border-radius: 4px; font-weight: bold; margin-top: 20px; cursor: pointer; }
            .btn-install:hover { background: #b00710; }
            .copy-section { margin-top: 15px; background: #161616; padding: 12px; border-radius: 6px; border: 1px solid #333; }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>Cấu hình AI Subtitle Pro</h2>
            <form id="configForm">
                <label>Mô hình Gemini dịch AI ưu tiên:</label>
                <select id="modelSelect">
                    <option value="gemini-3.6-flash" ${savedConfig.model === 'gemini-3.6-flash' ? 'selected' : ''}>Gemini 3.6 Flash (Khuyên dùng - Mạnh mẽ)</option>
                    <option value="gemini-3.5-flash-lite" ${savedConfig.model === 'gemini-3.5-flash-lite' ? 'selected' : ''}>Gemini 3.5 Flash-Lite (Siêu nhanh & Tiết kiệm)</option>
                    <option value="gemini-1.5-flash" ${savedConfig.model === 'gemini-1.5-flash' ? 'selected' : ''}>Gemini 1.5 Flash (Dự phòng ổn định)</option>
                    <option value="gemini-1.5-pro" ${savedConfig.model === 'gemini-1.5-pro' ? 'selected' : ''}>Gemini 1.5 Pro (Chất lượng cao)</option>
                </select>

                <label>Gemini API Key 1 (Bắt buộc để dịch AI):</label>
                <input type="text" id="geminiKey1" value="${savedConfig.geminiKeys?.[0] || ''}" placeholder="AIzaSy..." />

                <label>Gemini API Key 2 (Tùy chọn dự phòng):</label>
                <input type="text" id="geminiKey2" value="${savedConfig.geminiKeys?.[1] || ''}" placeholder="AIzaSy..." />

                <label>OpenSubtitles API Key (Bắt buộc để lấy sub từ OpenSubtitles):</label>
                <input type="text" id="opensubtitlesKey" value="${savedConfig.opensubtitlesKey || ''}" placeholder="Consumer Key từ opensubtitles.com" />
                <div class="note">* Nếu để trống, addon sẽ không thể quét sub từ OpenSubtitles.</div>

                <label>Subdl API Key (Bắt buộc nếu muốn lấy sub từ Subdl):</label>
                <input type="text" id="subdlKey" value="${savedConfig.subdlKey || ''}" placeholder="API Key từ subdl.com" />

                <label>Subsource API Key (Bắt buộc nếu muốn lấy sub từ Subsource):</label>
                <input type="text" id="subsourceKey" value="${savedConfig.subsourceKey || ''}" placeholder="Bearer Token từ subsource.net" />

                <button type="button" class="btn-install" id="installBtn">Cài đặt vào Stremio</button>

                <div class="copy-section">
                    <label style="margin-top:0; color:#fff;">Link cấu hình thủ công (Dành cho Mobile):</label>
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                        <input type="text" id="configLinkOutput" readonly style="font-size: 11px; background: #111;" />
                        <button type="button" id="copyLinkBtn" style="padding: 0 12px; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; cursor: pointer; white-space: nowrap;">Sao chép</button>
                    </div>
                </div>
            </form>
        </div>

        <script>
            function generateConfigUrl() {
                const config = {
                    model: document.getElementById('modelSelect').value,
                    geminiKeys: [
                        document.getElementById('geminiKey1').value.trim(),
                        document.getElementById('geminiKey2').value.trim()
                    ].filter(k => k),
                    opensubtitlesKey: document.getElementById('opensubtitlesKey').value.trim(),
                    subdlKey: document.getElementById('subdlKey').value.trim(),
                    subsourceKey: document.getElementById('subsourceKey').value.trim()
                };
                const encoded = encodeURIComponent(JSON.stringify(config));
                return \`\${window.location.origin}/\${encoded}/manifest.json\`;
            }

            function updateLink() {
                const url = generateConfigUrl();
                document.getElementById('configLinkOutput').value = url;
            }

            document.querySelectorAll('input, select').forEach(el => {
                el.addEventListener('input', updateLink);
            });

            document.getElementById('installBtn').addEventListener('click', () => {
                const url = generateConfigUrl();
                const stremioUrl = url.replace(/^https?:\\/\\//, 'stremio://');
                window.location.href = stremioUrl;
            });

            document.getElementById('copyLinkBtn').addEventListener('click', () => {
                const input = document.getElementById('configLinkOutput');
                input.select();
                input.setSelectionRange(0, 99999);
                navigator.clipboard.writeText(input.value).then(() => {
                    alert('Đã sao chép link thành công! Hãy dán vào Stremio.');
                }).catch(() => {
                    alert('Không thể tự sao chép, vui lòng copy thủ công.');
                });
            });

            window.onload = updateLink;
        </script>
    </body>
    </html>
    `);
});

const defaultManifest = {
    id: 'org.ai.subtitle.pro',
    version: '1.0.4',
    name: 'AI Subtitle Pro',
    description: 'Addon phụ đề tự động tiếng Việt & tổng hợp đa nguồn sub',
    types: ['movie', 'series'],
    catalogs: [],
    resources: ['subtitles'],
    behaviorHints: { configurable: true }
};

app.get('/:config?/manifest.json', (req, res) => {
    const config = parseConfig(req.params.config);
    const manifest = { ...defaultManifest };
    if (config && config.model) {
        manifest.name = `AI Subtitle Pro (${config.model})`;
    }
    res.json(manifest);
});

// 2. Endpoint Phụ đề (Subtitles) - Đã sửa lỗi quét mã ngôn ngữ tiếng Việt
app.get('/:config?/subtitles/:type/:id/:extra?.json', async (req, res) => {
    const config = parseConfig(req.params.config) || {};
    const { type, id } = req.params;
    
    const idParts = id.split(':');
    const imdbId = idParts[0];
    const season = idParts[1] ? parseInt(idParts[1]) : null;
    const episode = idParts[2] ? parseInt(idParts[2]) : null;

    let subtitles = [];
    const hostUrl = `${req.protocol}://${req.get('host')}`;
    const geminiKey = (config.geminiKeys && config.geminiKeys[0]) || process.env.GEMINI_API_KEY;
    const modelToUse = config.model || 'gemini-3.6-flash';

    // 1. OpenSubtitles
    try {
        const opensubtitlesKey = config.opensubtitlesKey || process.env.OPEN_SUBTITLES_API_KEY;
        if (opensubtitlesKey) {
            const osParams = { languages: 'vi,en,vie' };
            if (imdbId && imdbId.startsWith('tt')) osParams.imdb_id = imdbId.replace('tt', '');
            if (type === 'series' || (season !== null && episode !== null)) {
                if (season) osParams.season_number = season;
                if (episode) osParams.episode_number = episode;
            }

            const osResponse = await axios.get(`https://api.opensubtitles.com/api/v1/subtitles`, {
                params: osParams,
                headers: { 'Api-Key': opensubtitlesKey, 'User-Agent': 'AiSubtitlePro v1.0.4' },
                timeout: 5000
            });

            if (osResponse.data?.data) {
                for (const item of osResponse.data.data) {
                    const subFile = item.attributes.files[0];
                    const lang = (item.attributes.language || '').toLowerCase();
                    if (!subFile || !subFile.file_id) continue;

                    try {
                        const downloadRes = await axios.post('https://api.opensubtitles.com/api/v1/download', { file_id: subFile.file_id }, {
                            headers: { 'Api-Key': opensubtitlesKey, 'User-Agent': 'AiSubtitlePro v1.0.4', 'Content-Type': 'application/json' },
                            timeout: 4000
                        });
                        const realDownloadUrl = downloadRes.data.link;
                        if (!realDownloadUrl) continue;

                        // Mở rộng bộ lọc ngôn ngữ tiếng Việt
                        if (['vi', 'vie', 'vietnamese', 'viet'].includes(lang)) {
                            subtitles.push({ id: `os-vi-${item.id}`, url: `${hostUrl}/proxy-sub?url=${encodeURIComponent(realDownloadUrl)}`, lang: 'vie' });
                        } else if (['en', 'eng', 'english'].includes(lang) && geminiKey) {
                            subtitles.push({ id: `ai-os-${item.id}`, url: `${hostUrl}/translate-sub?url=${encodeURIComponent(realDownloadUrl)}&key=${encodeURIComponent(geminiKey)}&model=${modelToUse}`, lang: 'vie' });
                        }
                    } catch (errDl) {}
                }
            }
        }
    } catch (e) {
        console.error("OpenSubtitles API Error:", e.response?.status, e.message);
    }

    // 2. Subdl
    try {
        const subdlKey = config.subdlKey;
        if (subdlKey && imdbId) {
            const subdlRes = await axios.get('https://api.subdl.com/api/v1/subtitles', {
                params: { api_key: subdlKey, imdb_id: imdbId, type: type === 'series' ? 'tv' : 'movie', season, episode, languages: 'vi,en,vie' },
                timeout: 5000
            });

            if (subdlRes.data?.subtitles) {
                for (const sub of subdlRes.data.subtitles) {
                    const lang = (sub.lang || '').toLowerCase();
                    let dlUrl = sub.url;
                    if (dlUrl && !dlUrl.startsWith('http')) dlUrl = `https://subdl.com${dlUrl}`;
                    if (!dlUrl) continue;

                    if (['vi', 'vie', 'vietnamese', 'viet'].includes(lang)) {
                        subtitles.push({ id: `subdl-vi-${sub.les_id || Math.random()}`, url: `${hostUrl}/proxy-sub?url=${encodeURIComponent(dlUrl)}`, lang: 'vie' });
                    } else if (['en', 'eng', 'english'].includes(lang) && geminiKey) {
                        subtitles.push({ id: `ai-subdl-${sub.les_id || Math.random()}`, url: `${hostUrl}/translate-sub?url=${encodeURIComponent(dlUrl)}&key=${encodeURIComponent(geminiKey)}&model=${modelToUse}`, lang: 'vie' });
                    }
                }
            }
        }
    } catch (e) {
        console.error("Subdl API Error:", e.response?.status, e.message);
    }

    // 3. Subsource
    try {
        const subsourceKey = config.subsourceKey;
        if (subsourceKey && imdbId) {
            const subsourceRes = await axios.get(`https://api.subsource.dev/api/subtitles`, {
                params: { imdb: imdbId, lang: 'vi,en,vie' },
                headers: { 'Authorization': `Bearer ${subsourceKey}` },
                timeout: 5000
            });

            if (Array.isArray(subsourceRes.data)) {
                for (const sub of subsourceRes.data) {
                    const lang = (sub.language || '').toLowerCase();
                    const dlUrl = sub.url || sub.downloadUrl;
                    if (!dlUrl) continue;

                    if (['vi', 'vie', 'vietnamese', 'viet'].includes(lang)) {
                        subtitles.push({ id: `subsource-vi-${sub.id || Math.random()}`, url: `${hostUrl}/proxy-sub?url=${encodeURIComponent(dlUrl)}&provider=subsource&key=${encodeURIComponent(subsourceKey)}`, lang: 'vie' });
                    } else if (['en', 'eng', 'english'].includes(lang) && geminiKey) {
                        subtitles.push({ id: `ai-subsource-${sub.id || Math.random()}`, url: `${hostUrl}/translate-sub?url=${encodeURIComponent(dlUrl)}&key=${encodeURIComponent(geminiKey)}&model=${modelToUse}`, lang: 'vie' });
                    }
                }
            }
        }
    } catch (e) {
        console.error("Subsource API Error:", e.response?.status, e.message);
    }

    res.json({ subtitles });
});

// 3. Proxy phụ đề gốc an toàn
app.get('/proxy-sub', async (req, res) => {
    const { url, provider, key } = req.query;
    if (!url) return res.status(400).send('Missing URL');

    try {
        const headers = { 'User-Agent': 'AiSubtitlePro v1.0.4' };
        if (provider === 'subsource' && key) headers['Authorization'] = `Bearer ${key}`;

        const response = await axios.get(url, { headers, responseType: 'text', timeout: 8000 });
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send(response.data);
    } catch (error) {
        res.status(500).send('1\n00:00:01,000 --> 00:00:05,000\n[Lỗi tải phụ đề gốc từ nguồn]');
    }
});

// 4. Endpoint Dịch AI dự phòng
app.get('/translate-sub', async (req, res) => {
    const { url, key, model } = req.query;
    if (!url || !key) return res.status(400).send('Missing parameters');

    let originalSrt = "";
    try {
        const subResponse = await axios.get(url, { responseType: 'text', timeout: 6000 });
        originalSrt = typeof subResponse.data === 'string' ? subResponse.data : JSON.stringify(subResponse.data);
    } catch (e) {
        originalSrt = "1\n00:00:01,000 --> 00:00:05,000\n[Không thể tải sub tiếng Anh để dịch]";
    }

    const lineCount = originalSrt.split(/\r?\n/).length;
    const estimatedSeconds = Math.max(3, Math.round(lineCount / 150 * 3));
    const primaryModel = model || 'gemini-3.6-flash';
    const modelsToTry = [primaryModel, 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-1.5-flash'];
    const uniqueModelsToTry = [...new Set(modelsToTry)];

    let aiResponse = null;
    const prompt = `Bạn là một dịch giả chuyên nghiệp. Hãy dịch toàn bộ nội dung file phụ đề SRT sau đây sang tiếng Việt tự nhiên, giữ nguyên cấu hình thời gian (timestamps) và định dạng số thứ tự của file SRT gốc. 
ĐẶC BIỆT: Hãy chèn một dòng phụ đề đầu tiên vào khoảng thời gian từ 00:00:01,000 đến 00:00:06,000 với nội dung thông báo: "🤖 AI Subtitle Pro: Đã dịch thành công ${lineCount} dòng (Xử lý mất ~${estimatedSeconds}s)". Sau đó mới tiếp tục dịch các câu thoại của phim.
Chỉ trả về nội dung SRT đã dịch, không kèm giải thích:\n\n${originalSrt}`;

    for (const m of uniqueModelsToTry) {
        try {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`;
            aiResponse = await axios.post(geminiUrl, {
                contents: [{ parts: [{ text: prompt }] }]
            }, { timeout: 35000 });
            if (aiResponse.data?.candidates?.[0]?.content) break;
        } catch (err) {}
    }

    let translatedSrt = "";
    if (aiResponse && aiResponse.data?.candidates?.[0]?.content) {
        translatedSrt = aiResponse.data.candidates[0].content.parts[0].text;
    } else {
        translatedSrt = `1\n00:00:01,000 --> 00:00:06,000\n🤖 AI Subtitle Pro: Lỗi gọi Gemini API (Kiểm tra lại Key hoặc Hạn mức).\n` + originalSrt;
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(translatedSrt);
});

app.get('/', (req, res) => {
    res.redirect('/configure');
});

app.listen(PORT, () => {
    console.log(`Server đang chạy trên cổng ${PORT}`);
});
