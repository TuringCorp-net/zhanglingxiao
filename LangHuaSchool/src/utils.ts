export type Bindings = {
    SITE_TITLE: string
    BOARD_KV: KVNamespace
    ASSETS_BUCKET: R2Bucket
}

export function esc(s: string) {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
}

export function layout(title: string, body: string) {
    return `<!doctype html>
  <html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        --primary: #FF9F1C; /* Orange */
        --secondary: #2EC4B6; /* Teal */
        --accent: #FFBF69; /* Light Orange */
        --bg: #CBF3F0; /* Light Teal */
        --text: #2B2D42; /* Dark Blue */
        --white: #FFFFFF;
        --card-shadow: 0 4px 6px rgba(0,0,0,0.1);
      }
      * { box-sizing: border-box; }
      body {
        font-family: "Comic Sans MS", "Chalkboard SE", system-ui, sans-serif;
        margin: 0;
        background-color: var(--bg);
        color: var(--text);
        line-height: 1.6;
      }
      header {
        background: var(--white);
        padding: 1rem 2rem;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        position: sticky;
        top: 0;
        z-index: 100;
        border-bottom: 4px solid var(--secondary);
      }
      header .container {
        max-width: 960px;
        margin: 0 auto;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      header h1 {
        margin: 0;
        font-size: 1.8rem;
        color: var(--secondary);
      }
      nav a {
        margin-left: 20px;
        color: var(--text);
        text-decoration: none;
        font-weight: bold;
        font-size: 1.1rem;
        transition: color 0.2s;
      }
      nav a:hover {
        color: var(--primary);
      }
      main {
        max-width: 960px;
        margin: 2rem auto;
        padding: 0 20px;
      }
      h2, h3 {
        color: var(--secondary);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 20px;
      }
      .card {
        background: var(--white);
        border-radius: 16px;
        box-shadow: var(--card-shadow);
        overflow: hidden;
        transition: transform 0.2s;
        border: 2px solid transparent;
      }
      .card:hover {
        transform: translateY(-5px);
        border-color: var(--primary);
      }
      .card img {
        width: 100%;
        height: 180px;
        object-fit: cover;
      }
      .card .body {
        padding: 15px;
      }
      .btn {
        display: inline-block;
        padding: 10px 20px;
        background: var(--primary);
        color: var(--white);
        border-radius: 25px;
        text-decoration: none;
        font-weight: bold;
        border: none;
        cursor: pointer;
        transition: background 0.2s;
      }
      .btn:hover {
        background: #F9844A;
      }
      .btn-small {
        padding: 5px 10px;
        font-size: 0.9rem;
      }
      form {
        background: var(--white);
        padding: 20px;
        border-radius: 16px;
        box-shadow: var(--card-shadow);
        margin-bottom: 2rem;
        border: 2px dashed var(--secondary);
      }
      input, textarea {
        width: 100%;
        padding: 10px;
        margin: 10px 0;
        border: 2px solid #E0E0E0;
        border-radius: 10px;
        font-family: inherit;
      }
      input:focus, textarea:focus {
        border-color: var(--secondary);
        outline: none;
      }
      .msg-list {
        display: flex;
        flex-direction: column;
        gap: 15px;
      }
      .msg {
        background: var(--white);
        border-radius: 12px;
        padding: 15px;
        box-shadow: var(--card-shadow);
      }
      .msg-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        color: #666;
        font-size: 0.9rem;
      }
      .msg-content {
        font-size: 1.1rem;
      }
      .msg-actions {
        margin-top: 10px;
        text-align: right;
      }
      .reply-form {
        margin-top: 10px;
        padding: 10px;
        background: #f0f0f0;
        border: none;
      }
      .replies {
        margin-top: 10px;
        padding-left: 20px;
        border-left: 3px solid var(--bg);
      }
      .reply {
        background: #f9f9f9;
        padding: 10px;
        border-radius: 8px;
        margin-top: 8px;
      }
      footer {
        text-align: center;
        padding: 40px 20px;
        color: #666;
        font-size: 0.9rem;
      }
      /* Toggle reply form */
      .hidden { display: none; }
    </style>
    <script>
      function toggleReply(id) {
        const form = document.getElementById('reply-' + id);
        if (form.style.display === 'none' || !form.style.display) {
          form.style.display = 'block';
        } else {
          form.style.display = 'none';
        }
      }
    </script>
  </head>
  <body>
    <header>
      <div class="container">
        <h1>🌊 浪花学校</h1>
        <nav>
          <a href="/">🏠 首页</a>
          <a href="/albums">📷 相册</a>
          <a href="/board">📝 留言板</a>
          <a href="/posts">📢 校董发布</a>
        </nav>
      </div>
    </header>
    <main>
      ${body}
    </main>
    <footer>
      <p>© 2024 浪花学校 | 由小学生设计与维护 🚀</p>
    </footer>
  </body>
  </html>`
}
