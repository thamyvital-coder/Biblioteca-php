require('dotenv').config();

const { TikTokLiveConnection } = require('tiktok-live-connector');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pipeline } = require('node:stream/promises');
const player = require('play-sound')();

const requiredEnv = ['ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID', 'GEMINI_API_KEY', 'TIKTOK_USERNAME'];
const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(`Configuração ausente no .env: ${missing.join(', ')}`);
  console.error('Copie .env.example para .env e preencha as variáveis.');
  process.exit(1);
}

const {
  ELEVENLABS_API_KEY,
  ELEVENLABS_VOICE_ID,
  GEMINI_API_KEY,
  TIKTOK_USERNAME,
} = process.env;

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const ELEVENLABS_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const MAX_REPLY_CHARS = Number(process.env.MAX_REPLY_CHARS || 350);
const MIN_CHAT_INTERVAL_MS = Number(process.env.MIN_CHAT_INTERVAL_MS || 1800);
const MAX_QUEUE_SIZE = Number(process.env.MAX_QUEUE_SIZE || 5);
const TEMP_DIR = path.join(os.tmpdir(), 'tiktok-live-voice-bot');

fs.mkdirSync(TEMP_DIR, { recursive: true });

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: GEMINI_MODEL,
  systemInstruction: [
    'Você interpreta uma versão virtual divertida e inspirada em um personagem clássico de desenho animado.',
    'Personalidade: extremamente otimista, alegre, amigável, brincalhona, carismática, curiosa e leal.',
    'Fale em português brasileiro informal e natural. Responda em uma ou duas frases curtas.',
    'Use ocasionalmente expressões como “Ah, puxa!”, “Oba!”, “Nossa, essa foi boa!” e “Ha-ha!”. Não repita bordões em mensagens consecutivas.',
    'Agradeça elogios, mande salves quando pedirem e conte histórias claramente fictícias e engraçadas sobre amigos e aventuras.',
    'Se a pergunta for séria, responda com respeito e clareza. Nunca humilhe ninguém nem invente notícias ou fatos atuais.',
    'Se perguntarem diretamente, seja transparente de que esta é uma experiência virtual automatizada.',
    'Responda somente com a fala a ser pronunciada; não inclua rótulos, aspas ou instruções de atuação.',
  ].join(' '),
});

const tiktokLive = new TikTokLiveConnection(TIKTOK_USERNAME);
let queue = Promise.resolve();
let queuedCount = 0;
let lastAcceptedAt = 0;
let isShuttingDown = false;

function cleanText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_REPLY_CHARS);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateReply(comment) {
  const result = await model.generateContent(comment);
  const reply = cleanText(result?.response?.text?.());
  if (!reply) throw new Error('O Gemini retornou uma resposta vazia.');
  return reply;
}

async function synthesizeSpeech(text, filePath) {
  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(ELEVENLABS_VOICE_ID)}`,
    {
      text,
      model_id: ELEVENLABS_MODEL,
      voice_settings: {
        stability: Number(process.env.VOICE_STABILITY || 0.45),
        similarity_boost: Number(process.env.VOICE_SIMILARITY_BOOST || 0.8),
        style: Number(process.env.VOICE_STYLE || 0.35),
        use_speaker_boost: true,
      },
      output_format: 'mp3_44100_128',
    },
    {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      responseType: 'stream',
      timeout: 60000,
    },
  );

  await pipeline(response.data, fs.createWriteStream(filePath));
}

function playAudio(filePath) {
  return new Promise((resolve, reject) => {
    player.play(filePath, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function processComment(data) {
  const comment = cleanText(data?.comment);
  if (!comment) return;

  console.log(`Comentário de @${data.uniqueId || 'usuário'}: ${comment}`);

  const filePath = path.join(TEMP_DIR, `fala-${Date.now()}-${Math.random().toString(16).slice(2)}.mp3`);

  try {
    const reply = await generateReply(comment);
    console.log('Resposta gerada:', reply);

    await synthesizeSpeech(reply, filePath);
    await playAudio(filePath);
  } catch (error) {
    const status = error?.response?.status;
    const detail = error?.response?.data;
    console.error('Falha ao processar comentário:', status ? `HTTP ${status}` : error.message);
    if (detail && !detail.pipe) {
      console.error('Detalhes da API:', detail.message || detail);
    }
  } finally {
    try {
      await fs.promises.rm(filePath, { force: true });
    } catch (error) {
      console.warn('Não foi possível apagar o áudio temporário:', error.message);
    }
  }
}

function enqueueComment(data) {
  const now = Date.now();
  if (now - lastAcceptedAt < MIN_CHAT_INTERVAL_MS) return;
  if (queuedCount >= MAX_QUEUE_SIZE) {
    console.warn('Fila cheia; comentário ignorado para evitar atraso na live.');
    return;
  }

  lastAcceptedAt = now;
  queuedCount += 1;

  queue = queue
    .then(() => processComment(data))
    .catch((error) => console.error('Erro inesperado na fila:', error))
    .finally(() => {
      queuedCount = Math.max(0, queuedCount - 1);
    });
}

tiktokLive.on('chat', enqueueComment);

tiktokLive.on('connected', (state) => {
  console.log('Conectado à live com sucesso!', state?.roomId ? `Sala: ${state.roomId}` : '');
});

tiktokLive.on('disconnected', () => {
  console.warn('A conexão com o TikTok LIVE foi encerrada.');
});

tiktokLive.on('error', (error) => {
  console.error('Erro do TikTok LIVE:', error?.message || error);
});

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\nRecebido ${signal}; aguardando a fila terminar...`);
  try {
    await queue;
  } finally {
    process.exit(0);
  }
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

tiktokLive.connect()
  .then(() => console.log(`Bot iniciado para @${TIKTOK_USERNAME}. Pressione Ctrl+C para encerrar.`))
  .catch((error) => {
    console.error('Falha ao conectar ao TikTok LIVE:', error?.message || error);
    process.exitCode = 1;
  });
