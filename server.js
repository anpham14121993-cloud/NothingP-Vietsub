
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

const VERSION = '1.4.9';
const ADDON_ID = 'org.ai.subtitle.pro';
const ADDON_NAME = 'AI Subtitle Pro';

const API_HEADERS = {
    'User-Agent': `AISubtitlePro v${VERSION}`,
    'Accept': 'application/json'
};

// =====================================================
// 1. MODEL CONFIGURATION
// =====================================================

const GEMINI_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash'
];

const OPENAI_MODELS = [
    'gpt-4o-mini',
    'gpt-4o'
];

const DEFAULT_MODEL = 'gemini-2.5-flash';

const BATCH_SIZE = 20;

// Giới hạn bảo vệ bộ nhớ và thời gian xử lý.
const MAX_SUBTITLE_SIZE = 2 * 1024 * 1024;
const MAX_BATCHES = 200;

// =====================================================
// 2. CONFIGURATION HELPERS
// =====================================================

function parseConfig(encodedConfig) {
    if (!encodedConfig) return {};

    try {
        const decoded = decodeURIComponent(encodedConfig);

        try {
            return JSON.parse(
                Buffer.from(decoded, 'base64').toString('utf8')
            );
        } catch (e) {
            return JSON.parse(decoded);
        }
    } catch (e) {
        try {
            return JSON.parse(
                Buffer.from(encodedConfig, 'base64').toString('utf8')
            );
        } catch (err) {
            return {};
        }
    }
}

function normalizeModel(model) {
    if (GEMINI_MODELS.includes(model)) {
        return model;
    }

    if (OPENAI_MODELS.includes(model)) {
        return model;
    }

    return DEFAULT_MODEL;
}

function getGeminiKeys(config) {
    const keys = Array.isArray(config.geminiKeys)
        ? config.geminiKeys
        : [];

    const allKeys = [
        ...keys,
        process.env.GEMINI_API_KEY
    ];

    return [...new Set(
        allKeys.filter(
            key => typeof key === 'string' && key.trim()
        ).map(key => key.trim())
    )];
}

function getOpenAIKey(config) {
    return config.openaiKey ||
        process.env.OPENAI_API_KEY ||
        '';
}

// =====================================================
// 3. SRT PARSER
// =====================================================

function normalizeSrt(text) {
    return String(text || '')
        .replace(/^\uFEFF/, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim();
}

function parseSrt(text) {
    const normalized = normalizeSrt(text);

    if (!normalized) return [];

    return normalized
        .split(/\n\s*\n/)
        .map(block => block.trim())
        .filter(Boolean);
}

function getTimestamp(block) {
    const match = block.match(
        /(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/
    );

    return match ? match[0] : null;
}

function getSequence(block) {
    const lines = block.split('\n');

    for (const line of lines) {
        if (/^\d+$/.test(line.trim())) {
            return line.trim();
        }
    }

    return null;
}

function validateSrtBlock(block) {
    return Boolean(
        getTimestamp(block) &&
        getSequence(block)
    );
}

function validateTranslation(original, translated) {
    const originalBlocks = parseSrt(original);
    const translatedBlocks = parseSrt(translated);

    if (originalBlocks.length !== translatedBlocks.length) {
        return false;
    }

    for (let i = 0; i < originalBlocks.length; i++) {
        const originalBlock = originalBlocks[i];
        const translatedBlock = translatedBlocks[i];

        if (!validateSrtBlock(translatedBlock)) {
            return false;
        }

        if (
            getSequence(originalBlock) !==
            getSequence(translatedBlock)
        ) {
            return false;
        }

        if (
            getTimestamp(originalBlock) !==
            getTimestamp(translatedBlock)
        ) {
            return false;
        }
    }

    return true;
}

// =====================================================
// 4. SPLIT SRT INTO BATCHES
// =====================================================

function splitSrtIntoBatches(srt, batchSize = BATCH_SIZE) {
    const blocks = parseSrt(srt);

    const batches = [];

    for (let i = 0; i < blocks.length; i += batchSize) {
        batches.push(
            blocks.slice(i, i + batchSize)
        );
    }

    return batches;
}

function cleanAIResponse(text) {
    return String(text || '')
        .replace(/^\s*```(?:srt|text)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();
}

// =====================================================
// 5. TRANSLATION PROMPT
// =====================================================

function buildTranslationPrompt(batch, batchIndex, totalBatches) {
    return `
Bạn là dịch giả phụ đề phim chuyên nghiệp.

Nhiệm vụ:
Dịch các block phụ đề SRT dưới đây sang tiếng Việt tự nhiên,
theo phong cách phụ đề phim chuyên nghiệp.

QUY TẮC BẮT BUỘC:

1. Giữ nguyên tuyệt đối số thứ tự của từng block.
2. Giữ nguyên tuyệt đối timestamp.
3. Không thêm hoặc xóa block phụ đề.
4. Không gộp hai block thành một.
5. Không tự ý chia một block thành nhiều block.
6. Giữ nguyên tên riêng tiếng Anh.
7. Dịch hội thoại tự nhiên, đúng ngữ cảnh.
8. Giữ nguyên các dòng mô tả âm thanh khi cần thiết.
9. Chỉ trả về nội dung SRT.
10. Không giải thích, không thêm lời mở đầu.
11. Không thêm markdown hoặc dấu ```.

Đây là lô ${batchIndex + 1}/${totalBatches}.

NỘI DUNG SRT:

${batch.join('\n\n')}
`.trim();
}

// =====================================================
// 6. GEMINI TRANSLATION
// =====================================================

async function translateWithGemini(
    prompt,
    model,
    apiKey
) {
    const endpoint =
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const response = await axios.post(
        endpoint,
        {
            contents: [
                {
                    parts: [
                        { text: prompt }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.2
            }
        },
        {
            params: {
                key: apiKey
            },
            timeout: 45000
        }
    );

    const parts =
        response.data?.candidates?.[0]?.content?.parts;

    if (!Array.isArray(parts)) {
        throw new Error('Gemini không trả về nội dung dịch.');
    }

    const text = parts
        .map(part => part.text || '')
        .join('');

    if (!text.trim()) {
        throw new Error('Gemini trả về nội dung rỗng.');
    }

    return cleanAIResponse(text);
}

// =====================================================
// 7. OPENAI TRANSLATION
// =====================================================

async function translateWithOpenAI(
    prompt,
    model,
    apiKey
) {
    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
            model,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.2
        },
        {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 45000
        }
    );

    const text =
        response.data?.choices?.[0]?.message?.content;

    if (!text) {
        throw new Error('OpenAI không trả về nội dung dịch.');
    }

    return cleanAIResponse(text);
}

// =====================================================
// 8. TRANSLATE ONE BATCH WITH FALLBACK
// =====================================================

async function translateBatch(
    batch,
    batchIndex,
    totalBatches,
    config,
    selectedModel
) {
    const prompt = buildTranslationPrompt(
        batch,
        batchIndex,
        totalBatches
    );

    const geminiKeys = getGeminiKeys(config);
    const openaiKey = getOpenAIKey(config);

    let lastError = 'Không có API key hợp lệ.';

    // Ưu tiên model được chọn.
    // Nếu lỗi, chuyển sang model dự phòng.

    if (selectedModel.startsWith('gpt-')) {
        const openaiModels = [
            selectedModel,
            ...OPENAI_MODELS
        ];

        const uniqueModels = [
            ...new Set(openaiModels)
        ];

        if (openaiKey) {
            for (const model of uniqueModels) {
                try {
                    return await translateWithOpenAI(
                        prompt,
                        model,
                        openaiKey
                    );
                } catch (error) {
                    lastError =
                        error.response?.data?.error?.message ||
                        error.message;
                }
            }
        }
    }

    // Thử Gemini nếu OpenAI không được chọn
    // hoặc OpenAI gặp lỗi.

    if (geminiKeys.length > 0) {
        const models = [
            selectedModel,
            ...GEMINI_MODELS
        ].filter(model =>
            GEMINI_MODELS.includes(model)
        );

        const uniqueModels = [
            ...new Set(models)
        ];

        for (const key of geminiKeys) {
            for (const model of uniqueModels) {
                try {
                    return await translateWithGemini(
                        prompt,
                        model,
                        key
                    );
                } catch (error) {
                    lastError =
                        error.response?.data?.error?.message ||
                        error.message;
                }
            }
        }
    }

    // Nếu Gemini thất bại, thử OpenAI
    // khi người dùng đã cấu hình API key.

    if (openaiKey) {
        for (const model of OPENAI_MODELS) {
            try {
                return await translateWithOpenAI(
                    prompt,
                    model,
                    openaiKey
                );
            } catch (error) {
                lastError =
                    error.response?.data?.error?.message ||
                    error.message;
            }
        }
    }

    throw new Error(lastError);
}

// =====================================================
// 9. TRANSLATE COMPLETE SRT
// =====================================================

async function translateSrt(originalSrt, config, model) {
    const normalized = normalizeSrt(originalSrt);

    if (!normalized) {
        throw new Error('File SRT rỗng.');
    }

    if (Buffer.byteLength(normalized, 'utf8') > MAX_SUBTITLE_SIZE) {
        throw new Error('File phụ đề vượt quá giới hạn 2 MB.');
    }

    const originalBlocks = parseSrt(normalized);

    if (originalBlocks.length === 0) {
        throw new Error('Không tìm thấy block phụ đề hợp lệ.');
    }

    if (originalBlocks.length > BATCH_SIZE * MAX_BATCHES) {
        throw new Error('File phụ đề có quá nhiều block.');
    }

    const batches = splitSrtIntoBatches(
        normalized,
        BATCH_SIZE
    );

    const translatedBlocks = [];

    for (let i = 0; i < batches.length; i++) {
        const translated = await translateBatch(
            batches[i],
            i,
            batches.length,
            config,
            model
        );

        const translatedBatch = parseSrt(translated);

        // Không chấp nhận bản dịch thiếu hoặc thừa block.
        if (translatedBatch.length !== batches[i].length) {
            throw new Error(
                `Lô ${i + 1}: số lượng block không khớp.`
            );
        }

        if (
            !validateTranslation(
                batches[i].join('\n\n'),
                translated
            )
        ) {
            throw new Error(
                `Lô ${i + 1}: số thứ tự hoặc timestamp bị thay đổi.`
            );
        }

        translatedBlocks.push(...translatedBatch);
    }

    const finalSrt = translatedBlocks.join('\n\n');

    if (
        !validateTranslation(
            normalized,
            finalSrt
        )
    ) {
        throw new Error(
            'Bản dịch cuối cùng không khớp SRT gốc.'
        );
    }

    return finalSrt;
}

// =====================================================
// 10. CONFIGURATION PAGE
// =====================================================

app.get('/', (req, res) => {
    res.redirect('/configure');
});

app.get('/configure', (req, res) => {
    renderConfigPage(req, res, {});
});

app.get('/:config/configure', (req, res) => {
    const savedConfig = parseConfig(req.params.config);

    renderConfigPage(req, res, savedConfig);
});

function renderConfigPage(req, res, savedConfig) {
    const selectedModel = normalizeModel(savedConfig.model);

    const geminiKeys = Array.isArray(savedConfig.geminiKeys)
        ? savedConfig.geminiKeys
        : [];

    res.send(`
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI Subtitle Pro</title>

<style>
body {
    background: #121212;
    color: #fff;
    font-family: Arial, sans-serif;
    padding: 20px;
    display: flex;
    justify-content: center;
}

.container {
    width: 100%;
    max-width: 520px;
    background: #1e1e1e;
    padding: 20px;
    border-radius: 8px;
}

h2 {
    text-align: center;
    color: #ff5252;
}

label {
    display: block;
    margin-top: 12px;
    margin-bottom: 5px;
    font-size: 13px;
    color: #ccc;
}

input, select {
    width: 100%;
    padding: 10px;
    background: #2a2a2a;
    border: 1px solid #444;
    color: #fff;
    border-radius: 4px;
    box-sizing: border-box;
}

.section-title {
    color: #4fc3f7;
    margin-top: 20px;
    font-size: 14px;
    font-weight: bold;
    border-bottom: 1px solid #333;
    padding-bottom: 5px;
}

button {
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 4px;
    font-weight: bold;
    margin-top: 15px;
    cursor: pointer;
    color: white;
}

.btn-install {
    background: #e50914;
}

.btn-copy {
    background: #2196F3;
}

.note {
    font-size: 12px;
    color: #aaa;
    line-height: 1.6;
}
</style>
</head>

<body>
<div class="container">

<h2>AI Subtitle Pro</h2>

<form id="configForm">

<label>Mô hình AI dịch:</label>

<select id="modelSelect">
    <optgroup label="Google Gemini">
        <option value="gemini-2.5-flash"
            ${selectedModel === 'gemini-2.5-flash' ? 'selected' : ''}>
            Gemini 2.5 Flash
        </option>

        <option value="gemini-2.5-pro"
            ${selectedModel === 'gemini-2.5-pro' ? 'selected' : ''}>
            Gemini 2.5 Pro
        </option>

        <option value="gemini-2.0-flash"
            ${selectedModel === 'gemini-2.0-flash' ? 'selected' : ''}>
            Gemini 2.0 Flash
        </option>
    </optgroup>

    <optgroup label="OpenAI">
        <option value="gpt-4o-mini"
            ${selectedModel === 'gpt-4o-mini' ? 'selected' : ''}>
            GPT-4o-mini
        </option>

        <option value="gpt-4o"
            ${selectedModel === 'gpt-4o' ? 'selected' : ''}>
            GPT-4o
        </option>
    </optgroup>
</select>

<div class="section-title">API Keys AI</div>

<label>Gemini API Key 1:</label>
<input type="password" id="geminiKey1"
    value="${geminiKeys[0] || ''}">

<label>Gemini API Key 2:</label>
<input type="password" id="geminiKey2"
    value="${geminiKeys[1] || ''}">

<label>Gemini API Key 3:</label>
<input type="password" id="geminiKey3"
    value="${geminiKeys[2] || ''}">

<label>OpenAI API Key:</label>
<input type="password" id="openaiKey"
    value="${savedConfig.openaiKey || ''}">

<div class="section-title">Nguồn phụ đề</div>

<label>OpenSubtitles API Key:</label>
<input type="password" id="opensubtitlesKey"
    value="${savedConfig.opensubtitlesKey || ''}">

<label>Subdl API Key:</label>
<input type="password" id="subdlKey"
    value="${savedConfig.subdlKey || ''}">

<label>Subsource Bearer Token:</label>
<input type="password" id="subsourceKey"
    value="${savedConfig.subsourceKey || ''}">

<button type="button" class="btn-install" id="installBtn">
    Cài đặt trực tiếp vào Stremio
</button>

<label>Link Addon:</label>

<input type="text" id="addonUrlOutput"
    readonly placeholder="Nhấn nút tạo link bên dưới">

<button type="button" class="btn-copy" id="copyBtn">
    Tạo link cấu hình
</button>

<p class="note">
    AI dịch phụ đề theo từng lô 20 block.
    Các lô được xử lý tuần tự để hạn chế lỗi mất
    timestamp và vượt giới hạn nội dung.
</p>

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
        ].filter(Boolean),

        openaiKey: document.getElementById('openaiKey').value.trim(),

        opensubtitlesKey:
            document.getElementById('opensubtitlesKey').value.trim(),

        subdlKey:
            document.getElementById('subdlKey').value.trim(),

        subsourceKey:
            document.getElementById('subsourceKey').value.trim()
    };

    const encoded = btoa(
        unescape(encodeURIComponent(JSON.stringify(config)))
    );

    const safeEncoded = encodeURIComponent(encoded);

    return window.location.origin +
        '/' + safeEncoded + '/manifest.json';
}

document.getElementById('installBtn').addEventListener(
    'click',
    () => {
        const addonUrl = getAddonUrl();

        window.location.href =
            'stremio://' +
            addonUrl.replace(/^https?:\\/\\//, '');
    }
);

document.getElementById('copyBtn').addEventListener(
    'click',
    () => {
        const addonUrl = getAddonUrl();

        document.getElementById('addonUrlOutput').value =
            addonUrl;
    }
);
</script>

</body>
</html>
    `);
}

// =====================================================
// 11. STREMIO MANIFEST
// =====================================================

const defaultManifest = {
    id: ADDON_ID,
    version: VERSION,
    name: ADDON_NAME,

    description:
        'Phụ đề tiếng Việt và dịch phụ đề bằng AI.',

    types: ['movie', 'series'],

    catalogs: [],

    resources: ['subtitles'],

    idPrefixes: ['tt'],

    behaviorHints: {
        configurable: true,
        configurationRequired: false
    }
};

app.get('/manifest.json', (req, res) => {
    res.json(defaultManifest);
});

app.get('/:config/manifest.json', (req, res) => {
    res.json(defaultManifest);
});

// =====================================================
// 12. SUBTITLE HELPERS
// =====================================================

function normalizeLanguage(language) {
    return String(language || '').toLowerCase();
}

function isVietnamese(language) {
    return [
        'vi',
        'vie',
        'vietnamese',
        'viet'
    ].includes(normalizeLanguage(language));
}

function isEnglish(language) {
    return [
        'en',
        'eng',
        'english'
    ].includes(normalizeLanguage(language));
}

function buildSubtitle(
    id,
    url,
    name
) {
    return {
        id,
        url,
        lang: 'vie',
        name
    };
}

// =====================================================
// 13. SUBTITLE SEARCH
// =====================================================

async function handleSubtitles(
    req,
    res,
    encodedConfig
) {
    const config = parseConfig(encodedConfig);

    const { type, id } = req.params;

    const idParts = id.split(':');

    const imdbId = idParts[0];

    const season = idParts[1]
        ? parseInt(idParts[1], 10)
        : null;

    const episode = idParts[2]
        ? parseInt(idParts[2], 10)
        : null;

    const model = normalizeModel(config.model);

    const hostUrl =
        `${req.protocol}://${req.get('host')}`;

    const subtitles = [];

    const hasAiKey =
        getGeminiKeys(config).length > 0 ||
        Boolean(getOpenAIKey(config));

    // -------------------------------------------------
    // OPENSUBTITLES
    // -------------------------------------------------

    if (config.opensubtitlesKey) {
        try {
            const params = {
                languages: 'vi,en,vie'
            };

            if (imdbId.startsWith('tt')) {
                params.imdb_id = imdbId.replace('tt', '');
            }

            if (
                type === 'series' &&
                season !== null &&
                episode !== null
            ) {
                params.season_number = season;
                params.episode_number = episode;
            }

            const response = await axios.get(
                'https://api.opensubtitles.com/api/v1/subtitles',
                {
                    params,
                    headers: {
                        'Api-Key': config.opensubtitlesKey,
                        ...API_HEADERS
                    },
                    timeout: 8000
                }
            );

            const items = response.data?.data || [];

            for (const item of items.slice(0, 6)) {
                const attributes = item.attributes || {};

                const file = attributes.files?.[0];

                if (!file?.file_id) continue;

                const language = attributes.language;

                try {
                    const download = await axios.post(
                        'https://api.opensubtitles.com/api/v1/download',
                        {
                            file_id: file.file_id
                        },
                        {
                            headers: {
                                'Api-Key': config.opensubtitlesKey,
                                ...API_HEADERS,
                                'Content-Type': 'application/json'
                            },
                            timeout: 8000
                        }
                    );

                    const downloadUrl = download.data?.link;

                    if (!downloadUrl) continue;

                    if (isVietnamese(language)) {
                        subtitles.push(
                            buildSubtitle(
                                `os-vi-${item.id}`,
                                `${hostUrl}/proxy-sub?url=${encodeURIComponent(downloadUrl)}`,
                                'Tiếng Việt (Gốc - OpenSubtitles)'
                            )
                        );
                    } else if (isEnglish(language) && hasAiKey) {
                        subtitles.push(
                            buildSubtitle(
                                `ai-os-${item.id}`,
                                `${hostUrl}/translate-sub?url=${encodeURIComponent(downloadUrl)}&model=${model}&config=${encodeURIComponent(encodedConfig || '')}`,
                                `AI Dịch (${model}) - OpenSubtitles`
                            )
                        );
                    }
                } catch (error) {
                    console.error(
                        '[OpenSubtitles download]',
                        error.message
                    );
                }
            }
        } catch (error) {
            console.error(
                '[OpenSubtitles search]',
                error.message
            );
        }
    }

    // -------------------------------------------------
    // SUBDL
    // -------------------------------------------------

    if (config.subdlKey && imdbId) {
        try {
            const response = await axios.get(
                'https://api.subdl.com/api/v1/subtitles',
                {
                    params: {
                        api_key: config.subdlKey,
                        imdb_id: imdbId,
                        type: type === 'series' ? 'tv' : 'movie',
                        season,
                        episode,
                        languages: 'vi,en,vie'
                    },
                    headers: API_HEADERS,
                    timeout: 8000
                }
            );

            const items = response.data?.subtitles || [];

            for (const sub of items.slice(0, 6)) {
                const language = sub.lang;

                let downloadUrl = sub.url;

                if (!downloadUrl) continue;

                if (!downloadUrl.startsWith('http')) {
                    downloadUrl =
                        `https://subdl.com${downloadUrl}`;
                }

                if (isVietnamese(language)) {
                    subtitles.push(
                        buildSubtitle(
                            `subdl-vi-${sub.les_id || sub.url}`,
                            `${hostUrl}/proxy-sub?url=${encodeURIComponent(downloadUrl)}`,
                            'Tiếng Việt (Gốc - Subdl)'
                        )
                    );
                } else if (isEnglish(language) && hasAiKey) {
                    subtitles.push(
                        buildSubtitle(
                            `ai-subdl-${sub.les_id || sub.url}`,
                            `${hostUrl}/translate-sub?url=${encodeURIComponent(downloadUrl)}&model=${model}&config=${encodeURIComponent(encodedConfig || '')}`,
                            `AI Dịch (${model}) - Subdl`
                        )
                    );
                }
            }
        } catch (error) {
            console.error(
                '[Subdl search]',
                error.message
            );
        }
    }

    // -------------------------------------------------
    // SUBSOURCE
    // -------------------------------------------------

    if (config.subsourceKey && imdbId) {
        try {
            const response = await axios.get(
                'https://api.subsource.dev/api/subtitles',
                {
                    params: {
                        imdb: imdbId,
                        lang: 'vi,en,vie'
                    },
                    headers: {
                        Authorization:
                            `Bearer ${config.subsourceKey}`,
                        ...API_HEADERS
                    },
                    timeout: 8000
                }
            );

            const items = Array.isArray(response.data)
                ? response.data
                : [];

            for (const sub of items.slice(0, 6)) {
                const language = sub.language;

                let downloadUrl =
                    sub.url || sub.downloadUrl;

                if (!downloadUrl) continue;

                if (!downloadUrl.startsWith('http')) {
                    downloadUrl =
                        `https://subsource.net${downloadUrl}`;
                }

                if (isVietnamese(language)) {
                    subtitles.push(
                        buildSubtitle(
                            `subsource-vi-${sub.id || sub.url}`,
                            `${hostUrl}/proxy-sub?url=${encodeURIComponent(downloadUrl)}&provider=subsource&key=${encodeURIComponent(config.subsourceKey)}`,
                            'Tiếng Việt (Gốc - Subsource)'
                        )
                    );
                } else if (isEnglish(language) && hasAiKey) {
                    subtitles.push(
                        buildSubtitle(
                            `ai-subsource-${sub.id || sub.url}`,
                            `${hostUrl}/translate-sub?url=${encodeURIComponent(downloadUrl)}&model=${model}&config=${encodeURIComponent(encodedConfig || '')}`,
                            `AI Dịch (${model}) - Subsource`
                        )
                    );
                }
            }
        } catch (error) {
            console.error(
                '[Subsource search]',
                error.message
            );
        }
    }

    // -------------------------------------------------
    // SORT: VIETNAMESE ORIGINAL FIRST
    // -------------------------------------------------

    subtitles.sort((a, b) => {
        const aOriginal =
            a.name.includes('Tiếng Việt (Gốc');

        const bOriginal =
            b.name.includes('Tiếng Việt (Gốc');

        if (aOriginal && !bOriginal) return -1;

        if (!aOriginal && bOriginal) return 1;

        return 0;
    });

    if (subtitles.length === 0) {
        subtitles.push(
            buildSubtitle(
                'ai-notice',
                'https://raw.githubusercontent.com/SubtitleEdit/subtitleedit/master/CHANGELOG.txt',
                'Chưa tìm thấy phụ đề phù hợp.'
            )
        );
    }

    res.json({ subtitles });
}

// =====================================================
// 14. ORIGINAL SUBTITLE PROXY
// =====================================================

app.get('/proxy-sub', async (req, res) => {
    const { url, provider, key } = req.query;

    if (!url) {
        return res.status(400).send('Missing URL');
    }

    try {
        const headers = {
            'User-Agent': `AISubtitlePro v${VERSION}`
        };

        if (provider === 'subsource' && key) {
            headers.Authorization = `Bearer ${key}`;
        }

        const response = await axios.get(url, {
            headers,
            responseType: 'text',
            timeout: 15000
        });

        res.setHeader(
            'Content-Type',
            'text/plain; charset=utf-8'
        );

        res.send(response.data);
    } catch (error) {
        console.error('[Proxy subtitle]', error.message);

        res.status(502).send(
            '1\n00:00:01,000 --> 00:00:05,000\n[Lỗi tải phụ đề gốc]'
        );
    }
});

// =====================================================
// 15. AI TRANSLATION ENDPOINT
// =====================================================

app.get('/translate-sub', async (req, res) => {
    const {
        url,
        model,
        config: configQuery
    } = req.query;

    res.setHeader(
        'Content-Type',
        'text/plain; charset=utf-8'
    );

    if (!url) {
        return res.status(400).send(
            '1\n00:00:01,000 --> 00:00:05,000\n[Lỗi: Thiếu URL phụ đề]'
        );
    }

    const config = parseConfig(configQuery);

    const selectedModel = normalizeModel(
        model || config.model
    );

    let originalSrt = '';

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': `AISubtitlePro v${VERSION}`,
                'Accept': 'text/plain, */*'
            },
            responseType: 'text',
            timeout: 15000,
            maxContentLength: MAX_SUBTITLE_SIZE
        });

        originalSrt = normalizeSrt(response.data);

        if (!originalSrt) {
            throw new Error('File phụ đề rỗng.');
        }
    } catch (error) {
        console.error(
            '[Download original subtitle]',
            error.message
        );

        return res.status(502).send(
            '1\n00:00:01,000 --> 00:00:05,000\n[Lỗi tải file phụ đề tiếng Anh]'
        );
    }

    try {
        const translatedSrt = await translateSrt(
            originalSrt,
            config,
            selectedModel
        );

        res.send(translatedSrt);
    } catch (error) {
        console.error(
            '[AI translation]',
            error.message
        );

        res.status(502).send(
            '1\n00:00:01,000 --> 00:00:08,000\n[LỖI AI DỊCH]: ' +
            error.message
        );
    }
});

// =====================================================
// 16. STREMIO ROUTES
// =====================================================

app.get(
    '/subtitles/:type/:id.json',
    (req, res) => handleSubtitles(req, res, null)
);

app.get(
    '/subtitles/:type/:id/:extra.json',
    (req, res) => handleSubtitles(req, res, null)
);

app.get(
    '/:config/subtitles/:type/:id.json',
    (req, res) => handleSubtitles(
        req,
        res,
        req.params.config
    )
);

app.get(
    '/:config/subtitles/:type/:id/:extra.json',
    (req, res) => handleSubtitles(
        req,
        res,
        req.params.config
    )
);

// =====================================================
// 17. START SERVER
// =====================================================

app.listen(PORT, () => {
    console.log(
        `AI Subtitle Pro v${VERSION} running on port ${PORT}`
    );
});
