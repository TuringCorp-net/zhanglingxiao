// Markdown文件类型定义 - 必须在单独的文件中，不能与 export 混用
declare module '*.md' {
    const content: string
    export default content
}

// JSON文件类型定义
declare module '../content/albums.json' {
    import type { Album } from './types'
    const value: Album[]
    export default value
}

declare module '../content/events.json' {
    import type { Event } from './types'
    const value: Event[]
    export default value
}

declare module '../content/board_members.json' {
    import type { BoardMember } from './types'
    const value: BoardMember[]
    export default value
}

declare module '../content/sponsors.json' {
    import type { Sponsor } from './types'
    const value: Sponsor[]
    export default value
}

declare module '../content/ui.json' {
    import type { UIConfig } from './types'
    const value: UIConfig
    export default value
}
