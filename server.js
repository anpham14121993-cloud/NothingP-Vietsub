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
                    <option value="gemini-3.7-flash" selected>Gemini 3.7 Flash (Mặc định - Khuyên dùng)</option>
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
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

// Hàm hỗ trợ giải mã config từ URL
function parseConfig(encodedConfig) {
    try {
        return JSON.parse(decodeURIComponent(encodedConfig));
    } catch (e) {
        return null;
    }
}

// Manifest mặc định của Addon
const defaultManifest = {
    id: 'org.ai.subtitle.pro',
    version: '1.0.0',
    name: 'AI Subtitle Pro (Gemini 3.7)',
    description: 'Addon phụ đề tự động tiếng Việt với Gemini 3.7 Flash và OpenSubtitles',
    types: ['movie', 'series'],
    catalogs: [],
    resources: ['subtitles']
};

// 2. Endpoint xử lý Manifest (hỗ trợ cả bản có config cá nhân hóa hoặc bản mặc định)
app.get('/:config?/manifest.json', (req, res) => {
    const config = parseConfig(req.params.config);
    const manifest = { ...defaultManifest };
    if (config && config.model) {
        manifest.name = `AI Subtitle Pro (${config.model})`;
    }
    res.json(manifest);
});

// 3. Endpoint xử lý Phụ đề (Subtitles)
app.get('/:config?/subtitles/:type/:id/:extra?.json', async (req, res) => {
    const config = parseConfig(req.params.config) || {};
    const { type, id } = req.params;
    
    // Nơi tích hợp logic gọi API tìm sub (OpenSubtitles, Subsource, Subdl) và gọi Gemini dịch thuật nếu cần
    // Trả về danh sách phụ đề tương thích với Stremio
    res.json({ subtitles: [] });
});

// Chuyển hướng gốc về trang cấu hình
app.get('/', (req, res) => {
    res.redirect('/configure');
});

app.listen(PORT, () => {
    console.log(`Server đang chạy trên cổng ${PORT}`);
});
