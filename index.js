import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { init } from "@heyputer/puter.js/src/init.cjs";

// Load environment variables
dotenv.config();

// --- KONFIGURASI ---
const app = express();
const PORT = process.env.PORT || 3000;
const DEFAULT_VOICE_ID = "gmnazjXOFoOcWA59sd5m"; // Dakocan Voice

// --- INISIALISASI PUTER ---
let puter;
try {
    if (!process.env.PUTER_AUTH_TOKEN) {
        console.warn('⚠️ WARNING: PUTER_AUTH_TOKEN tidak ditemukan di environment!');
        console.warn('❌ Server akan berjalan tapi TTS akan gagal');
    } else {
        console.log('✅ PUTER_AUTH_TOKEN ditemukan');
    }
    
    puter = init(process.env.PUTER_AUTH_TOKEN);
    console.log('✅ Puter initialized successfully');
} catch (error) {
    console.error('❌ Error initializing Puter:', error.message);
    console.error('Stack:', error.stack);
}

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// --- ROUTES ---

// 1. Health Check / Root
app.get('/', (req, res) => {
    res.json({
        status: '🟢 Online',
        service: 'Puter.js ElevenLabs TTS API',
        version: '1.0.0',
        defaultVoice: DEFAULT_VOICE_ID,
        defaultVoiceName: 'Dakocan (Multilingual)',
        puterInitialized: !!puter,
        tokenSet: !!process.env.PUTER_AUTH_TOKEN,
        endpoints: {
            health: 'GET /',
            generateTTS: 'POST /tts',
            docs: 'GET /docs'
        }
    });
});

// 2. Dokumentasi
app.get('/docs', (req, res) => {
    res.json({
        title: 'Puter.js ElevenLabs TTS API',
        description: 'Free Text-to-Speech API powered by Puter.js and ElevenLabs',
        baseUrl: 'https://puter-tts-api.onrender.com',
        endpoints: {
            'POST /tts': {
                description: 'Generate speech from text',
                method: 'POST',
                requestBody: {
                    text: 'string (required) - Max 3000 characters',
                    voice_id: 'string (optional) - ElevenLabs voice ID, default: gmnazjXOFoOcWA59sd5m',
                    model: 'string (optional) - eleven_multilingual_v2, eleven_flash_v2_5, eleven_turbo_v2_5',
                    output_format: 'string (optional) - mp3_44100_128 (default), mp3_44100_192, pcm_16000, etc'
                },
                example: {
                    url: 'POST https://puter-tts-api.onrender.com/tts',
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                        text: 'Hello! This is a test of ElevenLabs TTS via Puter.js',
                        voice_id: 'gmnazjXOFoOcWA59sd5m',
                        model: 'eleven_multilingual_v2'
                    }
                },
                response: {
                    success: 'boolean',
                    audioUrl: 'string (data URL of audio)',
                    usedVoice: 'string',
                    textLength: 'number',
                    model: 'string',
                    message: 'string'
                }
            }
        }
    });
});

// 3. Endpoint Utama TTS - PERBAIKAN
app.post('/tts', async (req, res) => {
    const startTime = Date.now();
    
    try {
        // Validasi input
        const { 
            text, 
            model = 'eleven_multilingual_v2',
            voice_id,
            output_format = 'mp3_44100_128'
        } = req.body;

        // Validasi text
        if (!text) {
            return res.status(400).json({ 
                success: false,
                error: 'Text is required',
                example: {
                    text: 'Hello world!',
                    voice_id: 'gmnazjXOFoOcWA59sd5m'
                }
            });
        }

        if (text.length > 3000) {
            return res.status(400).json({ 
                success: false,
                error: 'Text exceeds 3000 character limit',
                textLength: text.length,
                maxLength: 3000
            });
        }

        // Cek Puter
        if (!puter) {
            return res.status(503).json({ 
                success: false,
                error: 'Puter service not initialized',
                hint: 'Check PUTER_AUTH_TOKEN in environment'
            });
        }

        // Tentukan Voice ID
        const targetVoice = voice_id || DEFAULT_VOICE_ID;

        console.log(`📝 Request TTS:`);
        console.log(`   Text length: ${text.length} chars`);
        console.log(`   Voice: ${targetVoice}`);
        console.log(`   Model: ${model}`);
        console.log(`   Format: ${output_format}`);

        // PERBAIKAN: Timeout handling
        let audio;
        try {
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('TTS generation timeout (>30s)')), 30000)
            );

            const ttsPromise = puter.ai.txt2speech(text, {
                provider: 'elevenlabs',
                voice: targetVoice,
                model: model,
                output_format: output_format
            });

            audio = await Promise.race([ttsPromise, timeoutPromise]);

        } catch (ttsError) {
            console.error('❌ TTS Generation Error:', ttsError.message);
            console.error('   Full error:', ttsError);
            
            return res.status(500).json({
                success: false,
                error: 'Failed to generate audio',
                details: ttsError.message,
                hint: 'Check PUTER_AUTH_TOKEN validity or try again'
            });
        }

        // PERBAIKAN: Validasi audio object
        if (!audio) {
            console.error('❌ Audio is null/undefined');
            return res.status(500).json({
                success: false,
                error: 'Audio generation returned null',
                hint: 'Voice ID or Puter token might be invalid'
            });
        }

        // Ekstrak audio URL dengan error handling
        const audioUrl = audio.src || audio.url || null;
        
        if (!audioUrl) {
            console.error('❌ Audio URL tidak ditemukan:', JSON.stringify(audio));
            return res.status(500).json({
                success: false,
                error: 'Audio URL not found in response',
                audioObject: Object.keys(audio)
            });
        }

        const duration = Date.now() - startTime;

        console.log(`✅ TTS Success (${duration}ms)`);
        console.log(`   Audio URL length: ${audioUrl.length} chars`);

        // Response sukses
        res.json({
            success: true,
            audioUrl: audioUrl,
            usedVoice: targetVoice,
            textLength: text.length,
            model: model,
            outputFormat: output_format,
            generationTime: `${duration}ms`,
            message: 'Audio generated successfully from ElevenLabs via Puter.js'
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ Unhandled TTS Error (${duration}ms):`, error.message);
        console.error('   Stack:', error.stack);
        console.error('   Type:', error.constructor.name);
        
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            duration: `${duration}ms`,
            hint: 'Check server logs for details'
        });
    }
});

// 4. Test endpoint
app.post('/test', async (req, res) => {
    try {
        console.log('🧪 Running test...');
        
        if (!puter) {
            return res.status(503).json({ 
                success: false,
                error: 'Puter not initialized'
            });
        }

        const testText = 'This is a test of ElevenLabs text to speech via Puter.js';
        
        console.log('Testing with:', {
            text: testText,
            voice: DEFAULT_VOICE_ID,
            model: 'eleven_multilingual_v2'
        });

        const audio = await puter.ai.txt2speech(testText, {
            provider: 'elevenlabs',
            voice: DEFAULT_VOICE_ID,
            model: 'eleven_multilingual_v2'
        });

        res.json({
            success: !!audio,
            audio: {
                isValid: !!audio,
                hasSrc: !!(audio && audio.src),
                srcLength: audio && audio.src ? audio.src.length : 0,
                audioKeys: audio ? Object.keys(audio) : []
            }
        });

    } catch (error) {
        console.error('Test error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

// 5. Error handling
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path,
        method: req.method,
        availableEndpoints: ['GET /', 'GET /docs', 'POST /tts', 'POST /test']
    });
});

// --- START SERVER ---
app.listen(PORT, () => {
    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║  🔊 Puter.js ElevenLabs TTS API Server ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');
    console.log(`📍 Server: http://localhost:${PORT}`);
    console.log(`🔗 Endpoints:`);
    console.log(`   GET  http://localhost:${PORT}/           - Health check`);
    console.log(`   GET  http://localhost:${PORT}/docs       - Documentation`);
    console.log(`   POST http://localhost:${PORT}/tts        - Generate TTS`);
    console.log(`   POST http://localhost:${PORT}/test       - Test TTS`);
    console.log('');
    console.log(`🎤 Default Voice: ${DEFAULT_VOICE_ID} (Dakocan)`);
    console.log(`🔐 Token Status: ${process.env.PUTER_AUTH_TOKEN ? '✅ Set' : '❌ Not Set'}`);
    console.log(`📦 Puter Status: ${puter ? '✅ Ready' : '❌ Not Ready'}`);
    console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n📛 SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n📛 SIGINT received, shutting down gracefully...');
    process.exit(0);
});
