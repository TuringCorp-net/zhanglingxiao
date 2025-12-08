// 数据模型类型定义
export type Album = {
    slug: string
    name: string
    description?: string
    prefix: string
    cover?: string
}

export type Event = {
    title: string
    link: string
}

export type BoardMember = {
    id: string
    name: string
    intro: string
}

export type Sponsor = {
    id: string
    name: string
    intro: string
    donation: string
    message: string
}

export type Message = {
    id: string
    author?: string
    content: string
    created_at: string
    parent_id?: string
    replies?: Message[]
}

export type UIConfig = {
    site_title: string
    nav_home: string
    nav_albums: string
    nav_board: string
    nav_posts: string
    footer_text: string
    btn_view_albums: string
    btn_view_board: string
    btn_open_album: string
    btn_back_albums: string
    btn_reply: string
    btn_send_reply: string
    btn_submit_msg: string
    msg_board_title: string
    msg_publish_title: string
    msg_latest_title: string
    msg_no_content: string
    msg_input_author: string
    msg_input_content: string
    msg_reply_author: string
    msg_reply_content: string
    album_list_title: string
    album_no_images: string
    posts_title: string
    posts_no_content: string
    posts_read: string
    nav_board_members: string
    nav_sponsors: string
    events_title: string
    board_members_title: string
    sponsors_title: string
    sponsor_donation: string
    sponsor_message: string
}
