AI SUBTITLE PRO — BẢN VÁ ƯU TIÊN PHỤ ĐỀ VIỆT
Áp dụng cho server.js hiện tại. Đây là các khối thay thế/thêm vào, không phải toàn bộ file.

MỤC TIÊU
- Thu thập kết quả từ cả 3 nguồn trước.
- Nếu có phụ đề Việt gốc: chỉ trả các bản Việt gốc, không tạo lựa chọn AI.
- Nếu không có Việt: mới trả lựa chọn AI từ phụ đề Anh (khi có AI key).
- Không nuốt lỗi API; log tên nguồn và mã lỗi.
- Hỗ trợ config Base64 URL-safe trong đường dẫn.

1) THAY parseConfig hiện tại bằng:

function parseConfig(encodedConfig) {
    if (!encodedConfig) return {};
    try {
        // Base64 URL-safe: '-'/'_' và padding tùy chọn
        let normalized = String(encodedConfig).replace(/-/g, '+').replace(/_/g, '/');
        while (normalized.length % 4) normalized += '=';
        const jsonStr = Buffer.from(normalized, 'base64').toString('utf8');
        return JSON.parse(jsonStr);
    } catch (e) {
        try {
            return JSON.parse(decodeURIComponent(encodedConfig));
        } catch (_) {
            return {};
        }
    }
}

2) Trong script giao diện, thay dòng:
    const encoded = btoa(JSON.stringify(config));
bằng:
    const bytes = new TextEncoder().encode(JSON.stringify(config));
    let binary = '';
    bytes.forEach(byte => binary += String.fromCharCode(byte));
    const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

3) THÊM các helper sau trước hàm handleSubtitles:

function normalizeLang(value) {
    const s = String(value || '').trim().toLowerCase();
    if (['vi', 'vie', 'vietnamese', 'viet', 'tiếng việt', 'tieng viet'].includes(s)) return 'vi';
    if (['en', 'eng', 'english'].includes(s)) return 'en';
    // Một số API trả object/ngôn ngữ có tên hiển thị
    if (/\b(vietnamese|viet|tiếng việt|tieng viet)\b/.test(s)) return 'vi';
    if (/\b(english|eng)\b/.test(s)) return 'en';
    return s;
}

function absoluteUrl(url, base) {
    if (!url) return '';
    try { return new URL(String(url), base).toString(); }
    catch (_) { return ''; }
}

function safeId(value, fallback) {
    return String(value || fallback).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function logSourceError(source, error) {
    const status = error?.response?.status;
    const data = error?.response?.data;
    console.error(`[SUBS][${source}]`, status || error?.code || error?.message || error,
        data ? JSON.stringify(data).slice(0, 500) : '');
}

4) THAY TOÀN BỘ hàm handleSubtitles hiện tại bằng:

async function handleSubtitles(req, res, encodedConfig) {
    const config = parseConfig(encodedConfig);
    const { type } = req.params;
    const rawId = String(req.params.id || '');
    const idParts = rawId.split(':');
    const imdbId = idParts[0];
    const season = idParts[1] ? Number.parseInt(idParts[1], 10) : null;
    const episode = idParts[2] ? Number.parseInt(idParts[2], 10) : null;

    const hostUrl = `${req.protocol}://${req.get('host')}`;
    const hasAiKey = Boolean((config.geminiKeys || []).filter(Boolean).length ||
        config.openaiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY);
    const modelToUse = config.model || 'gemini-2.5-flash';

    // Chỉ thu thập bản gốc ở giai đoạn đầu; chưa tạo AI ngay.
    const vietnamese = [];
    const english = [];
    const seen = new Set();

    function addSubtitle({ source, sourceId, lang, url, provider, key }) {
        const normalizedLang = normalizeLang(lang);
        if (!url || !['vi', 'en'].includes(normalizedLang)) return;
        const dedupeKey = `${normalizedLang}|${url}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        const proxyParams = new URLSearchParams({ url });
        if (provider) proxyParams.set('provider', provider);
        if (key) proxyParams.set('key', key);

        const item = {
            id: `${source}-${normalizedLang}-${safeId(sourceId, vietnamese.length + english.length + 1)}`,
            url: `${hostUrl}/proxy-sub?${proxyParams.toString()}`,
            lang: normalizedLang === 'vi' ? 'vie' : 'eng',
            name: `${source} [${normalizedLang.toUpperCase()}]`
        };
        (normalizedLang === 'vi' ? vietnamese : english).push(item);
    }

    // OpenSubtitles
    if (config.opensubtitlesKey) {
        try {
            const osParams = { languages: 'vi,en' };
            if (imdbId?.startsWith('tt')) osParams.imdb_id = imdbId.slice(2);
            if (type === 'series' && Number.isInteger(season) && Number.isInteger(episode)) {
                osParams.season_number = season;
                osParams.episode_number = episode;
            }
            const response = await axios.get('https://api.opensubtitles.com/api/v1/subtitles', {
                params: osParams,
                headers: {
                    'Api-Key': config.opensubtitlesKey,
                    'User-Agent': 'AiSubtitlePro v1.4.0'
                },
                timeout: 10000
            });

            const rows = Array.isArray(response.data?.data) ? response.data.data : [];
            for (const item of rows) {
                const attrs = item?.attributes || {};
                const file = Array.isArray(attrs.files) ? attrs.files[0] : null;
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
                    const downloadUrl = download.data?.link;
                    addSubtitle({
                        source: 'OpenSubtitles',
                        sourceId: item.id || file.file_id,
                        lang,
                        url: absoluteUrl(downloadUrl, 'https://www.opensubtitles.com'),
                    });
                } catch (error) {
                    logSourceError('OpenSubtitles download', error);
                }
            }
        } catch (error) {
            logSourceError('OpenSubtitles search', error);
        }
    }

    // Subdl — chấp nhận cả url/path và các tên trường ngôn ngữ thường gặp.
    if (config.subdlKey && imdbId) {
        try {
            const response = await axios.get('https://api.subdl.com/api/v1/subtitles', {
                params: {
                    api_key: config.subdlKey,
                    imdb_id: imdbId,
                    type: type === 'series' ? 'tv' : 'movie',
                    ...(Number.isInteger(season) ? { season } : {}),
                    ...(Number.isInteger(episode) ? { episode } : {}),
                    languages: 'vi,en'
                },
                timeout: 10000
            });
            const rows = Array.isArray(response.data?.subtitles) ? response.data.subtitles : [];
            for (const sub of rows) {
                const lang = normalizeLang(sub.lang || sub.language || sub.language_name);
                const url = absoluteUrl(sub.url || sub.download_url || sub.downloadUrl, 'https://subdl.com');
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

    // Subsource — chấp nhận response dạng array hoặc object có danh sách con.
    if (config.subsourceKey && imdbId) {
        try {
            const response = await axios.get('https://api.subsource.dev/api/subtitles', {
                params: { imdb: imdbId, lang: 'vi,en' },
                headers: { Authorization: `Bearer ${config.subsourceKey}` },
                timeout: 10000
            });
            const body = response.data;
            const rows = Array.isArray(body) ? body :
                (Array.isArray(body?.subtitles) ? body.subtitles :
                (Array.isArray(body?.data) ? body.data : []));

            for (const sub of rows) {
                const lang = normalizeLang(sub.language || sub.lang || sub.language_name);
                const url = absoluteUrl(sub.url || sub.downloadUrl || sub.download_url, 'https://api.subsource.dev');
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

    // Ưu tiên tuyệt đối phụ đề Việt gốc. Nếu có dù chỉ một bản Việt,
    // không trả lựa chọn AI và không gọi endpoint dịch.
    let subtitles;
    if (vietnamese.length > 0) {
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
        // Không có Việt và không có AI: vẫn cung cấp sub Anh thay vì thông báo lỗi giả.
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
    res.json({ subtitles });
}

5) THAY endpoint /proxy-sub bằng bản có kiểm tra URL và hỗ trợ nội dung nén:

app.get('/proxy-sub', async (req, res) => {
    const { url, provider, key } = req.query;
    if (!url) return res.status(400).send('Missing URL');

    let parsed;
    try { parsed = new URL(String(url)); }
    catch (_) { return res.status(400).send('Invalid URL'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        return res.status(400).send('Unsupported URL protocol');
    }

    try {
        const headers = { 'User-Agent': 'AiSubtitlePro v1.4.0' };
        if (provider === 'subsource' && key) headers.Authorization = `Bearer ${key}`;

        const response = await axios.get(parsed.toString(), {
            headers,
            responseType: 'arraybuffer',
            timeout: 15000,
            maxRedirects: 5
        });

        let body = Buffer.from(response.data);
        // Một số API trả file nén ZIP. Không giả vờ trả ZIP thành SRT.
        const contentType = String(response.headers['content-type'] || '').toLowerCase();
        const isZip = body.length >= 2 && body[0] === 0x50 && body[1] === 0x4b;
        if (isZip || contentType.includes('zip')) {
            return res.status(415).type('text/plain').send(
                'Nguồn trả file ZIP; cần giải nén file subtitle trước khi Stremio có thể đọc.'
            );
        }

        let text = body.toString('utf8').replace(/^\uFEFF/, '');
        // Nếu UTF-8 bị lỗi, thử Windows-1252 để không làm hỏng hoàn toàn ký tự.
        if (text.includes('\uFFFD')) text = body.toString('latin1');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send(text);
    } catch (error) {
        logSourceError('proxy-sub', error);
        res.status(502).type('text/plain').send(
            '1\n00:00:01,000 --> 00:00:05,000\n[Lỗi tải phụ đề gốc từ nguồn]'
        );
    }
});

6) LƯU Ý QUAN TRỌNG
- Đây là bản vá dựa trên cấu trúc API mà code hiện tại đang giả định. Nếu Subdl/Subsource dùng tên trường khác, log sẽ cho biết response bị bỏ qua; cần xem JSON thực tế để bổ sung đúng trường.
- Không gửi API Key thật trong ảnh/log/chat. Nếu đã công khai key, hãy thu hồi và tạo key mới.
- Sau deploy, mở log Render và gọi lại subtitle endpoint. Dòng log mong đợi có dạng:
  [SUBS] movie/tt1234567: vi=..., en=..., returned=...
- Nếu vi > 0, danh sách trả về chỉ gồm bản Việt gốc; AI không được thêm vào.
- Lưu ý: nếu Stremio vẫn hiện lựa chọn AI cũ, hãy tải lại addon/đóng mở lại phim để làm mới danh sách.
