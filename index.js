const express = require('express');
const cors = require('cors');
const { si, sukebei } = require('nyaapi');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.static(__dirname));

const orangeLogo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAMAAAB4YyS8AAAASFBMVEUAAAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD7pU9DAAAAGHRSTlMAECBAUGBwgICAkJCgoLDAwMDQ0NDg4PD89mS3AAAAhUlEQVRo3u3ZSQ6EMAwFURNmS0ggof9tByS0pE676id9S6v8S5Ysc8SOn9v7uH0+T230Xvffp3beT2v0nvvXU7v0P6Xv1777f+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77f+77X+77f+77/wf8A3S9E3S9L7TfAAAAAElFTkSuQmCC";

const manifest = {
    id: "org.masterofreality.nyaa.final.v8",
    version: "1.4.4",
    name: "Nyaa Torrents 🍊",
    description: "Anime desde Nyaa.si - Master Of Reality Edition",
    logo: orangeLogo,
    resources: ["stream"],
    types: ["anime", "series", "movie"],
    idPrefixes: ["tt", "kitsu"],
    behaviorHints: { configurable: true }
};

// Función de búsqueda optimizada para Nyaa
async function searchNyaa(query, isSukebei) {
    try {
        const results = isSukebei 
            ? await sukebei.search(query, 12, { category: '0_0' })
            : await si.search(query, 12, { category: '1_0' });
        
        return (results || []).map(torrent => {
            const hash = torrent.magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/)[1].toLowerCase();
            const quality = torrent.name.includes('1080') ? '1080p' : (torrent.name.includes('720') ? '720p' : 'HD');
            return {
                name: `🍊 NYAA\n${quality}`,
                title: `${torrent.name}\n👥 ${torrent.seeders} 💾 ${torrent.fileSize}`,
                infoHash: hash
            };
        });
    } catch (e) { return []; }
}

// RUTA CRÍTICA: Manifest
app.get('/:config?/manifest.json', (req, res) => {
    res.json(manifest);
});

// RUTA CRÍTICA: Stream
app.get('/:config?/stream/:type/:id.json', async (req, res) => {
    const { type, id, config } = req.params;
    const isSukebei = config && config.includes('sukebei=true');
    
    // Obtener nombre del contenido
    let query = id;
    try {
        const cleanId = id.split(":")[0];
        const metaUrl = id.startsWith("tt") 
            ? `https://v3-cinemeta.strem.io/meta/${type}/${cleanId}.json`
            : `https://kitsu.io/api/edge/anime/${cleanId.replace('kitsu:','')}`;
        const metaRes = await axios.get(metaUrl);
        query = id.startsWith("tt") ? metaRes.data.meta.name : metaRes.data.data.attributes.canonicalTitle;
    } catch(e) {}

    const streams = await searchNyaa(query, isSukebei);
    res.json({ streams });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const port = process.env.PORT || 10000;
app.listen(port, () => console.log('Master Of Reality: Nyaa Torrents Online'));
