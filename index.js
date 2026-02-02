const express = require('express');
const cors = require('cors');
const { si } = require('nyaapi');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(cors());

// Master Of Reality: Forzamos el tipo de contenido JSON para todas las rutas del addon
app.use((req, res, next) => {
    if (req.url.includes('manifest.json') || req.url.includes('/stream/')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    next();
});

const manifest = {
    id: "com.masterofreality.nyaa.final.v30", 
    version: "1.5.9",
    name: "Nyaa Torrents 🍊",
    description: "Anime desde Nyaa.si - Master Of Reality Edition",
    resources: ["stream"],
    types: ["anime", "series", "movie"],
    idPrefixes: ["tt", "kitsu"]
};

// Página de configuración
app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta Manifest única y directa
app.get('/manifest.json', (req, res) => res.json(manifest));

// Ruta de Streams simplificada (sin parámetros de configuración opcionales)
app.get('/stream/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    let query = id;

    try {
        const cleanId = id.split(":")[0];
        const metaUrl = id.startsWith("tt") 
            ? `https://v3-cinemeta.strem.io/meta/${type}/${cleanId}.json`
            : `https://kitsu.io/api/edge/anime/${cleanId.replace('kitsu:','')}`;
        
        const metaRes = await axios.get(metaUrl);
        query = id.startsWith("tt") ? metaRes.data.meta.name : metaRes.data.data.attributes.canonicalTitle;
        
        const results = await si.search(query, 10, { category: '1_0' });
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
app.listen(port, '0.0.0.0', () => console.log('🚀 Addon Online'));
