const express = require('express');
const { addonBuilder, getRouter } = require('stremio-addon-sdk');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 7000;

// --- 1. QUẢN LÝ KHO KEY & CONFIG THÔNG MINH ---
class ConfigManager {
    constructor(env) {
        this.env = env;
    }

    getGeminiPool(userKeyStr) {
        let serverKeys = this.env.GEMINI_API_KEYS ? this.env.GEMINI_API_KEYS.split(',').map(k => k.trim()).filter(Boolean) : [];
        let userKeys = userKeyStr ? userKeyStr.split(',').map(k => k.trim()).filter(Boolean) : [];
        return [...new Set([...userKeys, ...serverKeys])];
    }

    getOpenAIPool(userKeyStr) {
        let serverKeys = this.env.OPENAI_API_KEYS ? this.env.OPENAI_API_KEYS.split(',').map(k => k.trim()).filter(Boolean) : [];
        let userKeys = userKeyStr ? userKeyStr.split(',').map(k => k.trim()).filter(Boolean) : [];
        return [...new Set([...userKeys, ...serverKeys])];
    }

    getTmdbKey(userKey) { return userKey || this.env.TMDB_API_KEY || ''; }
    getOpenSubtitlesKey(userKey) { return userKey || this.env.OPENSUBTITLES_API_KEY || ''; }
    getSubsourceKey(userKey) { return userKey || this.env.SUBSOURCE_API_KEY || ''; }
    getSubdlKey(userKey) { return userKey || this.env.SUBDL_API_KEY || ''; }
}

const configManager = new ConfigManager(process.env);

// --- 2. LẤY BỐI CẢNH PHIM TỪ TMDB ---
async function getMovieContextFromTMDB(imdbId, apiKey) {
    if (!apiKey) return "Bối cảnh phim tổng quát.";
    try {
        const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${apiKey}&external_source=imdb_id`;
        const findRes = await axios.get(findUrl);
        let media = findRes.data.movie_results?.[0] || findRes.data.tv_results?.[0];
        if (!media) return "Không có thông tin bối cảnh cụ thể.";
        return `Tên phim: "${media.title || media.name}". Cốt truyện: ${media.overview || 'Không có tóm tắt.'}`;
    } catch (error) {
        console.warn("[TMDB] Lỗi lấy bối cảnh:", error.message);
        return "Bối cảnh phim tổng quát.";
    }
}

// --- 3. HỆ THỐNG TÌM KIẾM VÀ TẢI PHỤ ĐỀ ---
async function fetchVietnameseSubtitle(imdbId, type, season, episode, config) {
    const osKey = configManager.getOpenSubtitlesKey(config?.os);
    const ssKey = configManager.getSubsourceKey(config?.ss);
    const sdlKey = configManager.getSubdlKey(config?.sdl);

    if (osKey) {
        try {
            let url = `https://api.opensubtitles.com/api/v1/subtitles?imdb_id=${imdbId.replace('tt', '')}&languages=vi`;
            if (type === 'series' && season && episode) url += `&season_number=${season}&episode_number=${episode}`;
            const res = await axios.get(url, { headers: { 'Api-Key': osKey, 'User-Agent': 'AISubtitleAddon v1.0' } });
            const files = res.data?.data;
            if (files && files.length > 0) {
                const fileId = files[0].attributes.files[0].file_id;
                const downloadReq = await axios.post('https://api.opensubtitles.com/api/v1/download', { file_id: fileId }, { headers: { 'Api-Key': osKey } });
                if (downloadReq.data?.link) {
                    const srtRes = await axios.get(downloadReq.data.link, { responseType: 'text' });
                    console.log("[OpenSubtitles] Đã tìm thấy bản TIẾNG VIỆT có sẵn!");
                    return srtRes.data;
                }
            }
        } catch (e) {}
    }

    if (ssKey) {
        try {
            let url = `https://api.subsource.net/subtitles?imdbId=${imdbId}&lang=vi`;
            const res = await axios.get(url, { headers: { 'Authorization': `Bearer ${ssKey}` } });
            const sub = res.data?.subtitles?.find(s => s.lang === 'Vietnamese' || s.lang === 'vi');
            if (sub && sub.link) {
                const srtRes = await axios.get(sub.link, { responseType: 'text' });
                console.log("[Subsource] Đã tìm thấy bản TIẾNG VIỆT có sẵn!");
                return srtRes.data;
            }
        } catch (e) {}
    }

    if (sdlKey) {
        try {
            let url = `https://api.subdl.com/api/v2/subtitles/search?imdb_id=${imdbId}&languages=vi`;
            const res = await axios.get(url, { headers: { 'Authorization': `Bearer ${sdlKey}` } });
            if (res.data?.status && res.data?.subtitles?.length > 0) {
                let sub = res.data.subtitles.find(s => {
                    if (type === 'series' && season && episode) return s.season === season && s.episode === episode;
                    return true;
                }) || res.data.subtitles[0];
                if (sub && sub.url) {
                    const downloadUrl = sub.url.startsWith('http') ? sub.url : `https://dl.subdl.com${sub.url}`;
                    const srtRes = await axios.get(downloadUrl, { responseType: 'text' });
                    console.log("[Subdl] Đã tìm thấy bản TIẾNG VIỆT có sẵn!");
                    return srtRes.data;
                }
            }
        } catch (e) {}
    }

    return null;
}

async function fetchEnglishSubtitle(imdbId, type, season, episode, config) {
    const osKey = configManager.getOpenSubtitlesKey(config?.os);
    const ssKey = configManager.getSubsourceKey(config?.ss);
    const sdlKey = configManager.getSubdlKey(config?.sdl);

    if (osKey) {
        try {
            let url = `https://api.opensubtitles.com/api/v1/subtitles?imdb_id=${imdbId.replace('tt', '')}&languages=en`;
            if (type === 'series' && season && episode) url += `&season_number=${season}&episode_number=${episode}`;
            const res = await axios.get(url, { headers: { 'Api-Key': osKey, 'User-Agent': 'AISubtitleAddon v1.0' } });
            const files = res.data?.data;
            if (files && files.length > 0) {
                const fileId = files[0].attributes.files[0].file_id;
                const downloadReq = await axios.post('https://api.opensubtitles.com/api/v1/download', { file_id: fileId }, { headers: { 'Api-Key': osKey } });
                if (downloadReq.data?.link) {
                    const srtRes = await axios.get(downloadReq.data.link, { responseType: 'text' });
                    console.log("[OpenSubtitles] Tải phụ đề tiếng Anh gốc thành công!");
                    return srtRes.data;
                }
            }
        } catch (e) {}
    }

    if (ssKey) {
        try {
            let url = `https://api.subsource.net/subtitles?imdbId=${imdbId}&lang=en`;
            const res = await axios.get(url, { headers: { 'Authorization': `Bearer ${ssKey}` } });
            const sub = res.data?.subtitles?.find(s => s.lang === 'English' || s.lang === 'en');
            if (sub && sub.link) {
                const srtRes = await axios.get(sub.link, { responseType: 'text' });
                console.log("[Subsource] Tải phụ đề tiếng Anh gốc thành công!");
                return srtRes.data;
            }
        } catch (e) {}
    }

    if (sdlKey) {
        try {
            let url = `https://api.subdl.com/api/v2/subtitles/search?imdb_id=${imdbId}&languages=en`;
            const res = await axios.get(url, { headers: { 'Authorization': `Bearer ${sdlKey}` } });
            if (res.data?.status && res.data?.subtitles?.length > 0) {
                let sub = res.data.subtitles.find(s => {
                    if (type === 'series' && season && episode) return s.season === season && s.episode === episode;
                    return true;
                }) || res.data.subtitles[0];
                if (sub && sub.url) {
                    const downloadUrl = sub.url.startsWith('http') ? sub.url : `https://dl.subdl.com${sub.url}`;
                    const srtRes = await axios.get(downloadUrl, { responseType: 'text' });
                    console.log("[Subdl] Tải phụ đề tiếng Anh gốc thành công!");
                    return srtRes.data;
                }
            }
        } catch (e) {}
    }

    return null;
}

// --- 4. CÁC HÀM GỌI API AI ---
async function callGemini(apiKey, prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${apiKey}`;
    const res = await axios.post(url, { contents: [{ parts: [{ text: prompt }] }] });
    return res.data.candidates[0].content.parts[0].text;
}

async function callOpenAI(apiKey, prompt) {
    const url = 'https://api.openai.com/v1/chat/completions';
    const res = await axios.post(url, {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
    }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    });
    return res.data.choices[0].message.content;
}

async function translateWithAI(srtText, movieContext, styleCode, config) {
    const styleInstruction = {
        genz: "Dịch phụ đề theo phong cách trẻ trung, hiện đại, bắt trend Gen Z.",
        formal: "Dịch phụ đề trang trọng, chuẩn mực, phù hợp phim chính kịch.",
        historical: "Dịch phụ đề cổ trang/kiếm hiệp, xưng hô phù hợp.",
        natural: "Dịch phụ đề tiếng Việt tự nhiên, trôi chảy hàng ngày."
    }[styleCode] || "Dịch tự nhiên.";

    const prompt = `[VAI TRÒ]: Dịch giả phụ đề phim chuyên nghiệp.\n[PHONG CÁCH]: ${styleInstruction}\n[BỐI CẢNH]: ${movieContext}\n[NHIỆM VỤ]: Dịch SRT sau sang tiếng Việt, giữ nguyên định dạng và mốc thời gian.\n\n${srtText}`;

    const geminiPool = configManager.getGeminiPool(config?.g);
    const openaiPool = configManager.getOpenAIPool(config?.o);
    const priority = config?.m || 'gemini';

    let firstPool = geminiPool, firstType = 'Gemini';
    let secondPool = openaiPool, secondType = 'OpenAI';

    if (priority === 'openai' && openaiPool.length > 0) {
        firstPool = openaiPool; firstType = 'OpenAI';
        secondPool = geminiPool; secondType = 'Gemini';
    }

    async function tryRunPool(pool, typeName) {
        for (const apiKey of pool) {
            try {
                console.log(`[AI Dispatcher] Đang dịch qua ${typeName} (Key đuôi: ...${apiKey.slice(-4)})`);
                if (typeName === 'Gemini') return await callGemini(apiKey, prompt);
                else return await callOpenAI(apiKey, prompt);
            } catch (e) {
                console.warn(`[${typeName}] Key lỗi hoặc quá tải, chuyển key tiếp theo...`);
            }
        }
        throw new Error(`${typeName} pool exhausted.`);
    }

    try {
        return await tryRunPool(firstPool, firstType);
    } catch (err1) {
        if (secondPool.length > 0) {
            try { return await tryRunPool(secondPool, secondType); } catch (err2) {}
        }
        throw new Error("Tất cả mô hình AI đều thất bại.");
    }
}

// --- 5. TRANG CẤU HÌNH (CONFIGURE UI) ---
app.get('/configure', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <title>Cấu hình AI Subtitle Pro</title>
            <style>
                body { font-family: Arial; background: #141414; color: #fff; padding: 20px; display: flex; justify-content: center; }
                .card { width: 100%; max-width: 480px; background: #1f1f1f; padding: 25px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
                input, select { width: 100%; padding: 10px; margin: 6px 0 12px 0; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 5px; box-sizing: border-box; }
                button { width: 100%; padding: 12px; background: #e50914; color: white; border: none; font-weight: bold; border-radius: 5px; cursor: pointer; }
                button:hover { background: #b20710; }
                label { font-size: 13px; color: #ccc; font-weight: bold; }
                .note { font-size: 11px; color: #777; margin-top: -8px; margin-bottom: 12px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>Cấu hình AI Subtitle Pro</h2>
                <p style="font-size: 12px; color: #888; margin-bottom: 15px;">Ưu tiên nhận bản Việt ngữ có sẵn, nếu không có mới gọi AI dịch.</p>
                
                <label>Mô hình ưu tiên:</label>
                <select id="primaryModel">
                    <option value="gemini">Gemini (Mặc định - Miễn phí)</option>
                    <option value="openai">ChatGPT / OpenAI</option>
                </select>

                <label>Gemini API Key 1:</label>
                <input type="text" id="geminiKey1" placeholder="Nhập Gemini Key số 1">

                <label>Gemini API Key 2:</label>
                <input type="text" id="geminiKey2" placeholder="Nhập Gemini Key số 2 (Tùy chọn)">

                <label>Gemini API Key 3:</label>
                <input type="text" id="geminiKey3" placeholder="Nhập Gemini Key số 3 (Tùy chọn)">
                <div class="note">Hệ thống sẽ xoay vòng 3 key này khi AI cần dịch.</div>

                <label>OpenAI API Key (Dự phòng):</label>
                <input type="text" id="openaiKey" placeholder="sk-proj-...">

                <label>TMDB API Key:</label>
                <input type="text" id="tmdbKey" placeholder="Tùy chọn (lấy cốt truyện cho AI)">

                <label>OpenSubtitles API Key:</label>
                <input type="text" id="osKey" placeholder="Ưu tiên 1">

                <label>Subsource API Key:</label>
                <input type="text" id="ssKey" placeholder="Ưu tiên 2">

                <label>Subdl API Key:</label>
                <input type="text" id="sdlKey" placeholder="Ưu tiên 3">

                <label>Phong cách dịch (Khi không có sub Việt):</label>
                <select id="translationStyle">
                    <option value="natural">Tự nhiên / Chuẩn mực</option>
                    <option value="genz">Trẻ trung / Gen Z</option>
                    <option value="formal">Trang trọng / Nghiêm túc</option>
                    <option value="historical">Cổ trang / Kiếm hiệp</option>
                </select>

                <button onclick="install()">Cài đặt vào Stremio</button>
            </div>
            <script>
                function install() {
                    const k1 = document.getElementById('geminiKey1').value.trim();
                    const k2 = document.getElementById('geminiKey2').value.trim();
                    const k3 = document.getElementById('geminiKey3').value.trim();
                    const combinedGeminiKeys = [k1, k2, k3].filter(Boolean).join(', ');

                    const config = {
                        m: document.getElementById('primaryModel').value,
                        g: combinedGeminiKeys,
                        o: document.getElementById('openaiKey').value.trim(),
                        t: document.getElementById('tmdbKey').value.trim(),
                        os: document.getElementById('osKey').value.trim(),
                        ss: document.getElementById('ssKey').value.trim(),
                        sdl: document.getElementById('sdlKey').value.trim(),
                        s: document.getElementById('translationStyle').value
                    };
                    const configStr = encodeURIComponent(JSON.stringify(config));
                    const manifestUrl = window.location.origin + '/' + configStr + '/manifest.json';
                    window.location.href = 'stremio://' + manifestUrl.replace(/^https?:\/\//, '');
                }
            </script>
        </body>
        </html>
    `);
});

// --- 6. STREMIO ADDON HANDLER ---
app.use('/:config?', (req, res, next) => {
    let config = null;
    if (req.params.config && req.params.config !== 'manifest.json') {
        try { config = JSON.parse(decodeURIComponent(req.params.config)); } catch (e) {}
    }

    const builder = new addonBuilder({
        id: 'com.ai.subtitle.translator.pro',
        version: '2.2.0',
        name: 'AI Subtitle Pro',
        description: 'Tự động lấy sub Việt sẵn có hoặc gọi AI dịch thông minh',
        resources: ['subtitles'],
        types: ['movie', 'series'],
        idPrefixes: ['tt']
    });

    builder.defineSubtitlesHandler(async function(args) {
        const { type, id } = args;
        const parts = id.split(':');
        const imdbId = parts[0];
        const season = parts[1] ? parseInt(parts[1]) : null;
        const episode = parts[2] ? parseInt(parts[2]) : null;

        console.log(`[Stremio] Yêu cầu phim: ${imdbId} (S${season}E${episode})`);

        // BƯỚC 1: Quét xem các nền tảng có sẵn phụ đề tiếng Việt chính hãng không?
        const existingVieSrt = await fetchVietnameseSubtitle(imdbId, type, season, episode, config);
        if (existingVieSrt) {
            console.log("[Thành công] Đã trả về bản phụ đề tiếng Việt có sẵn (Không cần gọi AI).");
            const base64Sub = Buffer.from(existingVieSrt).toString('base64');
            return {
                subtitles: [
                    {
                        id: `vie_original_${Date.now()}`,
                        url: `data:text/plain;base64,${base64Sub}`,
                        lang: 'vie',
                        label: '🇻🇳 Tiếng Việt (Có sẵn)'
                    }
                ]
            };
        }

        console.log("[Thông báo] Không tìm thấy phụ đề tiếng Việt sẵn có. Tiến hành tải bản tiếng Anh để AI dịch...");

        // BƯỚC 2: Nếu KHÔNG CÓ, mới tải bản tiếng Anh gốc
        const rawEngSrt = await fetchEnglishSubtitle(imdbId, type, season, episode, config);
        if (!rawEngSrt) return { subtitles: [] };

        // BƯỚC 3: Lấy bối cảnh phim TMDB và gọi AI dịch sang tiếng Việt
        try {
            const tmdbKey = configManager.getTmdbKey(config?.t);
            const movieContext = await getMovieContextFromTMDB(imdbId, tmdbKey);

            const translatedSrt = await translateWithAI(rawEngSrt, movieContext, config?.s || 'natural', config);
            const base64Sub = Buffer.from(translatedSrt).toString('base64');

            return {
                subtitles: [
                    {
                        id: `ai_sub_${Date.now()}`,
                        url: `data:text/plain;base64,${base64Sub}`,
                        lang: 'vie',
                        label: `🤖 Tiếng Việt AI (${config?.s || 'Natural'})`
                    }
                ]
            };
        } catch (err) {
            console.error("Lỗi quá trình dịch AI:", err.message);
            return { subtitles: [] };
        }
    });

    return getRouter(builder.interface)(req, res, next);
});

app.listen(PORT, () => {
    console.log(`Addon đang chạy trên cổng ${PORT}`);
});

