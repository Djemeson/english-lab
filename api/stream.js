// ================================================================
// PROXY DE STREAM — ponte HTTPS para fontes HTTP (conteúdo misto)
// ================================================================
// Muitos addons de "link direto" (FrostStream e afins) devolvem URLs HTTP
// de caixas de IPTV na porta 80. O app roda em HTTPS, e o navegador BLOQUEIA
// mídia HTTP dentro de página HTTPS (mixed content) — em silêncio, o que
// aparecia como "nada acontece". Este proxy é a única saída client-safe: o
// SERVIDOR (aqui, sem a trava do navegador) busca a fonte e a devolve por
// HTTPS, na MESMA origem do app. Bônus: mesma origem = captureStream volta a
// funcionar (gravar a fala em card).
//
// Range é repassado (o <video> pede o vídeo em pedaços; cada pedido é uma
// invocação curta, o que mantém a função dentro dos limites da Vercel).
//
// ⚠️ Guardas contra virar proxy aberto (SSRF/relay): (1) só responde a
// pedidos vindos do próprio app (Referer), (2) só repassa conteúdo de
// mídia (Content-Type de vídeo/áudio/playlist).
export const config = { runtime: 'edge' }

const ORIGENS_OK = [
  'english-lab-seven.vercel.app',
  'djemeson.github.io',
  'localhost',
  '127.0.0.1'
]
const TIPOS_OK = /^(video\/|audio\/|application\/(vnd\.apple\.mpegurl|x-mpegurl|octet-stream|dash\+xml)|binary\/octet-stream)/i

export default async function handler(req) {
  const u = new URL(req.url)
  const alvo = u.searchParams.get('u')

  // CORS/preflight (o próprio app é same-origin, mas não custa)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Range',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS'
    } })
  }

  if (!alvo || !/^https?:\/\//i.test(alvo)) return new Response('URL inválida', { status: 400 })

  // Guarda 1: só o próprio app pode usar o proxy
  const ref = req.headers.get('referer') || req.headers.get('origin') || ''
  const refOk = !ref || ORIGENS_OK.some(h => { try { return new URL(ref).hostname.endsWith(h) } catch (e) { return false } })
  if (ref && !refOk) return new Response('origem não autorizada', { status: 403 })

  // FATIAMENTO: o <video> pede com Range ABERTO ("bytes=0-"), e repassar os
  // 505 MB de uma vez trava a função de borda (o player fica em "stalled").
  // Limitamos cada pedido a uma JANELA (6 MB): a resposta 206 diz o total, e
  // o player vai pedindo as janelas seguintes conforme assiste. É o
  // byte-serving que todo CDN faz — só que aqui somos nós.
  const JANELA = 6 * 1024 * 1024
  const rangeIn = req.headers.get('range') || ''
  const m = /bytes=(\d+)-(\d*)/i.exec(rangeIn)
  const ini = m ? parseInt(m[1], 10) : 0
  const fimPedido = m && m[2] ? parseInt(m[2], 10) : Infinity
  const fim = Math.min(fimPedido, ini + JANELA - 1)
  const rangeOut = 'bytes=' + ini + '-' + (isFinite(fim) ? fim : (ini + JANELA - 1))

  let upstream
  try {
    upstream = await fetch(alvo, {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: {
        Range: rangeOut,
        // alguns servidores de IPTV exigem um UA "de player"
        'User-Agent': req.headers.get('user-agent') || 'VLC/3.0 LibVLC/3.0'
      },
      redirect: 'follow'
    })
  } catch (e) {
    return new Response('falha ao alcançar a fonte: ' + e.message, { status: 502 })
  }

  // Guarda 2: só repassa mídia (não vira proxy web genérico)
  const ct = upstream.headers.get('content-type') || 'application/octet-stream'
  if (!TIPOS_OK.test(ct)) {
    return new Response('a fonte não devolveu mídia (' + ct + ')', { status: 415 })
  }

  const headers = new Headers()
  for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control', 'etag', 'last-modified']) {
    const val = upstream.headers.get(h); if (val) headers.set(h, val)
  }
  if (!headers.has('accept-ranges')) headers.set('accept-ranges', 'bytes')
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')

  return new Response(req.method === 'HEAD' ? null : upstream.body, {
    status: upstream.status,
    headers
  })
}
