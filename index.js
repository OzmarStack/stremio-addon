const express = require('express');
const cors = require('cors');
const { si, sukebei } = require('nyaapi');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(cors());

// Master Of Reality: Forzamos el tipo de contenido para Stremio
app.use((req, res, next) => {
    if (req.url.includes('manifest.json') || req.url.includes('.json')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    next();
});

const orangeLogo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAMAAAB4YyS8AAAASFBMVEUAAAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD7pU9DAAAAGHRSTlMAECBAUGBwgICAkJCgoLDAwMDQ0NDg4PD89mS3AAAAhUlEQVRo3u3ZSQ6EMAwFURNmS0ggof9tByS0pE676id9S6v8S5Ysc8SOn9v7uH0+T230Xvffp3beT2v0nvvXU7v0P6Xv1777f+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77f+77X+77f+77/wf8A3S9E3S9L7TfAAAAAElFTkSuQmCC";

const manifest = {
    id: "com.masterofreality.nyaa.ultra.v15", 
    version: "1.5.8",
    name: "Nyaa Torrents 🍊",
    description: "Anime desde Nyaa.si - Master Of Reality Edition",
    logo: orangeLogo,
    resources: ["stream"],
    types: ["anime", "series", "movie"],
    idPrefixes: ["tt", "kitsu"]
};

// Página de configuración (HTML)
app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta Manifest (Soportando ambos formatos)
app.get('/manifest.json', (req, res) => res.json(manifest));
app.get('/:config/manifest.json', (req, res) => res.json(manifest));

// Ruta Streams
app.get('/:config?/stream/:type/:id.json', async (req, res) => {
    const isSukebei = req.params.config && req.params.config.includes('sukebei=true');
    let query = req.params.id;

    try {
        const cleanId = req.params.id.split(":")[0];
        const metaUrl = req.params.id.startsWith("tt") 
            ? `https://v3-cinemeta.strem.io/meta/${req.params.type}/${cleanId}.json`
            : `https://kitsu.io/api/edge/anime/${cleanId.replace('kitsu:','')}`;
        
        const metaRes = await axios.get(metaUrl);
        query = req.params.id.startsWith("tt") ? metaRes.data.meta.name : metaRes.data.data.attributes.canonicalTitle;
        
        const results = isSukebei 
            ? await sukebei.search(query, 10, { category: '0_0' })
            : await si.search(query, 10, { category: '1_0' });
        
        const streams = (results || []).map(torrent => {
            const hashMatch = torrent.magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/);
            if (!hashMatch) return null;
            return {
                name: "🍊 MASTER-NYAA",
                title: `${torrent.name}\n👥 ${torrent.seeders} 💾 ${torrent.fileSize}`,
                infoHash: hashMatch[1].toLowerCase()
            };
        }).filter(Boolean);

        res.json({ streams });
    } catch (e) {
        res.json({ streams: [] });
    }
});

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => console.log('🚀 Nyaa v1.5.8 Online'));
