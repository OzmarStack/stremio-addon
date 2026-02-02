const express = require('express');
const cors = require('cors');
const { si, sukebei } = require('nyaapi');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(cors());
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
});

const orangeLogo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAMAAAB4YyS8AAAASFBMVEUAAAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD7pU9DAAAAGHRSTlMAECBAUGBwgICAkJCgoLDAwMDQ0NDg4PD89mS3AAAAhUlEQVRo3u3ZSQ6EMAwFURNmS0ggof9tByS0pE676id9S6v8S5Ysc8SOn9v7uH0+T230Xvffp3beT2v0nvvXU7v0P6Xv1777f+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77f+77X+77f+77/wf8A3S9E3S9L7TfAAAAAElFTkSuQmCC";

const manifest = {
    id: "com.masterofreality.nyaa.ultra.v4", // ID nuevo para forzar refresco
    version: "1.5.3",
    name: "Nyaa Torrents 🍊",
    description: "Anime desde Nyaa.si - Master Of Reality Edition",
    logo: orangeLogo,
    resources: ["stream"],
    types: ["anime", "series", "movie"],
    idPrefixes: ["tt", "kitsu"]
};

async function searchNyaa(query, isSukebei) {
    console.log(`🔍 Master Of Reality buscando: ${query}`);
    try {
        const results = isSukebei 
            ? await sukebei.search(query, 15, { category: '0_0' })
            : await si.search(query, 15, { category: '1_0' });
        
        return (results || []).map(torrent => {
            const hashMatch = torrent.magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/);
            if (!hashMatch) return null;
            
            // Etiqueta de calidad simplificada
            let quality = "HD";
            if (torrent.name.includes('1080')) quality = "1080p";
            else if (torrent.name.includes('720')) quality = "720p";

            return {
                name: `⭐ MASTER-NYAA\n${quality}`,
                title: `${torrent.name}\n👥 ${torrent.seeders} 💾 ${torrent.fileSize}`,
                infoHash: hashMatch[1].toLowerCase()
            };
        }).filter(Boolean);
    } catch (e) { 
        console.log("❌ Error en Nyaa API:", e.message);
        return []; 
    }
}

app.get('/manifest.json', (req, res) => res.json(manifest));
app.get('/:config/manifest.json', (req, res) => res.json(manifest));

app.get('/:config?/stream/:type/:id.json', async (req, res) => {
    const isSukebei = req.params.config && req.params.config.includes('sukebei=true');
    const { type, id } = req.params;
    let queries = [];

    try {
        const cleanId = id.split(":")[0];
        const metaUrl = id.startsWith("tt") 
            ? `https://v3-cinemeta.strem.io/meta/${type}/${cleanId}.json`
            : `https://kitsu.io/api/edge/anime/${cleanId.replace('kitsu:','')}`;
        
        const metaRes = await axios.get(metaUrl);
        
        if (id.startsWith("tt")) {
            queries.push(metaRes.data.meta.name);
        } else {
            const attr = metaRes.data.data.attributes;
            queries.push(attr.canonicalTitle);
            if (attr.titles.en) queries.push(attr.titles.en);
        }
    } catch (e) { queries.push(id); }

    // Ejecutar búsquedas para todos los nombres encontrados
    const allResults = await Promise.all(queries.map(q => searchNyaa(q, isSukebei)));
    const streams = [].concat(...allResults);

    res.json({ streams });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => console.log('🚀 Nyaa Torrents v1.5.3 Online'));const express = require('express');
const cors = require('cors');
const { si, sukebei } = require('nyaapi');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(cors());
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
});

const orangeLogo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAMAAAB4YyS8AAAASFBMVEUAAAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD7pU9DAAAAGHRSTlMAECBAUGBwgICAkJCgoLDAwMDQ0NDg4PD89mS3AAAAhUlEQVRo3u3ZSQ6EMAwFURNmS0ggof9tByS0pE676id9S6v8S5Ysc8SOn9v7uH0+T230Xvffp3beT2v0nvvXU7v0P6Xv1777f+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77f+77X+77f+77/wf8A3S9E3S9L7TfAAAAAElFTkSuQmCC";

const manifest = {
    id: "com.masterofreality.nyaa.ultra.v4", // ID nuevo para forzar refresco
    version: "1.5.3",
    name: "Nyaa Torrents 🍊",
    description: "Anime desde Nyaa.si - Master Of Reality Edition",
    logo: orangeLogo,
    resources: ["stream"],
    types: ["anime", "series", "movie"],
    idPrefixes: ["tt", "kitsu"]
};

async function searchNyaa(query, isSukebei) {
    console.log(`🔍 Master Of Reality buscando: ${query}`);
    try {
        const results = isSukebei 
            ? await sukebei.search(query, 15, { category: '0_0' })
            : await si.search(query, 15, { category: '1_0' });
        
        return (results || []).map(torrent => {
            const hashMatch = torrent.magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/);
            if (!hashMatch) return null;
            
            // Etiqueta de calidad simplificada
            let quality = "HD";
            if (torrent.name.includes('1080')) quality = "1080p";
            else if (torrent.name.includes('720')) quality = "720p";

            return {
                name: `⭐ MASTER-NYAA\n${quality}`,
                title: `${torrent.name}\n👥 ${torrent.seeders} 💾 ${torrent.fileSize}`,
                infoHash: hashMatch[1].toLowerCase()
            };
        }).filter(Boolean);
    } catch (e) { 
        console.log("❌ Error en Nyaa API:", e.message);
        return []; 
    }
}

app.get('/manifest.json', (req, res) => res.json(manifest));
app.get('/:config/manifest.json', (req, res) => res.json(manifest));

app.get('/:config?/stream/:type/:id.json', async (req, res) => {
    const isSukebei = req.params.config && req.params.config.includes('sukebei=true');
    const { type, id } = req.params;
    let queries = [];

    try {
        const cleanId = id.split(":")[0];
        const metaUrl = id.startsWith("tt") 
            ? `https://v3-cinemeta.strem.io/meta/${type}/${cleanId}.json`
            : `https://kitsu.io/api/edge/anime/${cleanId.replace('kitsu:','')}`;
        
        const metaRes = await axios.get(metaUrl);
        
        if (id.startsWith("tt")) {
            queries.push(metaRes.data.meta.name);
        } else {
            const attr = metaRes.data.data.attributes;
            queries.push(attr.canonicalTitle);
            if (attr.titles.en) queries.push(attr.titles.en);
        }
    } catch (e) { queries.push(id); }

    // Ejecutar búsquedas para todos los nombres encontrados
    const allResults = await Promise.all(queries.map(q => searchNyaa(q, isSukebei)));
    const streams = [].concat(...allResults);

    res.json({ streams });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => console.log('🚀 Nyaa Torrents v1.5.3 Online'));
