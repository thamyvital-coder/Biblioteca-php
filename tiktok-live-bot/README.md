# TikTok LIVE Voice Bot

Bot que lê comentários do TikTok LIVE, gera respostas curtas usando a API do Ollama Cloud e fala com uma voz configurada no ElevenLabs. Os presentes usam frases prontas para responder mais rapidamente e têm prioridade na fila.

## Requisitos

- Node.js LTS
- Uma chave de API do Ollama Cloud
- Uma chave de API do ElevenLabs e o ID da voz
- A live do TikTok precisa estar acessível pela conta/connector
- VLC instalado no Windows para reprodução do áudio

## Instalação (Windows)

Abra o terminal nesta pasta e execute:

```powershell
npm install
Copy-Item .env.example .env
```

Edite o arquivo `.env` e preencha `OLLAMA_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` e `TIKTOK_USERNAME`. A chave do Ollama é usada na API em nuvem em `https://ollama.com/api/chat`. Não compartilhe nem envie o arquivo `.env` ao GitHub.

O modelo padrão está definido por `OLLAMA_MODEL=gemma4:31b`. Caso esse modelo não esteja habilitado para sua conta, configure no `.env` outro nome de modelo disponível para sua chave no Ollama Cloud. O endpoint também pode ser ajustado com `OLLAMA_API_URL`.

Depois execute:

```powershell
npm run check
npm start
```

## Como funciona

1. Recebe comentários e presentes da live do TikTok.
2. Gera respostas aos comentários com a API de chat do Ollama Cloud.
3. Usa frases prontas para agradecer presentes sem chamar o modelo de IA.
4. Solicita o áudio ao endpoint Text-to-Speech do ElevenLabs.
5. Salva os arquivos MP3 na pasta `audios` e reproduz a fala com o VLC.
6. Interrompe uma resposta comum quando chega um presente, para dar prioridade ao presente.

## Configuração de voz

Ajuste `ELEVENLABS_VOICE_ID` para o ID da voz que você configurou e possui autorização para usar. Os parâmetros de estabilidade, similaridade e estilo podem ser ajustados no `.env`.

## Observações importantes

- A chave `OLLAMA_API_KEY` deve permanecer privada. Nunca coloque chaves reais em arquivos versionados. Se uma chave real já foi publicada, revogue-a e gere outra.
- Ollama Cloud não é ilimitado por padrão: a disponibilidade dos modelos e os créditos/limites dependem do plano e do uso da conta.
- A API local do Ollama (`localhost:11434`) é diferente da API em nuvem usada neste projeto.
- O bot não publica comentários nem controla o TikTok LIVE Studio; ele lê comentários recebidos e reproduz áudio no computador.
- O áudio precisa ser capturado pelo TikTok LIVE Studio (por exemplo, pelo áudio do desktop ou por um dispositivo de áudio virtual).
- Teste com poucos comentários antes de usar em uma live pública e confirme que o áudio está sendo capturado.
