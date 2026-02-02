const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const { si, sukebei } = require('nyaapi');
const axios = require('axios');

// --- CONFIGURACIÓN DEL ADDON ---
const manifest = {
    id: "org.ozmar.nyaa.nami",
    version: "1.1.0",
    name: "Nami Nyaa Streams",
    description: "Anime directo de Nyaa.si - El tesoro de Ozmar",
    logo: "https://i.imgur.com/8N4N3uW.png",
    resources: ["stream"],
    types: ["anime", "series"],
    idPrefixes: ["tt", "kitsu"]
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

// --- GENERADOR DE BÚSQUEDAS ---
async function generateQueries(type, id) {
    let queries = [];
    if (id.startsWith("tt")) {
        const cleanId = id.split(":")[0];
        try {
            const res = await axios.get(`https://v3-cinemeta.strem.io/meta/${type}/${cleanId}.json`);
            const meta = res.data.meta;
            let names = [meta.name];
            if (meta.aliases && Array.isArray(meta.aliases)) {
                names = [...names, ...meta.aliases];
            }
            names = [...new Set(names)].filter(Boolean).map(n => clean(n));

            if (type === 'series' && id.includes(':')) {
                const parts = id.split(':');
                const season = parts[1];
                const episode = parts[2];
                names.forEach(name => {
                    queries.push(`${name} S${pad(season)}E${pad(episode)}`);
                    if (season === "1" || season === "01") {
                        queries.push(`${name} - ${pad(episode)}`);
                        queries.push(`${name} ${pad(episode)}`);
                    }
                });
            } else {
                names.forEach(name => queries.push(name));
            }
        } catch (e) { console.log(`Error Cinemeta: ${e.message}`); }
    } else if (id.startsWith("kitsu")) {
        try {
            const parts = id.split(":");
            const animeId = parts[1];
            const episodeNum = parts.length > 2 ? parts[2] : null;
            const res = await axios.get(`https://kitsu.io/api/edge/anime/${animeId}`);
            const attrs = res.data.data.attributes;
            const titles = [attrs.titles.en, attrs.titles.en_jp, attrs.canonicalTitle].filter(Boolean);
            titles.forEach(t => {
                const cT = clean(t);
                if (episodeNum) {
                    queries.push(`${cT} - ${pad(episodeNum)}`);
                    queries.push(`${cT} ${pad(episodeNum)}`);
                } else {
                    queries.push(cT);
                }
            });
        } catch (e) { console.log(`Error Kitsu: ${e.message}`); }
    }
    return [...new Set(queries)];
}

// --- MANEJADOR DE STREAMS ---
builder.defineStreamHandler(async ({ type, id }) => {
    console.log(`📥 Solicitud: ${type} ${id}`);
    const searchQueries = await generateQueries(type, id);
    if (searchQueries.length === 0) return { streams: [] };

    let allStreams = new Map();

    const processResults = (results, sourceName) => {
        results.forEach(torrent => {
            const hashMatch = torrent.magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/);
            const infoHash = hashMatch ? hashMatch[1].toLowerCase() : null;

            if (infoHash && !allStreams.has(infoHash)) {
                const quality = torrent.name.includes('1080') ? '1080p' : (torrent.name.includes('720') ? '720p' : 'HD');
                allStreams.set(infoHash, {
                    name: `🍊 Nami\n${quality}`, 
                    title: `[${sourceName}] ${torrent.name}\n💾 ${torrent.fileSize} 👥 ${torrent.seeders}`,
                    infoHash: infoHash
                });
            }
        });
    };

    const promises = searchQueries.map(async (query) => {
        const nyaaPromise = si.search(query, 15, { category: '1_0', filter: 0 })
            .then(r => processResults(r, 'Nyaa'))
            .catch(e => {}); 
        const sukebeiPromise = sukebei.search(query, 15, { category: '0_0', filter: 0 })
            .then(r => processResults(r, 'Sukebei'))
            .catch(e => {});
        await Promise.all([nyaaPromise, sukebeiPromise]);
    });

    await Promise.all(promises);
    const finalStreams = Array.from(allStreams.values());

    finalStreams.sort((a, b) => {
        const seedsA = parseInt(a.title.split('👥')[1]) || 0;
        const seedsB = parseInt(b.title.split('👥')[1]) || 0;
        return seedsB - seedsA;
    });

    console.log(`✅ Encontrados: ${finalStreams.length}`);
    return { streams: finalStreams };
});

// --- INICIO DEL SERVIDOR ---
const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port: port });
console.log(`🚀 Addon activo en puerto: ${port}`);

