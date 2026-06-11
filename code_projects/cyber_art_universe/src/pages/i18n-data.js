// Cyber Art Universe — 全站双语数据（zh / en）
// 部署为静态资源，与 HTML/JS/CSS 同步版本。未来加语种只需扩展此文件。

var I18N = {

  nav: {
    read:  { zh: 'Read',  en: 'Read' },
    write: { zh: 'Write', en: 'Write' },
    login: { zh: '登录',  en: 'Login' },
  },

  category: {
    fantasy:           { zh: '奇幻·玄幻', en: 'Fantasy' },
    'science-fiction': { zh: '科幻',       en: 'Sci-Fi' },
    romance:           { zh: '言情·恋爱', en: 'Romance' },
    contemporary:      { zh: '都市·现实', en: 'Contemporary' },
    adventure:         { zh: '动作·冒险', en: 'Adventure' },
    'mystery-thriller':{ zh: '悬疑·惊悚', en: 'Mystery/Thriller' },
    historical:        { zh: '历史·架空', en: 'Historical' },
    'young-adult':     { zh: '青春·成长', en: 'Young Adult' },
  },

  my_works:  { zh: '我的作品', en: 'My Works' },
  published: { zh: '已发布',   en: 'Published' },
  draft:     { zh: '草稿',     en: 'Draft' },
  closed:    { zh: '已关闭',   en: 'Closed' },

  pipeline: {
    M0: { zh: '原始构想', en: 'Original Concept' },
    M1: { zh: '世界观',   en: 'World Bible' },
    M2: { zh: '主线剧情', en: 'Main Plot' },
    M3: { zh: '人物卡',   en: 'Characters' },
    M4: { zh: '伏笔账本', en: 'Foreshadowing' },
    M5: { zh: '章节蓝图', en: 'Chapter Blueprint' },
    M6: { zh: '逐章编写', en: 'Chapter Writing' },
  },

  binder: {
    original_concept: { zh: '原始构想', en: 'Original Concept' },
    synopsis:         { zh: '总纲',     en: 'Synopsis' },
    worldbuilding:    { zh: '世界观',   en: 'World Bible' },
    characters:       { zh: '人物树',   en: 'Characters' },
    chapters:         { zh: '章节树',   en: 'Chapters' },
    foreshadowing:    { zh: '伏笔账本', en: 'Foreshadowing' },
  },

  binder_icon: {
    original_concept: { zh: '构', en: 'OC' },
    synopsis:         { zh: '纲', en: 'SY' },
    worldbuilding:    { zh: '世', en: 'WB' },
    characters:       { zh: '人', en: 'CH' },
    chapters:         { zh: '章', en: 'CP' },
    foreshadowing:    { zh: '伏', en: 'FH' },
  },

  right_tab: {
    info:    { zh: '信息', en: 'Info' },
    lint:    { zh: '检查', en: 'Lint' },
    suggest: { zh: '建议', en: 'Suggest' },
    chat:    { zh: '对话', en: 'Chat' },
  },
  right_icon: {
    info: { zh: '信', en: 'I' }, lint: { zh: '检', en: 'L' },
    suggest: { zh: '议', en: 'S' }, chat: { zh: '聊', en: 'C' },
  },

  chapter_filter: {
    all:   { zh: '全部',   en: 'All' },
    draft: { zh: '写作中', en: 'Drafting' },
    done:  { zh: '已完成', en: 'Done' },
  },

  writing: {
    preview:      { zh: '预览',   en: 'Preview' },
    edit:         { zh: '编辑',   en: 'Edit' },
    ai_generate:  { zh: 'AI 生成', en: 'AI Generate' },
    polish:       { zh: '润色',   en: 'Polish' },
    save:         { zh: '保存',   en: 'Save' },
    saved:        { zh: '已保存', en: 'Saved' },
    select_title: { zh: '选择左侧章节开始写作', en: 'Select a chapter to begin' },
  },

  entity_type: {
    character:    { zh: '角色', en: 'Character' },
    location:     { zh: '地点', en: 'Location' },
    organization: { zh: '组织', en: 'Organization' },
    concept:      { zh: '概念', en: 'Concept' },
    item:         { zh: '物品', en: 'Item' },
    term:         { zh: '术语', en: 'Term' },
    event:        { zh: '事件', en: 'Event' },
  },

  status: {
    ai_generated:  { zh: 'AI 生成',  en: 'AI Generated' },
    human_written: { zh: '人工撰写', en: 'Human Written' },
    ai_polished:   { zh: '已 AI 润色', en: 'AI Polished' },
    no_issues:     { zh: '未发现问题', en: 'No issues found' },
    unresolved:    { zh: '未解决问题', en: 'Unresolved issues' },
    error:         { zh: '严重',     en: 'Error' },
    warning:       { zh: '警告',     en: 'Warning' },
  },

  label: {
    loading:          { zh: '加载中...',   en: 'Loading...' },
    load_failed:      { zh: '加载失败',    en: 'Load failed' },
    no_characters:    { zh: '暂无角色',    en: 'No characters' },
    no_foreshadowing: { zh: '暂无伏笔条目', en: 'No foreshadowing entries' },
    fh_strategy:      { zh: '伏笔策略总览', en: 'Strategy Overview' },
    no_chapters:      { zh: '暂无章节',    en: 'No chapters' },
    no_summary:       { zh: '暂无简介',    en: 'No summary' },
    no_match:         { zh: '没有匹配的章节', en: 'No matching chapters' },
    select_work:      { zh: '选择作品...', en: 'Select work...' },
    uncategorized:    { zh: '未分类',      en: 'Uncategorized' },
    word_count:       { zh: '字',          en: ' words' },
    suggest_start:    { zh: '建议从这里开始', en: 'Suggested start' },
    preview_holder:   { zh: '预览将在此显示', en: 'Preview will appear here' },
    select_work_start:{ zh: '选择作品后开始', en: 'Select a work to begin' },
    ai_thinking:      { zh: 'Story Elf 思考中...', en: 'Story Elf thinking...' },
    updated_editor:   { zh: '已在写作区更新结果', en: 'Updated in editor' },
    no_works:         { zh: '还没有作品，点击左上角 + 创建你的第一部作品吧', en: 'No works yet. Click + to create your first work.' },
    creating:         { zh: '创建中...',   en: 'Creating...' },
  },

  ws: {
    edit_title:       { zh: '编辑名称',     en: 'Edit Title' },
    edit_title_placeholder: { zh: '输入新名称...', en: 'New name...' },
    publish_work:     { zh: '发布',         en: 'Publish' },
    unpublish_work:   { zh: '取消发布',     en: 'Unpublish' },
    delete_work:      { zh: '删除作品',     en: 'Delete Work' },
    delete_confirm:   { zh: '确定要删除「{title}」吗？此操作不可撤销。', en: 'Delete "{title}"? This cannot be undone.' },
    delete_success:   { zh: '已删除',       en: 'Deleted' },
    delete_failed:    { zh: '删除失败',     en: 'Delete failed' },
    update_failed:    { zh: '更新失败',     en: 'Update failed' },
    collection:       { zh: '作品集',       en: 'Works' },
    new_work:         { zh: '新增作品',     en: 'New Work' },
    name_placeholder: { zh: '输入作品名称...', en: 'Work name...' },
  },

  action: {
    generate_outline: { zh: '生成大纲', en: 'Generate Outline' },
    new_chapter:      { zh: '+ 新章节', en: '+ New Chapter' },
    publish:          { zh: '发布',     en: 'Publish' },
    ai_generate:      { zh: 'AI 生成',  en: 'AI Generate' },
    regenerate:       { zh: '重新生成', en: 'Regenerate' },
    ai_plan:          { zh: 'AI 规划',  en: 'AI Plan' },
    replan:           { zh: '重新规划', en: 'Replan' },
    edit:             { zh: '编辑',     en: 'Edit' },
    send:             { zh: '发送',     en: 'Send' },
    toggle_binder:    { zh: '折叠/展开', en: 'Toggle' },
    confirm:          { zh: '确认',       en: 'Confirm' },
    cancel:           { zh: '取消',       en: 'Cancel' },
  },

  template_notice: {
    outline:       { zh: '以下为长篇框架模板。请填写或使用「AI 生成大纲」。', en: 'Below is the outline template. Fill in or use "AI Generate Outline".' },
    worldbuilding: { zh: '以下为设定框架。请按章节标题逐步填写，或点击下方「AI 生成」。', en: 'Below is the setting framework. Fill in section by section, or use "AI Generate".' },
    foreshadowing: { zh: '以下为伏笔规划模板。请逐条填写你的伏笔设计，或点击下方「AI 规划」。', en: 'Below is the foreshadowing template. Fill in your designs, or use "AI Plan".' },
  },

  m0: {
    hint: { zh: 'M0 · 仅作者可编辑 · Story Elf 不可修改', en: 'M0 · Author only · Story Elf restricted' },
    placeholder: {
      zh: '在这里自由记录你的原始构想、灵感碎片、创作冲动...\n\n没有任何模板限制。用你自己的方式，写任何你想写的内容。\n\n这份记录只有你能修改，Story Elf 不会触碰它。',
      en: 'Freely record your original concepts, inspirations, creative impulses...\n\nNo templates. No constraints. Write in your own way.\n\nOnly you can edit this. Story Elf will never touch it.',
    },
  },

  chat: {
    placeholder: { zh: '让 AI 帮你修改这段...', en: 'Ask AI to revise this...' },
    input_hint:  { zh: '让 AI 帮你修改这段...', en: 'Ask AI to revise this...' },
  },

  editor: {
    placeholder: {
      zh: '在这里写你的故事...\n\n选择左侧章节树中的章节开始写作，或点击「AI 生成」让 AI 帮你写初稿。',
      en: 'Write your story here...\n\nSelect a chapter from the left tree to begin, or click "AI Generate" for a first draft.',
    },
  },

  chapter_status: {
    draft:   { zh: '[draft]',   en: '[draft]' },
    new:     { zh: '[new]',     en: '[new]' },
    done:    { zh: '[done]',    en: '[done]' },
    planned: { zh: '[planned]', en: '[planned]' },
  },

  prompt: {
    login_coming:       { zh: '登录功能即将上线', en: 'Login coming soon' },
    token_debug:        { zh: '输入用户 Token（调试功能，未来由登录替代）', en: 'Enter user token (debug, will be replaced by login)' },
    outline_confirm:    { zh: 'AI 将为此作品生成大纲，确认？', en: 'AI will generate an outline for this work. Confirm?' },
    wb_confirm_prefix:  { zh: 'AI 将为此作品生成世界观设定', en: 'AI will generate worldbuilding settings' },
    fh_confirm:         { zh: 'AI 将基于大纲和世界观帮你规划伏笔网络，确认？', en: 'AI will plan a foreshadowing network. Confirm?' },
    ai_chapter_confirm: { zh: 'AI 将为此章生成内容（可能覆盖当前内容），确认？', en: 'AI may overwrite current content. Confirm?' },
    ai_polish_confirm:  { zh: 'AI 将润色当前章节，确认？', en: 'AI will polish this chapter. Confirm?' },
    chapter_title:      { zh: '章节标题:', en: 'Chapter title:' },
    select_section:     { zh: '请先选择章节', en: 'Please select a chapter first' },
    save_failed:        { zh: '保存失败: ', en: 'Save failed: ' },
    create_failed:      { zh: '创建失败: ', en: 'Create failed: ' },
    ai_gen_failed:      { zh: 'AI 生成失败: ', en: 'AI generation failed: ' },
    polish_failed:      { zh: '润色失败: ', en: 'Polish failed: ' },
    unknown_error:      { zh: '未知错误', en: 'Unknown error' },
    ai_unavailable:     { zh: 'AI 服务不可用', en: 'AI service unavailable' },
    published_ok:       { zh: '已发布！', en: 'Published!' },
    publish_failed:     { zh: '发布失败: ', en: 'Publish failed: ' },
    publish_confirm:     { zh: '发布后作品将在 CAU 公开可见，确认发布？', en: 'After publishing, the work will be publicly visible on CAU. Confirm?' },
  },

  elf: {
    send:              { zh: '发送', en: 'Send' },
    history:           { zh: '对话历史', en: 'History' },
    history_btn:       { zh: '历史对话', en: 'History' },
    new_chat:          { zh: '新对话', en: 'New Chat' },
    no_sessions:       { zh: '暂无对话', en: 'No conversations' },
    untitled:          { zh: '未命名对话', en: 'Untitled' },
    msgs:              { zh: '条消息', en: 'msgs' },
    load_failed:       { zh: '加载失败', en: 'Load failed' },
    ai_unavailable:    { zh: '（AI 暂时无法回应，请稍后重试）', en: '(AI is temporarily unavailable, please try again later)' },
    network_error:     { zh: '（网络异常，请稍后重试）', en: '(Network error, please try again later)' },
    write_placeholder: { zh: '让 AI 帮你修改这段...', en: 'Ask AI to polish this...' },
  },

  footer: {
    powered: { zh: 'Story Forger · Powered by', en: 'Story Forger · Powered by' },
    terms:   { zh: '使用条款', en: 'Terms of Use' },
    rights:  { zh: 'All rights reserved.', en: 'All rights reserved.' },
  },
};

// — i18n 辅助函数 —
function t(path, fallback) {
  var keys = path.split('.');
  var node = I18N;
  for (var i = 0; i < keys.length; i++) {
    if (node == null || node[keys[i]] == null) return fallback != null ? fallback : path;
    node = node[keys[i]];
  }
  var lang = (typeof currentLang !== 'undefined') ? currentLang : 'zh';
  return node[lang] || node.zh || fallback || path;
}

// — 页面加载后处理所有 [data-i18n] 元素 —
document.addEventListener('DOMContentLoaded', function () {
  var els = document.querySelectorAll('[data-i18n]');
  for (var i = 0; i < els.length; i++) {
    var key = els[i].getAttribute('data-i18n');
    var text = t(key);
    if (text) els[i].textContent = text;
  }
  // [data-i18n-placeholder]
  var phs = document.querySelectorAll('[data-i18n-placeholder]');
  for (var j = 0; j < phs.length; j++) {
    var phKey = phs[j].getAttribute('data-i18n-placeholder');
    var phText = t(phKey);
    if (phText) phs[j].setAttribute('placeholder', phText);
  }
  // [data-i18n-title]
  var titles = document.querySelectorAll('[data-i18n-title]');
  for (var k = 0; k < titles.length; k++) {
    var tKey = titles[k].getAttribute('data-i18n-title');
    var tText = t(tKey);
    if (tText) titles[k].setAttribute('title', tText);
  }
});
