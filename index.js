import express from 'express';
import cors from 'cors';
import { init } from "@heyputer/puter.js/src/init.cjs";

// --- KONFIGURASI ---
const app = express();
const PORT = process.env.PORT || 3000;
const CUSTOM_VOICE_ID = "gmnazjXOFoOcWA59sd5m"; // Voice ID Pilihan Kamu

// --- INISIALISASI PUTER ---
// Token akan diambil dari Environment Variable di Render
let puter;
try {
    // Cek apakah token ada
    if (!process.env.PUTER_AUTH_TOKEN) {
        console.warn('⚠️ WARNING: PUTER_AUTH_TOKEN tidak ditemukan di environment variables!');
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

// 1. Cek Kesehatan Server (Health Check)
app.get('/', (req, res) => {
    res.json({
        status: 'Online 🟢',
        service: 'Puter.js ElevenLabs TTS Proxy',
        voiceId: CUSTOM_VOICE_ID,
        puterReady: !!puter
    });
});

// 2. Endpoint Utama TTS
app.post('/tts', async (req, res) => {
    try {
        const { text, model = 'eleven_multilingual_v2' } = req.body;

        if (!text) return res.status(400).json({ error: 'Text is required' });
        if (!puter) return res.status(503).json({ error: 'Puter service not initialized' });

        console.log(`🔊 Generating: "${text.substring(0, 30)}..."`);

        // Panggil Puter.js
        const audio = await puter.ai.txt2speech(text, {
            provider: 'elevenlabs',
            voice: CUSTOM_VOICE_ID,
            model: model,
            output_format: 'mp3_44100_128'
        });

        if (!audio || !audio.src) {
            throw new Error('Failed to generate audio URL');
        }

        // Sukses
        res.json({
            success: true,
            audioUrl: audio.src,
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
