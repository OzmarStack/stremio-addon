const express = require('express');
const cors = require('cors');
const { si, sukebei } = require('nyaapi');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(cors());

// Master Of Reality: Forzamos que todo lo que salga de aquí sea JSON por defecto para Stremio
app.use((req, res, next) => {
    if (req.url.endsWith('.json') || req.url.includes('/stream/')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    next();
});

const orangeLogo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAMAAAB4YyS8AAAASFBMVEUAAAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD7pU9DAAAAGHRSTlMAECBAUGBwgICAkJCgoLDAwMDQ0NDg4PD89mS3AAAAhUlEQVRo3u3ZSQ6EMAwFURNmS0ggof9tByS0pE676id9S6v8S5Ysc8SOn9v7uH0+T230Xvffp3beT2v0nvvXU7v0P6Xv1777f+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77f+77X+77f+77/wf8A3S9E3S9L7TfAAAAAElFTkSuQmCC";

const manifest = {
    id: "com.masterofreality.nyaa.ultra.v11", 
    version: "1.5.6",
    name: "Nyaa Torrents 🍊",
    description: "Anime desde Nyaa.si - Master Of Reality Edition",
    logo: orangeLogo,
    resources: ["stream"],
    types: ["anime", "series", "movie"],
    idPrefixes: ["tt", "kitsu"],
    behaviorHints: { configurable: true }
};

// RUTA 1: Inicio (HTML) - Forzamos lectura manual para evitar el error de "solo texto"
app.get('/', (req, res) => {
    const htmlPath = path.join(__dirname, 'index.html');
    fs.readFile(htmlPath, 'utf8', (err, data) => {
        if (err) return res.status(500).send("Error cargando index.html");
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(data);
    });
});

// RUTA 2: Manifests (JSON)
app.get('/manifest.json', (req, res) => res.json(manifest));
app.get('/:config/manifest.json', (req, res) => res.json(manifest));

// RUTA 3: Streams (La lógica de búsqueda)
app.get('/:config/stream/:type/:id.json', async (req, res) => {
    const isSukebei = req.params.config.includes('sukebei=true');
    const { type, id } = req.params;
    let queries = [];

    try {
        const cleanId = id.split(":")[0];
        const metaUrl = id.startsWith("tt") 
            ? `https://v3-cinemeta.strem.io/meta/${type}/${cleanId}.json`
            : `https://kitsu.io/api/edge/anime/${cleanId.replace('kitsu:','')}`;
        
        const metaRes = await axios.get(metaUrl);
        const name = id.startsWith("tt") ? metaRes.data.meta.name : metaRes.data.data.attributes.canonicalTitle;
        queries.push(name);
        
        const results = isSukebei 
            ? await sukebei.search(name, 10, { category: '0_0' })
            : await si.search(name, 10, { category: '1_0' });
        
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

// Ruta de respaldo para streams sin config
app.get('/stream/:type/:id.json', (req, res) => res.redirect(`/sukebei=false${req.url}`));

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => console.log('🚀 Nyaa Online v1.5.6'));
