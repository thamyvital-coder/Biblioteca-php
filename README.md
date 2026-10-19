# Brasília Fighter — Arcade Edition

Jogo de luta em estilo arcade retrô, com arena inspirada em Brasília, HUD de fliperama, barras de energia, cronômetro visual, animações de impacto e modo de teste para capturar no TikTok LIVE Studio ou OBS.

## Rodar no Windows

Requisitos: Node.js 20+.

```bash
npm install
npm run start:web
```

Abra o endereço mostrado no terminal (normalmente http://127.0.0.1:3002).

Para abrir a versão desktop Electron:

```bash
npm install
npm start
```

## Controles de teste

- **Rosa vermelha**: golpe em Flávio Bolsonaro (10 de dano).
- **Rosa branca**: golpe em Lula (10 de dano).
- **Reset**: reinicia a luta.
- Cada personagem começa com 300 HP.
- Ao chegar a 0 HP, ocorre K.O.; a próxima rodada inicia após 6 segundos.
- Cooldown de 1,5 segundo por usuário para eventos recebidos em `/api/event`.
- Efeitos sonoros são sintetizados localmente via Web Audio API.

## Eventos HTTP

O endpoint `POST /api/event` aceita JSON como:

```json
{ "gift": "rose_red", "userId": "usuario-teste" }
```

ou

```json
{ "gift": "rose_white", "userId": "usuario-teste" }
```

O endpoint é uma interface para um adaptador autorizado. Este projeto **não se conecta automaticamente ao TikTok**, não lê o chat por scraping, não coleta credenciais e não inicia transmissões. Teste localmente antes de ligar qualquer fonte de eventos autorizada. O servidor se vincula a `127.0.0.1`.

## Captura de live

Abra a página ou o aplicativo e capture a janela no TikTok LIVE Studio/OBS. A transmissão deve ser iniciada manualmente no software de transmissão.

## Direção visual

A interface usa arte CSS original e cenários geométricos inspirados em jogos de luta arcade dos anos 90. Não inclui sprites, logotipos, música ou outros assets oficiais de Street Fighter.
