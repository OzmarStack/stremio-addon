const express = require('express');
const cors = require('cors');
const { si, sukebei } = require('nyaapi');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.static(__dirname));

// Imagen en Base64 integrada por Master Of Reality
const orangeLogo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAMAAAB4YyS8AAAASFBMVEUAAAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD7pU9DAAAAGHRSTlMAECBAUGBwgICAkJCgoLDAwMDQ0NDg4PD89mS3AAAAhUlEQVRo3u3ZSQ6EMAwFURNmS0ggof9tByS0pE676id9S6v8S5Ysc8SOn9v7uH0+T230Xvffp3beT2v0nvvXU7v0P6Xv1777f+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77f+77X+77f+77/wf8A3S9E3S9L7TfAAAAAElFTkSuQmCC";

const manifest = {
    id: "com.masterofreality.nyaa.final.fixed", // ID nuevo y limpio
    version: "1.5.0",
    name: "Nyaa Torrents 🍊",
    description: "Anime desde Nyaa.si - Master Of Reality Edition",
    logo: orangeLogo,
    resources: ["stream"],
    types: ["anime", "series", "movie"],
    idPrefixes: ["tt", "kitsu"]
};

// Función de búsqueda optimizada
async function searchNyaa(query, isSukebei) {
    try {
        const results = isSukebei 
            ? await sukebei.search(query, 10, { category: '0_0' })
            : await si.search(query, 10, { category: '1_0' });
        
        return (results || []).map(torrent => {
            const hashMatch = torrent.magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/);
            if (!hashMatch) return null;
            const quality = torrent.name.includes('1080') ? '1080p' : (torrent.name.includes('720') ? '720p' : 'HD');
            return {
                name: `🍊 NYAA\n${quality}`,
                title: `${torrent.name}\n👥 ${torrent.seeders} 💾 ${torrent.fileSize}`,
                infoHash: hashMatch[1].toLowerCase()
            };
        }).filter(Boolean);
    } catch (e) { return []; }
}

// RUTA DE INICIO
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// MANIFEST (Sin configuración)
app.get('/manifest.json', (req, res) => res.json(manifest));

// MANIFEST (Con configuración)
app.get('/:config/manifest.json', (req, res) => res.json(manifest));

// STREAMS
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
    } catch(e) {}

    const streams = await searchNyaa(query, isSukebei);
    res.json({ streams });
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log('Nyaa Torrents 1.5.0 está activo.'));
