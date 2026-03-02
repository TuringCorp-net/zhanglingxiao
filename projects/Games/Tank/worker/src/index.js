export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname
    if (path === '/games/tank' || path.startsWith('/games/tank/')) {
      const assetPath = path === '/games/tank' ? '/games/tank/index.html' : path
      const r = new Request(new URL(assetPath, url.origin), request)
      return env.ASSETS.fetch(r)
    }
    return new Response('Not Found', { status: 404 })
  }
}
