import { Hono } from 'hono'
import type { Context } from 'hono'
import { marked } from 'marked'
import albums from '../content/albums.json'
import events from '../content/events.json'
import boardMembers from '../content/board_members.json'
import sponsors from '../content/sponsors.json'
import homeContent from '../content/home.md'
import ui from '../content/ui.json'
import { type Bindings, layout, esc } from './utils'

type Album = {
  slug: string
  name: string
  description?: string
  prefix: string
  cover?: string
}

type Message = {
  id: string
  author?: string
  content: string
  created_at: string
  parent_id?: string
  replies?: Message[]
}

const app = new Hono<{ Bindings: Bindings }>()

// 首页
app.get('/', (c) => {
  const htmlContent = marked.parse(homeContent)
  const eventList = (events as { title: string; link: string }[])
    .map(
      (e) => `
      <li style="margin-bottom: 10px;">
        <a href="${esc(e.link)}" target="_blank" style="font-size: 1.1rem; color: var(--text); text-decoration: none;">
          👉 ${esc(e.title)}
        </a>
      </li>`
    )
    .join('')

  const body = `
    <div style="text-align: center; padding: 40px 0;">
      <div style="font-size: 1.2rem; max-width: 600px; margin: 0 auto 30px; text-align: left;">
        ${htmlContent}
      </div>
      
      <div style="max-width: 600px; margin: 0 auto 40px; text-align: left; background: var(--white); padding: 20px; border-radius: 16px; box-shadow: var(--card-shadow);">
        <h3 style="margin-top: 0;">${ui.events_title}</h3>
        <ul style="list-style: none; padding: 0;">
          ${eventList}
        </ul>
      </div>

      <div>
        <a class="btn" href="/albums" style="font-size: 1.2rem; padding: 15px 30px; margin: 10px;">${ui.btn_view_albums}</a>
        <a class="btn" href="/board" style="background: var(--secondary); font-size: 1.2rem; padding: 15px 30px; margin: 10px;">${ui.btn_view_board}</a>
      </div>
    </div>
  `
  return c.html(layout(ui.site_title + ' · ' + ui.nav_home, body))
})

// R2 对象读取（图片、PDF）
app.get('/assets/:path{.+}', async (c) => {
  const rawKey = c.req.param('path')
  console.log('Raw key:', rawKey)
  if (!rawKey) return c.notFound()
  const key = decodeURIComponent(rawKey)
  console.log('Decoded key:', key)

  // Allow access to photos and reports
  // key might be "photos/album1/pic.jpg" or "reports/issue-1.pdf"
  // The previous logic was direct access. Now we should ensure it matches expected prefixes if we want to be strict,
  // but for simplicity, we just serve what's requested if it exists.
  // However, the requirement says "assets/photos" and "assets/reports".
  // The URL is /assets/..., so the key is the part after /assets/.
  // If the file is stored as "photos/..." in R2, then key "photos/..." works.

  const obj = await c.env.ASSETS_BUCKET.get(key)
  if (!obj) return c.notFound()
  const ct = key.endsWith('.png')
    ? 'image/png'
    : key.endsWith('.jpg') || key.endsWith('.jpeg')
      ? 'image/jpeg'
      : key.endsWith('.gif')
        ? 'image/gif'
        : key.endsWith('.pdf')
          ? 'application/pdf'
          : 'application/octet-stream'
  return new Response(obj.body, { headers: { 'Content-Type': ct, 'Cache-Control': 'public, max-age=3600' } })
})

// 相册列表
app.get('/albums', async (c) => {
  const list: Album[] = (albums as Album[]) || []
  const cards = list
    .map((a) => {
      const coverSrc = a.cover ? `/assets/photos/${a.cover}` : 'https://picsum.photos/600/400?blur'
      return `<div class="card">
        <img src="${coverSrc}" alt="${esc(a.name)}" />
        <div class="body">
          <h3>${esc(a.name)}</h3>
          <p>${esc(a.description || '')}</p>
          <a class="btn" href="/albums/${esc(a.slug)}">${ui.btn_open_album}</a>
        </div>
      </div>`
    })
    .join('')
  const body = `<h2>${ui.album_list_title}</h2><div class="grid">${cards}</div>`
  return c.html(layout(ui.site_title + ' · ' + ui.nav_albums, body))
})

// 相册详情
app.get('/albums/:slug', async (c) => {
  const slug = c.req.param('slug')
  const list: Album[] = (albums as Album[]) || []
  const album = list.find((a) => a.slug === slug)
  if (!album) return c.notFound()
  let items: string[] = []
  try {
    // Update prefix to include "photos/"
    const prefix = `photos/${album.prefix}`
    const r = await c.env.ASSETS_BUCKET.list({ prefix: prefix, limit: 100 })
    items = (r.objects || [])
      .map((o: any) => o.key)
      .filter((k: string) => !k.endsWith('/'))
      .filter((k: string) => !album.cover || k !== `photos/${album.cover}`)
      .filter((k: string) => /(\.png|\.jpg|\.jpeg|\.gif)$/i.test(k))
  } catch (e) {
    items = []
  }
  const imgs = items
    .map((k) => `<div class="card"><img src="/assets/${k}" alt="${esc(album.name)}"/></div>`)
    .join('')
  const body = `
    <div style="margin-bottom: 20px;">
      <a href="/albums" style="color: var(--secondary); text-decoration: none;">${ui.btn_back_albums}</a>
    </div>
    <h2>${esc(album.name)}</h2>
    <p>${esc(album.description || '')}</p>
    <div class="grid">${imgs || `<p>${ui.album_no_images}</p>`}</div>
  `
  return c.html(layout(`${ui.nav_albums} · ${album.name}`, body))
})

// 校董发布
app.get('/posts', async (c) => {
  let posts: { key: string; title: string }[] = []
  try {
    // Update prefix to "reports/"
    const r = await c.env.ASSETS_BUCKET.list({ prefix: 'reports/', limit: 100 })
    posts = (r.objects || [])
      .map((o: any) => o.key)
      .filter((k: string) => k.endsWith('.pdf'))
      .map((k: string) => {
        const m = k.match(/issue-(\d+)/)
        const issue = m ? Number(m[1]) : undefined
        const title = issue ? `第 ${issue} 期` : k.replace('reports/', '')
        return { key: k, title }
      })
  } catch (e) {
    posts = []
  }
  const listHtml = posts
    .map((p) => `
      <li style="margin-bottom: 10px;">
        <a href="/assets/${p.key}" target="_blank" style="font-size: 1.1rem; color: var(--text); text-decoration: none; display: flex; align-items: center;">
          📄 ${esc(p.title)} <span style="font-size: 0.8rem; color: var(--secondary); margin-left: 10px;">${ui.posts_read}</span>
        </a>
      </li>`)
    .join('')
  const body = `<h2>${ui.posts_title}</h2><ul style="list-style: none; padding: 0;">${listHtml || `<li>${ui.posts_no_content}</li>`}</ul>`
  return c.html(layout(ui.site_title + ' · ' + ui.nav_posts, body))
})

// 留言板
app.get('/board', async (c) => {
  let ids: string[] = []
  try {
    ids = (await c.env.BOARD_KV.get('messages:index', 'json')) || []
  } catch (e) {
    ids = []
  }
  // Get all messages to build the tree (limit to last 100 for performance, but ideally we want all for threading)
  // For simplicity, let's fetch the last 100 IDs and filter.
  // If we want true threading, we might need a better data structure or fetch more.
  // Let's fetch last 50 top-level messages + their replies?
  // Current simple approach: fetch last 50 IDs, then fetch their content.

  // Actually, let's just fetch the last 50 IDs. If a reply is not in the last 50, it won't show?
  // Better: Store replies in the parent message object? No, concurrency issues.
  // Better: Store `replies:PARENT_ID` list in KV?
  // Let's stick to the flat list for now but filter for display.

  ids = Array.isArray(ids) ? ids.slice(-100).reverse() : []
  const rawMessages = await Promise.all(
    ids.map(async (id) => {
      const m = await c.env.BOARD_KV.get(`messages:${id}`, 'json')
      return m as Message
    })
  )

  const messages = rawMessages.filter((m) => m !== null)
  const topLevel = messages.filter((m) => !m.parent_id)
  const replyMap = new Map<string, Message[]>()

  messages.forEach((m) => {
    if (m.parent_id) {
      const list = replyMap.get(m.parent_id) || []
      list.push(m)
      replyMap.set(m.parent_id, list)
    }
  })

  // Sort replies by date asc
  replyMap.forEach((list) => list.sort((a, b) => a.created_at.localeCompare(b.created_at)))

  const renderMsg = (m: Message) => {
    const replies = replyMap.get(m.id) || []
    const replyHtml = replies.map(r => `
      <div class="reply">
        <div class="msg-header">
          <strong>${esc(r.author || '匿名')}</strong>
          <small>${esc(r.created_at)}</small>
        </div>
        <div class="msg-content">${esc(r.content)}</div>
      </div>
    `).join('')

    return `
      <div class="msg">
        <div class="msg-header">
          <strong>${esc(m.author || '匿名')}</strong>
          <small>${esc(m.created_at)}</small>
        </div>
        <div class="msg-content">${esc(m.content)}</div>
        <div class="msg-actions">
          <button class="btn btn-small" style="background: var(--secondary);" onclick="toggleReply('${m.id}')">${ui.btn_reply}</button>
        </div>
        ${replies.length > 0 ? `<div class="replies">${replyHtml}</div>` : ''}
        
        <form id="reply-${m.id}" class="reply-form hidden" method="post" action="/board">
          <input type="hidden" name="parent_id" value="${m.id}" />
          <input type="text" name="author" placeholder="${ui.msg_reply_author}" maxlength="20" style="margin-bottom: 5px;" />
          <textarea name="content" placeholder="${ui.msg_reply_content}" maxlength="300" required rows="2"></textarea>
          <button class="btn btn-small" type="submit">${ui.btn_send_reply}</button>
        </form>
      </div>
    `
  }

  const msgs = topLevel.map(renderMsg).join('')

  const form = `
    <h3>${ui.msg_publish_title}</h3>
    <form method="post" action="/board">
      <input type="text" name="author" placeholder="${ui.msg_input_author}" maxlength="20" />
      <textarea name="content" placeholder="${ui.msg_input_content}" maxlength="300" required rows="4"></textarea>
      <button class="btn" type="submit">${ui.btn_submit_msg}</button>
    </form>
  `
  const body = `<h2>${ui.msg_board_title}</h2>${form}<h3>${ui.msg_latest_title}</h3><div class="msg-list">${msgs || `<p>${ui.msg_no_content}</p>`}</div>`
  return c.html(layout(ui.site_title + ' · ' + ui.nav_board, body))
})

app.post('/board', async (c) => {
  const fd = await c.req.formData()
  const author = (fd.get('author') || '').toString().trim().slice(0, 20)
  const content = (fd.get('content') || '').toString().trim().slice(0, 300)
  const parent_id = (fd.get('parent_id') || '').toString().trim()

  if (!content) return c.text('内容不能为空', 400)

  const id = crypto.randomUUID()
  const created_at = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const msg: Message = { id, author, content, created_at }
  if (parent_id) {
    msg.parent_id = parent_id
  }

  // 索引列表
  const idx: string[] = (await c.env.BOARD_KV.get('messages:index', 'json')) || []
  idx.push(id)

  await Promise.all([
    c.env.BOARD_KV.put(`messages:${id}`, JSON.stringify(msg)),
    c.env.BOARD_KV.put('messages:index', JSON.stringify(idx))
  ])

  return c.redirect('/board')
})

// 校董风采
app.get('/board-members', (c) => {
  const members = (boardMembers as { id: string; name: string; intro: string }[])
    .map(
      (m) => `
    <div class="card" style="margin-bottom: 20px;">
      <div class="body">
        <h3>${esc(m.name)}</h3>
        <p>${esc(m.intro)}</p>
      </div>
    </div>`
    )
    .join('')
  const body = `<h2>${ui.board_members_title}</h2><div class="grid">${members}</div>`
  return c.html(layout(ui.site_title + ' · ' + ui.nav_board_members, body))
})

// 感谢墙
app.get('/sponsors', (c) => {
  const list = (sponsors as { id: string; name: string; intro: string; donation: string; message: string }[])
    .map(
      (s) => `
    <div class="card" style="margin-bottom: 20px;">
      <div class="body">
        <h3>${esc(s.name)}</h3>
        <p>${esc(s.intro)}</p>
        <p><strong>${ui.sponsor_donation}</strong> ${esc(s.donation)}</p>
        <p><strong>${ui.sponsor_message}</strong> ${esc(s.message)}</p>
      </div>
    </div>`
    )
    .join('')
  const body = `<h2>${ui.sponsors_title}</h2><div class="grid">${list}</div>`
  return c.html(layout(ui.site_title + ' · ' + ui.nav_sponsors, body))
})

export default app
