const { addonBuilder } = require('stremio-addon-sdk');
const { si, sukebei } = require('nyaapi');
const axios = require('axios');
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors()); 
app.use(express.static(__dirname)); 

const manifest = {
    // ID actualizado para forzar una instalación limpia
    id: "org.masterofreality.nyaa.torrents", 
    version: "1.4.0", 
    name: "Nyaa Torrents",
    description: "Anime desde Nyaa.si - By Master Of Reality",
    // Logo de Naranja (Link de alta compatibilidad)
    logo: "https://i.imgur.com/vH9T4Fm.png", 
    resources: ["stream"],
    types: ["anime", "series"],
    idPrefixes: ["tt", "kitsu"],
    catalogs: [],
    behaviorHints: {
        configurable: true,
        configurationRequired: false
    }
};

const builder = new addonBuilder(manifest);

// --- LÓGICA DE BÚSQUEDA ---
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
            const episode = parts[2] || (id.startsWith("kitsu") ? parts[2] : null);

            names.forEach(name => {
                if (episode) {
                    const pE = episode.toString().padStart(2, '0');
                    queries.push(`${name} - ${pE}`);
                    queries.push(`${name} ${pE}`);
                } else {
                    queries.push(name);
                }
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
                const q = torrent.name.includes('1080') ? '1080p' : (torrent.name.includes('720') ? '720p' : 'HD');
                allStreams.set(infoHash, {
                    name: `🍊 Nyaa\n${q}`, 
                    title: `[${sourceName}] ${torrent.name}\n👥 ${torrent.seeders || 0} 💾 ${torrent.fileSize || ''}`,
                    infoHash: infoHash
                });
            }
        });
    };

    const promises = searchQueries.map(async (query) => {
        const tasks = [si.search(query, 10, { category: '1_0' }).then(r => processResults(r, 'Nyaa')).catch(() => {})];
        if (!config || config.sukebei === 'true') {
            tasks.push(sukebei.search(query, 10, { category: '0_0' }).then(r => processResults(r, 'Sukebei')).catch(() => {}));
        }
        await Promise.all(tasks);
    });

    await Promise.all(promises);
    return { streams: Array.from(allStreams.values()).sort((a, b) => {
        const sA = parseInt(a.title.split('👥')[1]) || 0;
        const sB = parseInt(b.title.split('👥')[1]) || 0;
        return sB - sA;
    })};
});

// --- RUTAS DEL SERVIDOR ---
const addonInterface = builder.getInterface();

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/:config?/manifest.json', (req, res) => {
    res.json(manifest);
});

app.get('/:config/stream/:type/:id.json', (req, res) => {
    const config = req.params.config ? req.params.config.split(',').reduce((acc, curr) => {
        const [k, v] = curr.split('=');
        acc[k] = v;
        return acc;
    }, {}) : {};
    addonInterface.handlers.stream({ type: req.params.type, id: req.params.id, config }).then(r => res.json(r));
});

app.get('/stream/:type/:id.json', (req, res) => {
    addonInterface.handlers.stream({ type: req.params.type, id: req.params.id }).then(r => res.json(r));
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`🚀 Nyaa Torrents listo - Master Of Reality Edition`));
