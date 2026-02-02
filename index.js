import express from 'express';
import cors from 'cors';
import { init } from "@heyputer/puter.js/src/init.cjs";

// --- KONFIGURASI ---
const app = express();
const PORT = process.env.PORT || 3000;
const DEFAULT_VOICE_ID = "gmnazjXOFoOcWA59sd5m"; // Default Voice (Toing)

// --- INISIALISASI PUTER ---
let puter;
try {
    if (!process.env.PUTER_AUTH_TOKEN) {
        console.warn('⚠️ WARNING: PUTER_AUTH_TOKEN tidak ditemukan!');
    }
    puter = init(process.env.PUTER_AUTH_TOKEN);
    console.log('✅ Puter initialized successfully');
} catch (error) {
    console.warn('⚠️ Puter initialization warning:', error.message);
}

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- ROUTES ---

// 1. Cek Kesehatan Server
app.get('/', (req, res) => {
    res.json({
        status: 'Online 🟢',
        service: 'Puter.js ElevenLabs TTS Proxy',
        defaultVoice: DEFAULT_VOICE_ID,
        puterReady: !!puter
    });
});

// 2. Endpoint Utama TTS
app.post('/tts', async (req, res) => {
    try {
        const { 
            text, 
            model = 'eleven_multilingual_v2',
            voice_id,      // Ambil voice_id dari request
            output_format = 'mp3_44100_128'
        } = req.body;

        if (!text) return res.status(400).json({ error: 'Text is required' });
        if (!puter) return res.status(503).json({ error: 'Puter service not initialized' });

        // Tentukan Voice ID: Pakai dari request > Default
        const targetVoice = voice_id || DEFAULT_VOICE_ID;

        console.log(`🔊 Generating: Voice=${targetVoice} Text="${text.substring(0, 30)}..."`);

        // Panggil Puter.js
        const audio = await puter.ai.txt2speech(text, {
            provider: 'elevenlabs',
            voice: targetVoice, // Gunakan dynamic voice ID
            model: model,
            output_format: output_format
        });

        if (!audio || !audio.src) {
            throw new Error('Failed to generate audio URL');
        }

        // Sukses
        res.json({
            success: true,
            audioUrl: audio.src,
            usedVoice: targetVoice,
            message: 'Audio generated successfully'
        });

    } catch (error) {
        console.error('❌ TTS Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- JALANKAN SERVER ---
app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di port ${PORT}`);
});
