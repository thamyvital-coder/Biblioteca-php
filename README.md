# Brasília Fighter — Starter

Jogo de luta vertical para capturar no TikTok LIVE Studio ou OBS. Esta versão inclui um modo de teste local; não inicia transmissões e não conecta automaticamente ao chat do TikTok.

## Regras
- Rosa vermelha (`rose_red`) causa 10 de dano em Flávio Bolsonaro.
- Rosa branca (`rose_white`) causa 10 de dano em Lula.
- Cada personagem começa com 100 HP.
- A rodada reinicia 5 segundos após um nocaute.
- Limite de frequência de 1,5 segundo por usuário.
- Interface vertical, animações, partículas e efeitos sonoros sintetizados pela Web Audio API.

## Requisitos
Node.js 20+ e npm.

## Rodar no navegador
```bash
npm install
npm run start:web
```
Abra o endereço mostrado no terminal. O servidor escuta apenas em `127.0.0.1`.

## Rodar como aplicativo Electron
```bash
npm install
npm start
```

## Endpoint de eventos
POST `http://127.0.0.1:3002/api/event` com JSON:
```json
{ "gift": "rose_red", "userId": "usuario-teste" }
```
Para rosa branca, use `rose_white`. Os aliases aceitos estão em `server.cjs`. Eventos repetidos do mesmo usuário dentro do cooldown retornam HTTP 429.

## Integração com live
O endpoint é uma interface para um adaptador de eventos autorizado. Este projeto não lê o TikTok LIVE automaticamente, não faz scraping e não coleta credenciais. Configure uma fonte de eventos permitida e teste localmente antes de uma transmissão. Inicie a live manualmente no software de transmissão.

## Notas
Os personagens são ilustrações CSS estilizadas, não fotografias. Esta é uma base inicial; a integração real de eventos e o empacotamento precisam ser testados no computador de destino.
