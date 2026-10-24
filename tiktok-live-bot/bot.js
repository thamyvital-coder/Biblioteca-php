require('dotenv').config();

const { TikTokLiveConnection } = require('tiktok-live-connector');
const axios = require('axios');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const http = require('node:http');
const { WebSocketServer } = require('ws');
const { pipeline } = require('node:stream/promises');

const requiredEnv = ['ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID', 'OLLAMA_API_KEY', 'TIKTOK_USERNAME'];
const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(`Configuração ausente no .env: ${missing.join(', ')}`);
  console.error('Copie .env.example para .env e preencha as variáveis.');
  process.exit(1);
}

const { ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, OLLAMA_API_KEY, TIKTOK_USERNAME } = process.env;
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'https://ollama.com/api/chat';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma4:31b';
const ELEVENLABS_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const MAX_REPLY_CHARS = Number(process.env.MAX_REPLY_CHARS || 260);
const MIN_CHAT_INTERVAL_MS = Number(process.env.MIN_CHAT_INTERVAL_MS || 1200);
const MAX_QUEUE_SIZE = Number(process.env.MAX_QUEUE_SIZE || 5);
const DEDUPE_WINDOW_MS = Number(process.env.DEDUPE_WINDOW_MS || 15000);
const TEMP_DIR = path.join(__dirname, 'audios');
const VLC_PATH = process.env.VLC_PATH || [
  'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
  'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe',
].find((candidate) => fs.existsSync(candidate));

fs.mkdirSync(TEMP_DIR, { recursive: true });

const OLLAMA_SYSTEM_INSTRUCTION = [
  'Você é um streamer virtual muito carismático, brincalhão, espontâneo e acolhedor, falando português brasileiro informal.',
  'Seja engraçado e criativo sem parecer um robô. Use frases curtas, naturais e fáceis de falar em voz alta.',
  'Varie as reações e não repita bordões em respostas consecutivas. Pode usar humor leve, surpresas e energia de live.',
  'Agradeça presentes pelo nome de quem enviou e pelo nome do presente, com entusiasmo genuíno e uma brincadeira curta quando combinar.',
  'Responda a comentários como numa conversa ao vivo. Mande salves quando pedirem.',
  'Se o assunto for sério, responda com respeito. Não humilhe, não insulte e não invente fatos atuais.',
  'Se perguntarem, diga claramente que você é um bot/assistente virtual.',
  'Responda somente com a fala a ser pronunciada, sem rótulos, aspas, emojis em excesso ou instruções de atuação.',
].join(' ');

const tiktokLive = new TikTokLiveConnection(TIKTOK_USERNAME, {});

const OVERLAY_PORT = Number(process.env.OVERLAY_PORT || 3210);
const OVERLAY_DIR = path.join(__dirname, 'overlay');
const overlayServer = http.createServer((req, res) => {
  const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const routes = {
    '/': ['index.html', 'text/html; charset=utf-8'],
    '/index.html': ['index.html', 'text/html; charset=utf-8'],
    '/style.css': ['style.css', 'text/css; charset=utf-8'],
    '/overlay.js': ['overlay.js', 'text/javascript; charset=utf-8'],
    '/assets/walk_sway.webm': ['assets/walk_sway.webm', 'video/webm'],
    '/assets/waving_gesture.webm': ['assets/waving_gesture.webm', 'video/webm'],
    '/assets/shoot_gun.webm': ['assets/shoot_gun.webm', 'video/webm'],
  };
  const route = routes[requestPath];
  if (!route) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  const filePath = path.join(OVERLAY_DIR, route[0]);
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Arquivo do personagem não encontrado. Extraia os arquivos da pasta overlay/assets.');
      return;
    }
    res.writeHead(200, {
      'Content-Type': route[1],
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  });
});
const overlayWss = new WebSocketServer({ server: overlayServer });
overlayWss.on('connection', (socket) => {
  overlayClients.add(socket);
  socket.on('close', () => overlayClients.delete(socket));
  socket.send(JSON.stringify({ type: 'connected' }));
});
function notifyOverlay(animation = 'idle', detail = {}) {
  const message = JSON.stringify({ type: 'animation', animation, ...detail });
  for (const socket of overlayClients) {
    if (socket.readyState === 1) socket.send(message);
  }
}
overlayServer.on('error', (error) => {
  console.error('Não foi possível iniciar o overlay visual:', error.message);
});
overlayServer.listen(OVERLAY_PORT, '127.0.0.1', () => {
  console.log(`Overlay do personagem disponível em http://127.0.0.1:${OVERLAY_PORT}`);
});
const queue = [];
const overlayClients = new Set();
const recentComments = new Map();
let workerRunning = false;
let lastAcceptedAt = 0;
let activeAbortController = null;
let activeVlc = null;
let isShuttingDown = false;

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, MAX_REPLY_CHARS);
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const error = new Error('Interrompido para priorizar um presente.');
    error.name = 'AbortError';
    throw error;
  }
}

async function generateReply(prompt, signal) {
  throwIfAborted(signal);
  const response = await axios.post(
    OLLAMA_API_URL,
    {
      model: OLLAMA_MODEL,
      messages: [
        { role: 'system', content: OLLAMA_SYSTEM_INSTRUCTION },
        { role: 'user', content: prompt },
      ],
      stream: false,
    },
    {
      headers: {
        Authorization: `Bearer ${OLLAMA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 90000,
      signal,
    },
  );
  throwIfAborted(signal);
  const reply = cleanText(response?.data?.message?.content);
  if (!reply) throw new Error('O Ollama retornou uma resposta vazia.');
  return reply;
}

async function synthesizeSpeech(text, filePath, signal) {
  throwIfAborted(signal);
  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(ELEVENLABS_VOICE_ID)}`,
    {
      text,
      model_id: ELEVENLABS_MODEL,
      voice_settings: {
        stability: Number(process.env.VOICE_STABILITY || 0.4),
        similarity_boost: Number(process.env.VOICE_SIMILARITY_BOOST || 0.8),
        style: Number(process.env.VOICE_STYLE || 0.45),
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
      signal,
    },
  );
  await pipeline(response.data, fs.createWriteStream(filePath), { signal });
}

function playAudio(filePath, signal) {
  return new Promise((resolve, reject) => {
    if (!VLC_PATH || !fs.existsSync(VLC_PATH)) {
      reject(new Error('VLC não encontrado. Instale o VLC ou configure VLC_PATH no arquivo .env.'));
      return;
    }
    throwIfAborted(signal);

    const vlc = spawn(VLC_PATH, ['--intf', 'dummy', '--play-and-exit', filePath], {
      windowsHide: true,
      stdio: 'ignore',
    });
    activeVlc = vlc;
    const onAbort = () => {
      if (!vlc.killed) vlc.kill();
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    vlc.once('error', (error) => {
      signal?.removeEventListener('abort', onAbort);
      if (activeVlc === vlc) activeVlc = null;
      reject(error);
    });
    vlc.once('close', (code) => {
      signal?.removeEventListener('abort', onAbort);
      if (activeVlc === vlc) activeVlc = null;
      if (signal?.aborted) {
        const error = new Error('Áudio interrompido para priorizar um presente.');
        error.name = 'AbortError';
        reject(error);
      } else if (code === 0) {
        resolve();
      } else {
        reject(new Error(`VLC encerrou com código ${code}.`));
      }
    });
  });
}

function getUsername(data) {
  return data?.user?.displayId || data?.user?.uniqueId || data?.uniqueId || data?.nickname || 'pessoa';
}

async function processItem(item) {
  const controller = new AbortController();
  activeAbortController = controller;
  const { signal } = controller;
  const filePath = path.join(TEMP_DIR, `fala-${Date.now()}-${Math.random().toString(16).slice(2)}.mp3`);

  try {
    // Presentes usam frases prontas: pulamos o Gemini para reduzir a latência.
    const reply = item.type === 'gift'
      ? buildGiftReply(item)
      : await generateReply(item.prompt, signal);
    throwIfAborted(signal);
    console.log(`Resposta gerada [${item.type === 'gift' ? 'PRESENTE' : 'chat'}]: ${reply}`);
    notifyOverlay(item.type === 'gift' ? 'wave' : 'react', { username: item.username || '' });

    await synthesizeSpeech(reply, filePath, signal);
    throwIfAborted(signal);
    const audioInfo = await fs.promises.stat(filePath);
    if (audioInfo.size < 1000) throw new Error(`Arquivo de áudio inválido ou incompleto (${audioInfo.size} bytes).`);
    console.log(`Áudio salvo: ${filePath} (${audioInfo.size} bytes). Reproduzindo com VLC...`);
    await playAudio(filePath, signal);
  } catch (error) {
    if (error?.name === 'AbortError' || signal.aborted) {
      console.log('Resposta comum interrompida para atender um presente prioritário.');
    } else {
      const status = error?.response?.status;
      const detail = error?.response?.data;
      console.error('Falha ao processar evento:', status ? `HTTP ${status}` : error.message);
      if (detail && !detail.pipe) console.error('Detalhes da API:', detail.message || detail);
    }
  } finally {
    if (activeAbortController === controller) activeAbortController = null;
    // Os MP3s ficam em tiktok-live-bot/audios para reprodução manual e diagnóstico.
  }
}

async function runQueue() {
  if (workerRunning) return;
  workerRunning = true;
  try {
    while (queue.length && !isShuttingDown) {
      const item = queue.shift();
      await processItem(item);
    }
  } finally {
    workerRunning = false;
    if (queue.length && !isShuttingDown) void runQueue();
  }
}

function enqueueComment(data) {
  const comment = cleanText(data?.content ?? data?.comment);
  if (!comment) return;

  const username = getUsername(data);
  const now = Date.now();
  const dedupeKey = `${username.toLowerCase()}:${comment.toLowerCase()}`;
  const previous = recentComments.get(dedupeKey);
  if (previous && now - previous < DEDUPE_WINDOW_MS) {
    console.log(`Comentário repetido ignorado de @${username}.`);
    return;
  }
  recentComments.set(dedupeKey, now);
  for (const [key, timestamp] of recentComments) {
    if (now - timestamp > DEDUPE_WINDOW_MS) recentComments.delete(key);
  }

  if (now - lastAcceptedAt < MIN_CHAT_INTERVAL_MS) return;
  const pendingChats = queue.filter((item) => item.type === 'chat').length;
  if (pendingChats >= MAX_QUEUE_SIZE) {
    console.warn('Fila de comentários cheia; comentário ignorado para evitar atraso na live.');
    return;
  }

  lastAcceptedAt = now;
  console.log(`Comentário de @${username}: ${comment}`);
  queue.push({
    type: 'chat',
    username,
    prompt: `Comentário de @${username}: "${comment}". Responda diretamente a essa pessoa com uma fala curta, divertida e natural para uma live.`,
  });
  void runQueue();
}

function buildGiftReply(item) {
  const { username, giftName, count } = item;
  const amount = count > 1 ? `${count} ${giftName}` : giftName;
  const replies = [
    `Aí sim, @${username}! Muito obrigado pelo presente ${amount}! Você chegou chegando na live!`,
    `Opa, @${username}, mandou presente! Valeu demais pelo ${amount}! Você é fera!`,
    `Salve, @${username}! Obrigado pelo ${amount}! Essa energia merece até dancinha!`,
    `Êêê, @${username}! Valeu pelo presente ${amount}! Você deixou a live mais animada!`,
    `Muito obrigado, @${username}, pelo ${amount}! Um salve especial pra você!`,
  ];
  const index = item.replyIndex % replies.length;
  return cleanText(replies[index]);
}

let giftReplyIndex = 0;

function enqueueGift(data) {
  const giftType = Number(data?.giftType ?? data?.gift_type ?? 0);
  const repeatEnd = data?.repeatEnd ?? data?.repeat_end;
  // Presentes em sequência são tratados quando a sequência termina, evitando vários agradecimentos.
  if (giftType === 1 && repeatEnd === false) return;

  const username = getUsername(data);
  const giftName = data?.giftName || data?.giftDetails?.giftName || data?.gift_name || 'presente';
  const count = Math.max(1, Number(data?.repeatCount ?? data?.repeat_count ?? 1));
  const diamonds = Number(data?.diamondCount ?? data?.diamond_count ?? 0);
  const prompt = [
    `@ ${username} acabou de enviar ${count > 1 ? count + 'x ' : ''}"${giftName}"${diamonds > 0 ? ` (valor informado: ${diamonds} diamantes)` : ''} durante a live.`,
    'Agradeça imediatamente pelo nome da pessoa e pelo presente, com energia de streamer, uma brincadeira curta e uma frase natural em português brasileiro.',
    'Não invente o valor do presente nem prometa recompensas.',
  ].join(' ');

  console.log(`🎁 Presente de @${username}: ${giftName}${count > 1 ? ` x${count}` : ''}. Prioridade máxima!`);
  notifyOverlay('wave', { username, giftName });
  queue.unshift({
    type: 'gift',
    username,
    giftName,
    count,
    replyIndex: giftReplyIndex++,
    prompt,
  });

  // Se uma resposta comum estiver falando ou sintetizando o áudio, interrompe-a para priorizar o presente.
  if (activeAbortController) activeAbortController.abort();
  if (activeVlc && !activeVlc.killed) activeVlc.kill();
  void runQueue();
}

tiktokLive.on('chat', enqueueComment);
tiktokLive.on('gift', enqueueGift);

tiktokLive.on('connected', (state) => {
  console.log('Conectado à live com sucesso!', state?.roomId ? `Sala: ${state.roomId}` : '');
});
tiktokLive.on('disconnected', () => console.warn('A conexão com o TikTok LIVE foi encerrada.'));
tiktokLive.on('error', (error) => console.error('Erro do TikTok LIVE:', error?.message || error));

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\nRecebido ${signal}; encerrando o bot...`);
  activeAbortController?.abort();
  if (activeVlc && !activeVlc.killed) activeVlc.kill();
  queue.length = 0;
  process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

tiktokLive.connect()
  .then(() => console.log(`Bot iniciado para @${TIKTOK_USERNAME}. Presentes têm prioridade máxima. Pressione Ctrl+C para encerrar.`))
  .catch((error) => {
    console.error('Falha ao conectar ao TikTok LIVE:', error?.message || error);
    process.exitCode = 1;
  });
