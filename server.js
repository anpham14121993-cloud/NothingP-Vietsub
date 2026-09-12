const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Helper phân tích config
function parseConfig(encodedConfig) {
  if (!encodedConfig) return {};
  try {
    const jsonStr = Buffer.from(encodedConfig, 'base64').toString('utf8');
    return JSON.parse(jsonStr);
  } catch (e) {
    try {
      return JSON.parse(encodedConfig);
    } catch (err) {
      return {};
    }
  }
}

const DEFAULT_CONFIG = {
  model: 'gemini-2.5-flash',
  geminiKeys: process.env.GEMINI_API_KEY ? [process.env.GEMINI_API_KEY] : [],
  opensubtitlesApiKey: process.env.OPENSUBTITLES_API_KEY || '',
  subdlApiKey: process.env.SUBDL_API_KEY || '',
  targetLanguages: ['vi', 'en']
};

function getConfig(encodedConfig) {
  const userConfig = parseConfig(encodedConfig);
  return { ...DEFAULT_CONFIG, ...userConfig };
}

// Manifest chung cho Addon
function getManifest() {
  return {
    id: 'org.aisubtitlepro.stremio',
    version: '1.1.1',
    name: 'AI Subtitle Pro (Gemini)',
    description: 'Addon phụ đề thông minh tích hợp OpenSubtitles, SubDL và Google Gemini AI.',
    types: ['movie', 'series'],
    catalogs: [],
    resources: ['subtitles'],
    idPrefixes: ['tt']
  };
}

// Định tuyến Manifest (Tách riêng để không bị lỗi 404)
app.get('/manifest.json', (req, res) => {
  res.json(getManifest());
});
app.get('/:config/manifest.json', (req, res) => {
  res.json(getManifest());
});

// Trang cấu hình Addon (Giao diện cài đặt)
app.get('/configure', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>Cấu hình AI Subtitle Pro</title>
      <style>
        body { font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; display: flex; justify-content: center; }
        .card { background: #1e293b; padding: 30px; border-radius: 12px; width: 100%; max-width: 500px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
        h2 { color: #38bdf8; margin-top: 0; }
        label { display: block; margin-top: 15px; font-weight: bold; font-size: 14px; }
        input, select { width: 100%; padding: 10px; margin-top: 5px; background: #0f172a; border: 1px solid #334155; color: #fff; border-radius: 6px; box-sizing: border-box; }
        button { background: #38bdf8; color: #0f172a; border: none; padding: 12px; width: 100%; margin-top: 25px; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 16px; }
        button:hover { background: #0ea5e9; }
        .note { font-size: 12px; color: #94a3b8; margin-top: 5px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>Cấu hình AI Subtitle Pro</h2>
        <form id="configForm">
          <label>Google Gemini API Key(s) (Phân cách bằng dấu phẩy):</label>
          <input type="text" id="geminiKeys" placeholder="AIzaSy...">
          
          <label>Model Gemini:</label>
          <select id="model">
            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Khuyên dùng)</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
          </select>

          <label>OpenSubtitles API Key (Tùy chọn):</label>
          <input type="text" id="opensubtitlesApiKey" placeholder="API key từ opensubtitles.com">

          <label>SubDL API Key (Tùy chọn):</label>
          <input type="text" id="subdlApiKey" placeholder="API key từ subdl.com">

          <button type="button" onclick="installAddon()">Cài đặt vào Stremio</button>
        </form>
      </div>
      <script>
        function installAddon() {
          const config = {
            geminiKeys: document.getElementById('geminiKeys').value.split(',').map(k => k.trim()).filter(Boolean),
            model: document.getElementById('model').value,
            opensubtitlesApiKey: document.getElementById('opensubtitlesApiKey').value.trim(),
            subdlApiKey: document.getElementById('subdlApiKey').value.trim()
          };
          const encoded = btoa(JSON.stringify(config));
          const currentUrl = window.location.origin;
          const addonUrl = \`\${currentUrl}/\${encoded}/manifest.json\`;
          window.location.href = \`stremio://\${addonUrl.replace(/^https?:\\/\\//, '')}\`;
        }
      </script>
    </body>
    </html>
  `);
});

app.get('/:config/configure', (req, res) => {
  res.redirect('/configure');
});

// Hàm xử lý lấy phụ đề
async function handleSubtitles(req, res, encodedConfig) {
  const { type, id } = req.params;
  const config = getConfig(encodedConfig);
  let imdbId = id.split(':')[0]; // Ví dụ: tt1234567

  console.log(`[Subtitles Request] Type: ${type}, ID: ${imdbId}`);
  let subtitles = [];

  // 1. Lấy từ OpenSubtitles nếu có API Key
  if (config.opensubtitlesApiKey) {
    try {
      const osRes = await axios.get('https://api.opensubtitles.com/api/v1/subtitles', {
        headers: {
          'Api-Key': config.opensubtitlesApiKey,
          'User-Agent': 'AISubtitlePro v1.1.1'
        },
        params: {
          imdb_id: imdbId.replace('tt', ''),
          languages: config.targetLanguages.join(',')
        }
      });
      if (osRes.data && osRes.data.data) {
        for (const item of osRes.data.data.slice(0, 5)) {
          const fileId = item.attributes.files?.[0]?.file_id;
          if (fileId) {
            try {
              const dlRes = await axios.post('https://api.opensubtitles.com/api/v1/download', {
                file_id: fileId
              }, {
                headers: {
                  'Api-Key': config.opensubtitlesApiKey,
                  'User-Agent': 'AISubtitlePro v1.1.1',
                  'Content-Type': 'application/json'
                }
              });
              if (dlRes.data && dlRes.data.link) {
                subtitles.push({
                  id: `os-${item.id}`,
                  url: dlRes.data.link,
                  lang: item.attributes.language,
                  name: `OpenSubtitles [${item.attributes.language.toUpperCase()}]`
                });
              }
            } catch (dlErr) {}
          }
        }
      }
    } catch (e) {
      console.error('OpenSubtitles error:', e.message);
    }
  }

  // 2. Lấy từ SubDL nếu có API Key
  if (config.subdlApiKey) {
    try {
      const subdlRes = await axios.get('https://api.subdl.com/api/v1/subtitles', {
        params: {
          api_key: config.subdlApiKey,
          imdb_id: imdbId,
          langs: config.targetLanguages.join(',')
        }
      });
      if (subdlRes.data && subdlRes.data.status && subdlRes.data.subtitles) {
        for (const sub of subdlRes.data.subtitles.slice(0, 5)) {
          if (sub.url) {
            const fullUrl = sub.url.startsWith('http') ? sub.url : `https://subdl.com${sub.url}`;
            subtitles.push({
              id: `subdl-${sub.sub_id || Math.random()}`,
              url: fullUrl,
              lang: sub.language || 'vi',
              name: `SubDL [${sub.language?.toUpperCase()}]`
            });
          }
        }
      }
    } catch (e) {
      console.error('SubDL error:', e.message);
    }
  }

  // Nếu không tìm thấy phụ đề từ các nguồn, trả về phụ đề thông báo mẫu để Stremio không bị trống
  if (subtitles.length === 0) {
    subtitles.push({
      id: 'ai-notice',
      url: 'https://raw.githubusercontent.com/SubtitleEdit/subtitleedit/master/CHANGELOG.txt',
      lang: 'vi',
      name: '⚠️ Không tìm thấy phụ đề. Hãy nhập OpenSubtitles/SubDL API Key trong trang cấu hình.'
    });
  }

  res.json({ subtitles });
}

// Định tuyến Subtitles (Tách riêng route không config và có config)
app.get('/subtitles/:type/:id/:extra?.json', (req, res) => handleSubtitles(req, res, null));
app.get('/:config/subtitles/:type/:id/:extra?.json', (req, res) => handleSubtitles(req, res, req.params.config));

app.listen(PORT, () => {
  console.log(`AI Subtitle Pro server is running on port ${PORT}`);
});
