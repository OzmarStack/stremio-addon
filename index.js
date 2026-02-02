const { addonBuilder } = require('stremio-addon-sdk');
const { si, sukebei } = require('nyaapi');
const axios = require('axios');
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors()); 
app.use(express.static(__dirname)); 

const orangeLogoBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAMAAAB4YyS8AAAASFBMVEUAAAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD/pAD7pU9DAAAAGHRSTlMAECBAUGBwgICAkJCgoLDAwMDQ0NDg4PD89mS3AAAAhUlEQVRo3u3ZSQ6EMAwFURNmS0ggof9tByS0pE676id9S6v8S5Ysc8SOn9v7uH0+T230Xvffp3beT2v0nvvXU7v0P6Xv1777f+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77X+77f+77X+77f+77/wf8A3S9E3S9L7TfAAAAAElFTkSuQmCC";

const manifest = {
    id: "org.masterofreality.nyaa.torrents.final", // ID renovado
    version: "1.4.3", 
    name: "Nyaa Torrents 🍊",
    description: "Anime desde Nyaa.si - Master Of Reality Edition",
    logo: orangeLogoBase64,
    resources: ["stream"],
    types: ["anime", "series", "movie"], // Añadimos 'movie' por si acaso
    idPrefixes: ["tt", "kitsu"], // IDs de IMDB y Kitsu
    catalogs: [],
    behaviorHints: {
        configurable: true,
        configurationRequired: false
    }
};

const builder = new addonBuilder(manifest);

// Lógica de búsqueda mejorada
async function generateQueries(type, id) {
    let queries = [];
    const cleanId = id.split(":")[0];
    try {
        const isImdb = id.startsWith("tt");
        const url = isImdb 
            ? `https://v3-cinemeta.strem.io/meta/${type}/${cleanId}.json`
            : `https://kitsu.io/api/edge/anime/${cleanId.replace('kitsu:','')}`;
        
        const res = await axios.get(url);
        const meta = isImdb ? res.data.meta : res.data.data.attributes;
        
        if (meta) {
            let names = isImdb ? [meta.name] : [meta.canonicalTitle, meta.titles.en, meta.titles.en_jp];
            if (meta.aliases) names = [...names, ...meta.aliases];
            names = [...new Set(names)].filter(Boolean).map(n => n.split(':')[0].trim());

            const parts = id.split(':');
            const episode = parts[2];

            names.forEach(name => {
                if (episode) {
                    const pE = episode.toString().padStart(2, '0');
                    queries.push(`${name} ${pE}`);
                    queries.push(`${name} - ${pE}`);
                }
                queries.push(name); // Búsqueda general del título
            });
        }
    } catch (e) { console.log("Error de metadatos"); }
    return [...new Set(queries)];
}

builder.defineStreamHandler(async (args) => {
    const { type, id, config } = args;
    const searchQueries = await generateQueries(type, id);
    let allStreams = new Map();

    const processResults = (results, sourceName) => {
        if (!results || !Array.isArray(results)) return;
        results.forEach(torrent => {
            const hashMatch = torrent.magnet ? torrent.magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/) : null;
            const infoHash = hashMatch ? hashMatch[1].toLowerCase() : null;
            if (infoHash && !allStreams.has(infoHash)) {
                const q = torrent.name.includes('1080') ? '1080p' : (torrent.name.includes('720') ? '720p' : '720p');
                allStreams.set(infoHash, {
                    name: `🍊 NYAA\n${q}`, 
                    title: `[${sourceName}] ${torrent.name}\n👥 ${torrent.seeders || 0} 💾 ${torrent.fileSize || ''}`,
                    infoHash: infoHash
                });
            }
        });
    };

    const promises = searchQueries.map(async (query) => {
        const tasks = [
            si.search(query, 15, { category: '1_0' }).then(r => processResults(r, 'Nyaa')).catch(() => {})
        ];
        if (!config || config.sukebei === 'true') {
            tasks.push(sukebei.search(query, 15, { category: '0_0' }).then(r => processResults(r, 'Sukebei')).catch(() => {}));
        }
        await Promise.all(tasks);
    });

    await Promise.all(promises);
    return { streams: Array.from(allStreams.values()) };
});

const addonInterface = builder.getInterface();
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/manifest.json', (req, res) => res.json(manifest));
app.get('/:config/manifest.json', (req, res) => res.json(manifest));

// Rutas de streams corregidas para máxima compatibilidad
app.get('/:config/stream/:type/:id.json', async (req, res) => {
    const config = { sukebei: req.params.config.includes('sukebei=true') ? 'true' : 'false' };
    const streams = await addonInterface.handlers.stream({ type: req.params.type, id: req.params.id, config });
    res.json(streams);
});

app.get('/stream/:type/:id.json', async (req, res) => {
    const streams = await addonInterface.handlers.stream({ type: req.params.type, id: req.params.id });
    res.json(streams);
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`🚀 Nyaa Torrents listo - Master Of Reality`));
