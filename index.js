const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const { si, sukebei } = require('nyaapi');
const axios = require('axios');

// --- CONFIGURACIÓN DEL ADDON ---
const manifest = {
    id: "org.ozmar.nyaa.nami", // Cambiamos el ID para que Stremio lo vea como nuevo
    version: "1.1.0",
    name: "Nami Nyaa Streams", // Un nombre que lo diferencie de Torrentio
    description: "Anime directo de Nyaa.si - El tesoro de Ozmar",
    logo: "",
    resources: ["stream"],
    types: ["anime", "series"],
    idPrefixes: ["tt", "kitsu"]
};

const builder = new addonBuilder(manifest);

// --- UTILIDADES ---

// Limpia títulos sucios (ej: "Spy x Family: Part 2" -> "Spy x Family")
function clean(text) {
    if (!text) return "";
    return text.split(':')[0].split('(')[0].trim().replace(/['"]/g, '');
}

// Convierte números simples a formato 01, 05, etc.
function pad(num) {
    return num ? num.toString().padStart(2, '0') : "01";
}

// --- GENERADOR DE BÚSQUEDAS INTELIGENTE ---
// Crea múltiples variantes de búsqueda para asegurar resultados
async function generateQueries(type, id) {
    let queries = [];

    // === CASO A: CINEMETA (IMDB) ===
    if (id.startsWith("tt")) {
        const cleanId = id.split(":")[0];
        try {
            // Obtenemos metadatos de Cinemeta
            const res = await axios.get(`https://v3-cinemeta.strem.io/meta/${type}/${cleanId}.json`);
            const meta = res.data.meta;

            // Recopilamos el nombre y los alias
            let names = [meta.name];
            if (meta.aliases && Array.isArray(meta.aliases)) {
                names = [...names, ...meta.aliases];
            }
            // Limpiamos y eliminamos duplicados
            names = [...new Set(names)].filter(Boolean).map(n => clean(n));

            // Si es SERIE (tiene temporada y capítulo)
            if (type === 'series' && id.includes(':')) {
                const parts = id.split(':');
                const season = parts[1];
                const episode = parts[2];

                names.forEach(name => {
                    // Estrategia 1: S01E05
                    queries.push(`${name} S${pad(season)}E${pad(episode)}`);
                    // Estrategia 2: 05 (Solo para temporada 1)
                    if (season === "1" || season === "01") {
                        queries.push(`${name} - ${pad(episode)}`);
                        queries.push(`${name} ${pad(episode)}`);
                    }
                });
            } else {
                // Películas
                names.forEach(name => queries.push(name));
            }
        } catch (e) { console.log(`Error Cinemeta: ${e.message}`); }
    } 
    
    // === CASO B: KITSU (Anime) ===
    else if (id.startsWith("kitsu")) {
        try {
            const parts = id.split(":");
            const animeId = parts[1];
            const episodeNum = parts.length > 2 ? parts[2] : null;

            // Obtenemos metadatos de Kitsu
            const res = await axios.get(`https://kitsu.io/api/edge/anime/${animeId}`);
            const attrs = res.data.data.attributes;
            
            // Kitsu nos da títulos en Inglés y Japonés
            const titles = [attrs.titles.en, attrs.titles.en_jp, attrs.canonicalTitle].filter(Boolean);

            titles.forEach(t => {
                const cT = clean(t);
                if (episodeNum) {
                    // Kitsu usa números absolutos (ej. One Piece 1000)
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
    // Nota: Los console.log se verán en el panel de Render
    console.log(`📥 Solicitud: ${type} ${id}`);
    
    const searchQueries = await generateQueries(type, id);
    if (searchQueries.length === 0) return { streams: [] };

    let allStreams = new Map();

    // Función para procesar resultados de cualquier fuente
    const processResults = (results, sourceName) => {
        results.forEach(torrent => {
            const hashMatch = torrent.magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/);
            const infoHash = hashMatch ? hashMatch[1].toLowerCase() : null;

            if (infoHash && !allStreams.has(infoHash)) {
                // Detectamos calidad para agrupar bonito
                const quality = torrent.name.includes('1080') ? '1080p' : (torrent.name.includes('720') ? '720p' : 'SD');
                
                allStreams.set(infoHash, {
                    name: sourceName, 
                    title: `[${sourceName}] ${torrent.name}\n💾 ${torrent.fileSize} 👥 ${torrent.seeders}`,
                    infoHash: infoHash,
                    behaviorHints: { 
                        bingeGroup: `${sourceName}-${quality}`
                    }
                });
            }
        });
    };

    // Ejecutamos búsquedas paralelas en Nyaa y Sukebei
    const promises = searchQueries.map(async (query) => {
        // 1. Nyaa (Anime General)
        const nyaaPromise = si.search(query, 15, { category: '1_0', filter: 0 })
            .then(r => processResults(r, 'Nyaa'))
            .catch(e => {}); 

        // 2. Sukebei (Art/Hentai) - category 0_0 busca en todo Sukebei
        const sukebeiPromise = sukebei.search(query, 15, { category: '0_0', filter: 0 })
            .then(r => processResults(r, 'Sukebei'))
            .catch(e => {});

        await Promise.all([nyaaPromise, sukebeiPromise]);
    });

    await Promise.all(promises);
    
    const finalStreams = Array.from(allStreams.values());
    
    // Ordenamos por semillas (seeders)
    finalStreams.sort((a, b) => {
        const seedsA = parseInt(a.title.split('👥')[1]) || 0;
        const seedsB = parseInt(b.title.split('👥')[1]) || 0;
        return seedsB - seedsA;
    });

    console.log(`✅ Encontrados: ${finalStreams.length}`);
    return items.map(item => ({
    name: "🍊 Nami Nyaa\n" + (item.quality || "HD"), // Aparecerá en el botón de selección
    title: item.title,
    infoHash: item.infoHash
}));
// --- INICIO DEL SERVIDOR (CRUCIAL PARA RENDER) ---
const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port: port });
console.log(`🚀 Addon activo en puerto: ${port}`);

