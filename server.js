const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 7000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. Giao diện trang cấu hình (/configure)
app.get('/configure', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cấu hình AI Subtitle Pro</title>
        <style>
            body { background: #121212; color: #fff; font-family: Arial, sans-serif; padding: 20px; display: flex; justify-content: center; }
            .container { width: 100%; max-width: 500px; background: #1e1e1e; padding: 20px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
            h2 { text-align: center; color: #ff5252; margin-bottom: 20px; }
            label { display: block; margin-top: 12px; margin-bottom: 5px; font-size: 13px; color: #ccc; }
            input, select { width: 100%; padding: 10px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 4px; box-sizing: border-box; }
            .btn-install { width: 100%; padding: 12px; background: #e50914; color: #fff; border: none; border-radius: 4px; font-weight: bold; margin-top: 20px; cursor: pointer; }
            .btn-install:hover { background: #b00710; }
            .copy-section { margin-top: 15px; background: #161616; padding: 12px; border-radius: 6px; border: 1px solid #333; }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>Cấu hình AI Subtitle Pro</h2>
            <form id="configForm">
                <label>Mô hình ưu tiên:</label>
                <select id="modelSelect">
                    <option value="gemini-1.5-flash" selected>Gemini 1.5 Flash (Khuyên dùng - Ổn định nhất)</option>
                    <option value="gemini-3.7-flash">Gemini 3.7 Flash</option>
                </select>

                <label>Gemini API Key 1:</label>
                <input type="text" id="geminiKey1" placeholder="AIzaSy..." />

                <label>Gemini API Key 2:</label>
                <input type="text" id="geminiKey2" placeholder="AIzaSy..." />

                <label>Gemini API Key 3:</label>
                <input type="text" id="geminiKey3" placeholder="AIzaSy..." />

                <label>TMDB API Key:</label>
                <input type="text" id="tmdbKey" placeholder="TMDB API Key" />

                <label>OpenSubtitles API Key:</label>
                <input type="text" id="opensubtitlesKey" placeholder="OpenSubtitles Consumer Key" />

                <label>Subsource API Key:</label>
                <input type="text" id="subsourceKey" placeholder="Subsource Key" />

                <label>Subdl API Key:</label>
                <input type="text" id="subdlKey" placeholder="Subdl Key" />

                <label>Phong cách dịch:</label>
                <select id="translationStyle">
                    <option value="natural">Tự nhiên / Chuẩn mực</option>
                    <option value="literal">Sát nghĩa gốc</option>
                </select>

                <button type="button" class="btn-install" id="installBtn">Cài đặt vào Stremio</button>

                <div class="copy-section">
                    <label style="margin-top:0; color:#fff;">Sao chép link cấu hình thủ công (Dành cho Mobile):</label>
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
                        document.getElementById('geminiKey2').value.trim(),
                        document.getElementById('geminiKey3').value.trim()
                    ].filter(k => k),
                    tmdbKey: document.getElementById('tmdbKey').value.trim(),
                    opensubtitlesKey: document.getElementById('opensubtitlesKey').value.trim(),
                    subsourceKey: document.getElementById('subsourceKey').value.trim(),
                    subdlKey: document.getElementById('subdlKey').value.trim(),
                    style: document.getElementById('translationStyle').value
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
                    alert('Không thể tự sao chép, vui lòng bôi đen và copy thủ công.');
                });
            });

            window.onload = updateLink;
        </script>
    </body>
    </html>
    `);
});

// Hàm giải mã config từ URL
function parseConfig(encodedConfig) {
    try {
        return JSON.parse(decodeURIComponent(encodedConfig));
    } catch (e) {
        return null;
    }
}

// Manifest chuẩn có tích hợp configurable: true để hiện nút cấu hình trong Stremio
const defaultManifest = {
    id: 'org.ai.subtitle.pro',
    version: '1.0.0',
    name: 'AI Subtitle Pro',
    description: 'Addon phụ đề tự động tiếng Việt với Gemini và OpenSubtitles',
    types: ['movie', 'series'],
    catalogs: [],
    resources: ['subtitles'],
    behaviorHints: {
        configurable: true
    }
};

// 2. Endpoint Manifest
app.get('/:config?/manifest.json', (req, res) => {
    const config = parseConfig(req.params.config);
    const manifest = { ...defaultManifest };
    if (config && config.model) {
        manifest.name = `AI Subtitle Pro (${config.model})`;
    }
    res.json(manifest);
});

// 3. Endpoint Phụ đề (Subtitles) - Đã cô lập lỗi từng nguồn, chống lỗi 500
app.get('/:config?/subtitles/:type/:id/:extra?.json', async (req, res) => {
    const config = parseConfig(req.params.config) || {};
    const { type, id } = req.params;
    
    const idParts = id.split(':');
    const imdbId = idParts[0];
    const season = idParts[1] || null;
    const episode = idParts[2] || null;

    let subtitles = [];

    // --- OPENSUBTITLES ---
    try {
        const opensubtitlesKey = config.opensubtitlesKey || process.env.OPEN_SUBTITLES_API_KEY;
        if (opensubtitlesKey) {
            const osResponse = await axios.get(`https://api.opensubtitles.com/api/v1/subtitles`, {
                params: {
                    imdb_id: imdbId.replace('tt', ''),
                    season_number: season,
                    episode_number: episode,
                    languages: 'vi,en'
                },
                headers: {
                    'Api-Key': opensubtitlesKey,
                    'User-Agent': 'AiSubtitlePro v1.0.0'
                },
                timeout: 5000
            });

            if (osResponse.data && osResponse.data.data) {
                for (const item of osResponse.data.data) {
                    const subFile = item.attributes.files[0];
                    const lang = item.attributes.language;
                    const fileId = subFile.file_id;

                    try {
                        const downloadRes = await axios.post('https://api.opensubtitles.com/api/v1/download', {
                            file_id: fileId
                        }, {
                            headers: {
                                'Api-Key': opensubtitlesKey,
                                'User-Agent': 'AiSubtitlePro v1.0.0',
                                'Content-Type': 'application/json'
                            },
                            timeout: 4000
                        });

                        const realDownloadUrl = downloadRes.data.link;
                        if (!realDownloadUrl) continue;

                        if (lang === 'vi') {
                            subtitles.push({
                                id: `os-vi-${item.id}`,
                                url: realDownloadUrl,
                                lang: 'vie',
                                file_id: String(fileId)
                            });
                        } else if (lang === 'en') {
                            const modelToUse = config.model || 'gemini-1.5-flash';
                            const geminiKey = (config.geminiKeys && config.geminiKeys[0]) || process.env.GEMINI_API_KEY;

                            if (geminiKey) {
                                subtitles.push({
                                    id: `ai-vi-${item.id}`,
                                    url: `${req.protocol}://${req.get('host')}/translate-sub?url=${encodeURIComponent(realDownloadUrl)}&key=${encodeURIComponent(geminiKey)}&model=${modelToUse}`,
                                    lang: 'vie',
                                    file_id: `ai_${fileId}`
                                });
                            }
                        }
                    } catch (dlErr) {
                        // Bỏ qua lỗi tải file lẻ tẻ
                    }
                }
            }
        }
    } catch (osErr) {
        console.error('OpenSubtitles lỗi (đã bỏ qua):', osErr.message);
    }

    // --- SUBSOURCE ---
    try {
        const subsourceKey = config.subsourceKey || process.env.SUBSOURCE_API_KEY;
        if (subsourceKey) {
            // Khung dự phòng Subsource
        }
    } catch (subSrcErr) {
        console.error('Subsource lỗi (đã bỏ qua):', subSrcErr.message);
    }

    // --- SUBDL ---
    try {
        const subdlKey = config.subdlKey || process.env.SUBDL_API_KEY;
        if (subdlKey) {
            // Khung dự phòng Subdl
        }
    } catch (subDlErr) {
        console.error('Subdl lỗi (đã bỏ qua):', subDlErr.message);
    }

    res.json({ subtitles });
});

// 4. Endpoint dịch phụ đề bằng Gemini
app.get('/translate-sub', async (req, res) => {
    const { url, key, model } = req.query;
    if (!url || !key) return res.status(400).send('Missing parameters');

    try {
        const subResponse = await axios.get(url);
        const originalSrt = subResponse.data;

        const modelName = model || 'gemini-1.5-flash';
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
        
        const prompt = `Bạn là một dịch giả chuyên nghiệp. Hãy dịch toàn bộ nội dung file phụ đề SRT sau đây sang tiếng Việt tự nhiên, giữ nguyên cấu hình thời gian (timestamps) và định dạng số thứ tự của file SRT gốc. Chỉ trả về nội dung SRT đã dịch, không kèm giải thích:\n\n${originalSrt}`;

        const aiResponse = await axios.post(geminiUrl, {
            contents: [{ parts: [{ text: prompt }] }]
        });

        if (!aiResponse.data.candidates || !aiResponse.data.candidates[0].content) {
            throw new Error('Gemini API trả về cấu trúc không hợp lệ.');
        }

        const translatedSrt = aiResponse.data.candidates[0].content.parts[0].text;

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send(translatedSrt);
    } catch (error) {
        console.error('Lỗi dịch phụ đề:', error.response?.data || error.message);
        res.status(500).send(`Lỗi Server: ${error.response?.data?.error?.message || error.message}`);
    }
});

app.get('/', (req, res) => {
    res.redirect('/configure');
});

app.listen(PORT, () => {
    console.log(`Server đang chạy trên cổng ${PORT}`);
});
