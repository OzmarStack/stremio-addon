const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const { si, sukebei } = require('nyaapi');
const axios = require('axios');

const manifest = {
    id: "org.ozmar.nyaa.nami",
    version: "1.3.0",
    name: "Nami Nyaa Streams",
    description: "Anime directo de Nyaa.si - El tesoro de Ozmar",
    logo: "https://i.imgur.com/8N4N3uW.png",
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

// --- UTILIDADES ---
function clean(text) {
    if (!text) return "";
    return text.split(':')[0].split('(')[0].trim().replace(/['"]/g, '');
}

function pad(num) {
    return num ? num.toString().padStart(2, '0') : "01";
}

async function generateQueries(type, id) {
    let queries = [];
    const cleanId = id.split(":")[0];
    try {
        const url = id.startsWith("tt") 
            ? `https://v3-cinemeta.strem.io/meta/${type}/${cleanId}.json`
            : `https://kitsu.io/api/edge/anime/${cleanId.replace('kitsu:','')}`;
        
        const res = await axios.get(url);
        const meta = id.startsWith("tt") ? res.data.meta : res.data.data.attributes;
        
        if (meta) {
            let names = id.startsWith("tt") ? [meta.name] : [meta.canonicalTitle, meta.titles.en, meta.titles.en_jp];
            if (meta.aliases) names = [...names, ...meta.aliases];
            names = [...new Set(names)].filter(Boolean).map(n => clean(n));

            const parts = id.split(':');
            const season = parts[1];
            const episode = parts[2] || (id.startsWith("kitsu") ? parts[2] : null);

            names.forEach(name => {
                if (episode) {
                    queries.push(`${name} S${pad(season)}E${pad(episode)}`);
                    queries.push(`${name} - ${pad(episode)}`);
                    queries.push(`${name} ${pad(episode)}`);
                } else {
                    queries.push(name);
                }
            });
        }
    } catch (e) { console.log(`Error Meta: ${e.message}`); }
    return [...new Set(queries)];
}

// --- MANEJADOR DE STREAMS ---
builder.defineStreamHandler(async (args) => {
    const { type, id, config } = args; // 'config' contiene los ajustes del usuario
    console.log(`📥 Solicitud: ${id} | Config:`, config);

    const searchQueries = await generateQueries(type, id);
    let allStreams = new Map();

    const processResults = (results, sourceName) => {
        if (!results || !Array.isArray(results)) return;
        results.forEach(torrent => {
            const hashMatch = torrent.magnet ? torrent.magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/) : null;
            const infoHash = hashMatch ? hashMatch[1].toLowerCase() : null;

            if (infoHash && !allStreams.has(infoHash)) {
                const quality = torrent.name.includes('1080') ? '1080p' : (torrent.name.includes('720') ? '720p' : 'HD');
                allStreams.set(infoHash, {
                    name: `🍊 Nami\n${quality}`, 
                    title: `[${sourceName}] ${torrent.name}\n💾 ${torrent.fileSize || '??'} 👥 ${torrent.seeders || '0'}`,
                    infoHash: infoHash
                });
            }
        });
    };

    const promises = searchQueries.map(async (query) => {
        const tasks = [si.search(query, 10, { category: '1_0' }).then(r => processResults(r, 'Nyaa')).catch(() => {})];
        
        // SOLO buscamos en Sukebei si el usuario lo activó o si no hay configuración
        if (!config || config.sukebei === 'true') {
            tasks.push(sukebei.search(query, 10, { category: '0_0' }).then(r => processResults(r, 'Sukebei')).catch(() => {}));
        }

        await Promise.all(tasks);
    });

    await Promise.all(promises);
    const finalStreams = Array.from(allStreams.values()).sort((a, b) => {
        const sA = parseInt(a.title.split('👥')[1]) || 0;
        const sB = parseInt(b.title.split('👥')[1]) || 0;
        return sB - sA;
    });

    return { streams: finalStreams };
});

const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port: port });
