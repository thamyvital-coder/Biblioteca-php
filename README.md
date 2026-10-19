# Brasília Fighter — TikTok LIVE Edition

Versão vertical 9:16 para captura em lives do TikTok, com visual arcade pixel-art de Brasília. O painel lateral de regras foi removido para deixar a tela mais limpa.

## Requisitos
- Windows 10/11
- Node.js LTS (inclui npm)

## Testar no navegador
1. Baixe ou clone este repositório.
2. Abra a pasta do projeto no Explorador de Arquivos.
3. Digite `cmd` na barra de endereço e pressione Enter.
4. Execute:
   ```bash
   npm install
   npm run start:web
   ```
5. Abra `http://127.0.0.1:3002`.

## Controles
- Botão transparente da rosa vermelha: reduz 10 HP do Flávio.
- Botão transparente da rosa branca: reduz 10 HP do Lula.
- Botão transparente de reset: reinicia a rodada.
- A API de teste aceita `POST /api/test/hit` com `{"target":"flavio"}` ou `{"target":"lula"}`.
- A API `/api/event` aceita `rose_red` e `rose_white`, com `userId` para limitar repetição a 1 evento por usuário a cada 1,5 s.

## TikTok LIVE
Esta versão não lê o chat nem recebe presentes reais automaticamente. A rota `/api/event` é apenas um ponto de integração local; conecte-a somente a uma fonte de eventos autorizada. Use captura de janela/tela no TikTok LIVE Studio, configurada para formato vertical 9:16. Teste o enquadramento antes de entrar ao vivo.

## Arte de fundo
Coloque o arquivo `arena-reference.png` dentro de `public/` para usar a arte vertical de referência. O ZIP entregue nesta conversa inclui essa imagem.

## Estado de testes
Os arquivos JavaScript foram validados com `node --check`. A instalação de dependências e o teste ponta a ponta precisam ser feitos no computador de destino.
