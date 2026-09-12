const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// Parse Base64 (including URL-safe Base64) or URI-encoded JSON config.
function parseConfig(encodedConfig) {
    if (!encodedConfig) return {};
    try {
        let normalized = String(encodedConfig)
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        while (normalized.length % 4) normalized += '=';
        const parsed = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
        try {
            const parsed = JSON.parse(decodeURIComponent(String(encodedConfig)));
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (_) {
            return {};
        }
    }
}

function normalizeLang(value) {
    const s = String(value || '').trim().toLowerCase();
    if (['vi', 'vie', 'vietnamese', 'viet', 'tiếng việt', 'tieng viet'].includes(s)) return 'vi';
    if (['en', 'eng', 'english'].includes(s)) return 'en';
    if (/(^|[^a-z])(vietnamese|viet)([^a-z]|$)|tiếng việt|tieng viet/.test(s)) return 'vi';
    if (/(^|[^a-z])english([^a-z]|$)/.test(s)) return 'en';
    return s;
}

function absoluteUrl(value, base) {
    if (!value) return '';
    try {
        const result = new URL(String(value), base);
        return ['http:', 'https:'].includes(result.protocol) ? result.toString() : '';
    } catch (_) {
        return '';
    }
}

function safeId(value, fallback) {
    return String(value || fallback).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function logSourceError(source, error) {
    const status = error?.response?.status;
    const data = error?.response?.data;
    console.error(
        `[SUBS][${source}]`,
        status || error?.code || error?.message || error,
        data ? String(typeof data === 'string' ? data : JSON.stringify(data)).slice(0, 500) : ''
    );
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

// 1. Homepage redirects to configuration.
app.get('/', (req, res) => res.redirect('/configure'));

// 2. Configuration page.
app.get('/configure', (req, res) => renderConfigPage(req, res, {}));
app.get('/:config/configure', (req, res) => {
    renderConfigPage(req, res, parseConfig(req.params.config));
});

function renderConfigPage(req, res, savedConfig) {
    const keys = Array.isArray(savedConfig.geminiKeys) ? savedConfig.geminiKeys : [];
    res.send(`
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cấu hình AI Subtitle Pro</title>
<style>
body{background:#121212;color:#fff;font-family:Arial,sans-serif;padding:20px;display:flex;justify-content:center}
.container{width:100%;max-width:520px;background:#1e1e1e;padding:20px;border-radius:8px;box-shadow:0 4px 10px rgba(0,0,0,.5)}
h2{text-align:center;color:#ff5252;margin-bottom:20px}
label{display:block;margin-top:12px;margin-bottom:5px;font-size:13px;color:#ccc}
input,select{width:100%;padding:10px;background:#2a2a2a;border:1px solid #444;color:#fff;border-radius:4px;box-sizing:border-box}
.section-title{color:#4fc3f7;margin-top:18px;font-size:14px;font-weight:bold;border-bottom:1px solid #333;padding-bottom:4px}
.btn-install{width:100%;padding:12px;background:#e50914;color:#fff;border:0;border-radius:4px;font-weight:bold;margin-top:20px;cursor:pointer}
.btn-install:hover{background:#b00710}
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
<label>Gemini API Key 1:</label><input type="password" id="geminiKey1" value="${escapeHtml(keys[0] || '')}" placeholder="AIzaSy..." />
<label>Gemini API Key 2 (Dự phòng):</label><input type="password" id="geminiKey2" value="${escapeHtml(keys[1] || '')}" placeholder="AIzaSy..." />
<label>Gemini API Key 3 (Dự phòng):</label><input type="password" id="geminiKey3" value="${escapeHtml(keys[2] || '')}" placeholder="AIzaSy..." />
<label>OpenAI / ChatGPT API Key:</label><input type="password" id="openaiKey" value="${escapeHtml(savedConfig.openaiKey || '')}" placeholder="sk-proj-..." />

<div class="section-title">📥 Cấu hình Nguồn Phụ Đề</div>
<label>OpenSubtitles API Key:</label><input type="password" id="opensubtitlesKey" value="${escapeHtml(savedConfig.opensubtitlesKey || '')}" placeholder="Consumer Key từ opensubtitles.com" />
<label>Subdl API Key:</label><input type="password" id="subdlKey" value="${escapeHtml(savedConfig.subdlKey || '')}" placeholder="API Key từ subdl.com" />
<label>Subsource API Key:</label><input type="password" id="subsourceKey" value="${escapeHtml(savedConfig.subsourceKey || '')}" placeholder="Bearer Token từ Subsource" />
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
        ].filter(Boolean),
        openaiKey: document.getElementById('openaiKey').value.trim(),
        opensubtitlesKey: document.getElementById('opensubtitlesKey').value.trim(),
        subdlKey: document.getElementById('subdlKey').value.trim(),
        subsourceKey: document.getElementById('subsourceKey').value.trim()
    };
    const bytes = new TextEncoder().encode(JSON.stringify(config));
    let binary = '';
    bytes.forEach(byte => binary += String.fromCharCode(byte));
    const encoded = btoa(binary).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/g, '');
    const currentUrl = window.location.origin;
    const addonUrl = currentUrl + '/' + encoded + '/manifest.json';
    window.location.href = 'stremio://' + addonUrl.replace(/^https?:\\/\\//, '');
});
</script>
</body>
</html>
`);
}

// 3. Addon manifest. Keep version unchanged.
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

// 4. Search all configured subtitle sources. Original Vietnamese subtitles
// always take precedence over AI-generated choices.
async function handleSubtitles(req, res, encodedConfig) {
    const config = parseConfig(encodedConfig);
    const { type } = req.params;
    const rawId = String(req.params.id || '');
    const parts = rawId.split(':');
    const imdbId = parts[0];
    const season = parts[1] ? Number.parseInt(parts[1], 10) : null;
    const episode = parts[2] ? Number.parseInt(parts[2], 10) : null;
    const hostUrl = `${req.protocol}://${req.get('host')}`;

    const geminiKeys = Array.isArray(config.geminiKeys) ? config.geminiKeys.filter(Boolean) : [];
    const hasAiKey = Boolean(
        geminiKeys.length || config.openaiKey ||
        process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY
    );
    const modelToUse = config.model || 'gemini-2.5-flash';

    const vietnamese = [];
    const english = [];
    const seen = new Set();

    function addSubtitle({ source, sourceId, lang, url, provider, key }) {
        const normalizedLang = normalizeLang(lang);
        if (!url || !['vi', 'en'].includes(normalizedLang)) return;

        const dedupeKey = `${normalizedLang}|${url}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        const query = new URLSearchParams({ url });
        if (provider) query.set('provider', provider);
        if (key) query.set('key', key);

        const item = {
            id: `${source}-${normalizedLang}-${safeId(sourceId, vietnamese.length + english.length + 1)}`,
            url: `${hostUrl}/proxy-sub?${query.toString()}`,
            lang: normalizedLang === 'vi' ? 'vie' : 'eng',
            name: `${source} [${normalizedLang.toUpperCase()}]`
        };
        (normalizedLang === 'vi' ? vietnamese : english).push(item);
    }

    // OpenSubtitles
    if (config.opensubtitlesKey) {
        try {
            const params = { languages: 'vi,en' };
            if (imdbId.startsWith('tt')) params.imdb_id = imdbId.slice(2);
            if (type === 'series' && Number.isInteger(season) && Number.isInteger(episode)) {
                params.season_number = season;
                params.episode_number = episode;
            }

            const response = await axios.get('https://api.opensubtitles.com/api/v1/subtitles', {
                params,
                headers: {
                    'Api-Key': config.opensubtitlesKey,
                    'User-Agent': 'AiSubtitlePro v1.4.0'
                },
                timeout: 10000
            });

            const rows = Array.isArray(response.data?.data) ? response.data.data : [];
            // Do not stop at the first five results; inspect up to 30 returned records.
            for (const item of rows.slice(0, 30)) {
                const attrs = item?.attributes || {};
                const files = Array.isArray(attrs.files) ? attrs.files : [];
                const file = files[0];
                const lang = normalizeLang(attrs.language);
                if (!file?.file_id || !['vi', 'en'].includes(lang)) continue;

                try {
                    const download = await axios.post(
                        'https://api.opensubtitles.com/api/v1/download',
                        { file_id: file.file_id },
                        {
                            headers: {
                                'Api-Key': config.opensubtitlesKey,
                                'User-Agent': 'AiSubtitlePro v1.4.0',
                                'Content-Type': 'application/json'
                            },
                            timeout: 10000
                        }
                    );
                    addSubtitle({
                        source: 'OpenSubtitles',
                        sourceId: item.id || file.file_id,
                        lang,
                        url: absoluteUrl(download.data?.link, 'https://www.opensubtitles.com')
                    });
                } catch (error) {
                    logSourceError('OpenSubtitles download', error);
                }
            }
        } catch (error) {
            logSourceError('OpenSubtitles search', error);
        }
    }

    // Subdl
    if (config.subdlKey && imdbId) {
        try {
            const params = {
                api_key: config.subdlKey,
                imdb_id: imdbId,
                type: type === 'series' ? 'tv' : 'movie',
                languages: 'vi,en'
            };
            if (Number.isInteger(season)) params.season = season;
            if (Number.isInteger(episode)) params.episode = episode;

            const response = await axios.get('https://api.subdl.com/api/v1/subtitles', {
                params,
                timeout: 10000
            });
            const rows = Array.isArray(response.data?.subtitles) ? response.data.subtitles : [];

            for (const sub of rows.slice(0, 30)) {
                const lang = normalizeLang(sub.lang || sub.language || sub.language_name);
                const url = absoluteUrl(
                    sub.url || sub.download_url || sub.downloadUrl,
                    'https://subdl.com'
                );
                addSubtitle({
                    source: 'Subdl',
                    sourceId: sub.les_id || sub.id || sub.release_name,
                    lang,
                    url
                });
            }
        } catch (error) {
            logSourceError('Subdl', error);
        }
    }

    // Subsource
    if (config.subsourceKey && imdbId) {
        try {
            const response = await axios.get('https://api.subsource.dev/api/subtitles', {
                params: { imdb: imdbId, lang: 'vi,en' },
                headers: { Authorization: `Bearer ${config.subsourceKey}` },
                timeout: 10000
            });

            const body = response.data;
            const rows = Array.isArray(body) ? body :
                Array.isArray(body?.subtitles) ? body.subtitles :
                Array.isArray(body?.data) ? body.data : [];

            for (const sub of rows.slice(0, 30)) {
                const lang = normalizeLang(sub.language || sub.lang || sub.language_name);
                const url = absoluteUrl(
                    sub.url || sub.downloadUrl || sub.download_url,
                    'https://api.subsource.dev'
                );
                addSubtitle({
                    source: 'Subsource',
                    sourceId: sub.id || sub.subtitle_id || sub.name,
                    lang,
                    url,
                    provider: 'subsource',
                    key: config.subsourceKey
                });
            }
        } catch (error) {
            logSourceError('Subsource', error);
        }
    }

    let subtitles;
    if (vietnamese.length > 0) {
        // If even one original Vietnamese subtitle exists, never expose AI entries.
        subtitles = vietnamese;
    } else if (hasAiKey && english.length > 0) {
        subtitles = english.map((sub, index) => ({
            ...sub,
            id: `ai-${sub.id}-${index + 1}`,
            url: `${hostUrl}/translate-sub?url=${encodeURIComponent(sub.url)}&model=${encodeURIComponent(modelToUse)}&config=${encodeURIComponent(encodedConfig || '')}`,
            lang: 'vie',
            name: `🤖 AI Dịch (${modelToUse}) — ${sub.name}`
        }));
    } else if (english.length > 0) {
        subtitles = english;
    } else {
        subtitles = [{
            id: 'ai-notice',
            url: 'https://raw.githubusercontent.com/SubtitleEdit/subtitleedit/master/CHANGELOG.txt',
            lang: 'vie',
            name: '⚠️ Không tìm thấy phụ đề phù hợp. Kiểm tra API Key và log Render.'
        }];
    }

    console.log(`[SUBS] ${type}/${rawId}: vi=${vietnamese.length}, en=${english.length}, returned=${subtitles.length}`);
    return res.json({ subtitles });
}

// 5. Proxy original subtitle file.
app.get('/proxy-sub', async (req, res) => {
    const { url, provider, key } = req.query;
    if (!url) return res.status(400).send('Missing URL');

    const target = absoluteUrl(url);
    if (!target) return res.status(400).send('Invalid URL');

    try {
        const headers = { 'User-Agent': 'AiSubtitlePro v1.4.0' };
        if (provider === 'subsource' && key) {
            headers.Authorization = `Bearer ${key}`;
        }

        const response = await axios.get(target, {
            headers,
            responseType: 'arraybuffer',
            timeout: 15000,
            maxRedirects: 5
        });

        const body = Buffer.from(response.data);
        const contentType = String(response.headers['content-type'] || '').toLowerCase();
        const isZip = body.length >= 2 && body[0] === 0x50 && body[1] === 0x4b;
        if (isZip || contentType.includes('zip')) {
            return res.status(415).type('text/plain').send(
                'Nguồn trả file ZIP; cần giải nén file phụ đề trước khi Stremio đọc được.'
            );
        }

        let text = body.toString('utf8').replace(/^\uFEFF/, '');
        if (text.includes('\uFFFD')) text = body.toString('latin1');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.send(text);
    } catch (error) {
        logSourceError('proxy-sub', error);
        return res.status(502).type('text/plain').send(
            '1\n00:00:01,000 --> 00:00:05,000\n[Lỗi tải phụ đề gốc từ nguồn]'
        );
    }
});

// 6. AI translation endpoint.
app.get('/translate-sub', async (req, res) => {
    const { url, model, config: configQuery } = req.query;
    if (!url) return res.status(400).send('Missing URL');

    const config = parseConfig(configQuery);
    const geminiKeys = Array.isArray(config.geminiKeys) && config.geminiKeys.length
        ? config.geminiKeys.filter(Boolean)
        : [process.env.GEMINI_API_KEY].filter(Boolean);
    const openaiKey = config.openaiKey || process.env.OPENAI_API_KEY;
    const selectedModel = model || config.model || 'gemini-2.5-flash';

    let originalSrt = '';
    try {
        const sourceUrl = absoluteUrl(url);
        if (!sourceUrl) throw new Error('Invalid subtitle URL');
        const response = await axios.get(sourceUrl, { responseType: 'text', timeout: 10000 });
        originalSrt = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    } catch (error) {
        logSourceError('translate-sub source', error);
        return res.status(502).type('text/plain').send(
            '1\n00:00:01,000 --> 00:00:05,000\n[Không thể tải phụ đề nguồn để dịch]'
        );
    }

    const prompt = `Bạn là dịch giả chuyên nghiệp. Hãy dịch toàn bộ nội dung file phụ đề SRT sau sang tiếng Việt tự nhiên, giữ nguyên cấu trúc thời gian (timestamps) và số thứ tự của SRT gốc. Chỉ trả về nội dung SRT đã dịch, không kèm giải thích:\n\n${originalSrt}`;

    let translatedSrt = '';
    let success = false;

    if (selectedModel.startsWith('gpt-') && openaiKey) {
        try {
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: selectedModel,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3
            }, {
                headers: {
                    Authorization: `Bearer ${openaiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 45000
            });
            translatedSrt = response.data?.choices?.[0]?.message?.content || '';
            success = Boolean(translatedSrt);
        } catch (error) {
            logSourceError('OpenAI translation', error);
        }
    }

    if (!success && geminiKeys.length > 0) {
        const models = [...new Set([
            selectedModel,
            'gemini-2.5-flash',
            'gemini-2.5-pro',
            'gemini-2.0-flash'
        ].filter(name => name && !name.startsWith('gpt-')))];

        for (const key of geminiKeys) {
            for (const modelName of models) {
                try {
                    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(key)}`;
                    const response = await axios.post(endpoint, {
                        contents: [{ parts: [{ text: prompt }] }]
                    }, { timeout: 35000 });

                    translatedSrt = response.data?.candidates?.[0]?.content?.parts
                        ?.map(part => part.text || '').join('') || '';
                    if (translatedSrt) {
                        success = true;
                        break;
                    }
                } catch (error) {
                    logSourceError(`Gemini ${modelName}`, error);
                }
            }
            if (success) break;
        }
    }

    if (!success) {
        translatedSrt = `1\n00:00:01,000 --> 00:00:05,000\n🤖 AI Subtitle Pro: Lỗi dịch AI (Kiểm tra API Key hoặc hạn mức).\n` + originalSrt;
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(translatedSrt);
});

// 7. Subtitle routes used by Stremio.
app.get('/subtitles/:type/:id.json', (req, res) => handleSubtitles(req, res, null));
app.get('/subtitles/:type/:id/:extra.json', (req, res) => handleSubtitles(req, res, null));
app.get('/:config/subtitles/:type/:id.json', (req, res) => handleSubtitles(req, res, req.params.config));
app.get('/:config/subtitles/:type/:id/:extra.json', (req, res) => handleSubtitles(req, res, req.params.config));

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
