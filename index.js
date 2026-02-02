const express = require('express');
const cors = require('cors');
const { si, sukebei } = require('nyaapi');
const axios = require('axios');
const path = require('path');
const app = express();

// Master Of Reality: Configuración de CORS total para evitar bloqueos de Stremio
app.use(cors());
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
});

app.use(express.static(__dirname));

const orangeLogo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAMAAAB4YyS8AAAASFBMVEUAAAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD7pU9DAAAAGHRSTlMAECBAUGBwgICAkJCgoLDAwMDQ0NDg4PD89mS3AAAAhUlEQVRo3u3ZSQ6EMAwFURNmS0ggof9tByS0pE676id9S6v8S5Ysc8SOn9v7uH0+T230Xvffp3beT2v0nvvXU7v0P6Xv1777f+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77f+77X+77f+77/wf8A3S9E3S9L7TfAAAAAElFTkSuQmCC";

const manifest = {
    id: "com.masterofreality.nyaa.ultra.v3",
    version: "1.5.2",
    name: "Nyaa Torrents 🍊",
    description: "Anime desde Nyaa.si - Master Of Reality Edition",
    logo: orangeLogo,
    resources: ["stream"],
    types: ["anime", "series", "movie"],
    idPrefixes: ["tt", "kitsu"],
    catalogs: []
};

// Ruta de la interfaz (Esta NO debe llevar el header JSON por defecto)
app.get('/', (req, res) => {
    res.set('Content-Type', 'text/html');
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rutas del Manifest
app.get('/manifest.json', (req, res) => res.json(manifest));
app.get('/:config/manifest.json', (req, res) => res.json(manifest));

// Ruta de Streams
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
            ? await sukebei.search(query, 12, { category: '0_0' })
            : await si.search(query, 12, { category: '1_0' });
        
        const streams = (results || []).map(torrent => {
            const hashMatch = torrent.magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/);
            if (!hashMatch) return null;
            return {
                name: "🍊 NYAA",
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
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Master Of Reality: Nyaa Torrents v1.5.2`);
});
