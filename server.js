const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// ⚠️ NADA DE SEGREDO PELA REDE (rodada 44). O static servia a raiz inteira em
// 0.0.0.0: qualquer aparelho no mesmo Wi-Fi baixava a credencial admin de
// `_dados-de-teste/firebase-admin.json` e os arquivos de teste. O bloqueio
// vem ANTES do static, e o servidor só escuta a própria máquina.
app.use((req, res, next) => {
  if (/^\/(_dados-de-teste|\.env)/i.test(req.path)) return res.status(404).end();
  next();
});

// Serve static files from root directory
app.use(express.static(path.join(__dirname, '.')));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});
