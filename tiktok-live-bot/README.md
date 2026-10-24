# TikTok LIVE Voice Bot

Bot local que lê comentários do TikTok LIVE, gera respostas curtas com Gemini e fala usando uma voz configurada no ElevenLabs.

## Requisitos

- Node.js LTS
- Uma chave de API do Google Gemini
- Uma chave de API do ElevenLabs e o ID da voz
- A live do TikTok precisa estar acessível pela conta/connector
- Um reprodutor de áudio compatível instalado no sistema. No Windows, o `play-sound` normalmente usa um player externo; instale e teste VLC ou outro player compatível se o áudio não tocar.

## Instalação (Windows)

Abra o terminal nesta pasta e execute:

```powershell
npm install
Copy-Item .env.example .env
```

Edite o arquivo `.env` com suas próprias chaves e o nome de usuário do TikTok. Não compartilhe nem envie esse arquivo ao GitHub.

Depois execute:

```powershell
npm run check
npm start
```

## Como funciona

1. Recebe o evento `chat` do TikTok LIVE.
2. Gera uma resposta curta usando o modelo Gemini configurado.
3. Solicita áudio ao endpoint Text-to-Speech do ElevenLabs.
4. Salva o áudio temporariamente, espera a gravação terminar e toca o arquivo.
5. Processa uma fala por vez para impedir sobreposição de áudio e remove os arquivos temporários.

## Configuração de voz

Ajuste `ELEVENLABS_VOICE_ID` para o ID da voz que você configurou e possui autorização para usar. Os parâmetros de estabilidade, similaridade e estilo podem ser ajustados no `.env`. Os parâmetros aceitos podem variar conforme a voz/modelo habilitado na conta.

## Observações importantes

- O bot não publica comentários nem controla o TikTok LIVE Studio; ele apenas lê comentários recebidos e reproduz a fala no computador.
- O áudio reproduzido precisa ser capturado pelo TikTok LIVE Studio (por exemplo, via áudio do desktop ou dispositivo de áudio virtual).
- Limite de fila e intervalo entre comentários ajudam a controlar atraso e consumo de API.
- O acesso ao TikTok LIVE e a disponibilidade dos modelos/serviços dependem das contas e APIs utilizadas.
- Nunca coloque chaves reais em arquivos versionados. Se uma chave real já foi publicada, revogue-a e gere outra.
- Antes de usar em uma live pública, teste com poucos comentários e confirme que o áudio está sendo capturado.
