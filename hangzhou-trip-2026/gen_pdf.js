/**
 * 杭州3日游攻略 PDF 生成脚本
 * 使用 pdfmake 0.3.x
 */
const Printer = require('/home/uncleclaw/.openclaw/workspace/WM/node_modules/pdfmake/js/Printer.js').default;
const URLResolver = require('/home/uncleclaw/.openclaw/workspace/WM/node_modules/pdfmake/js/URLResolver.js').default;
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const WORK_DIR = '/home/uncleclaw/.openclaw/workspace/WM/hangzhou-trip-2026';

// Fonts
const FONTS = {
    NotoSansSC: {
        normal: '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf',
        bold: '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf',
        italics: '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf',
        bolditalics: '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf'
    }
};

// Image download helper
function downloadImage(url, destPath) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(destPath)) { resolve(); return; }
        const file = fs.createWriteStream(destPath);
        const protocol = url.startsWith('https') ? https : http;
        const req = protocol.get(url, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                protocol.get(response.headers.location, (res2) => {
                    if (res2.statusCode >= 200 && res2.statusCode < 300) {
                        res2.pipe(file);
                        file.on('finish', () => { file.close(); resolve(); });
                    } else { file.close(); reject(new Error(`HTTP ${res2.statusCode}`)); }
                }).on('error', reject);
            } else if (response.statusCode >= 200 && response.statusCode < 300) {
                response.pipe(file);
                file.on('finish', () => { file.close(); resolve(); });
            } else {
                file.close(); reject(new Error(`HTTP ${response.statusCode}`));
            }
        });
        req.on('error', (e) => { try { fs.unlinkSync(destPath); } catch(e2){} reject(e); });
    });
}

async function main() {
    console.log('Starting PDF generation...');

    // Try to download images - but continue if they fail
    const imageConfigs = [
        { key: 'cover', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Taihu_xiuli.jpg/1280px-Taihu_xiuli.jpg' },
        { key: 'duanqiao', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Zhou_Fang_%28act.%E5%8D%81%E4%B8%80%E4%B8%96%E7%BA%AA%29._%E6%96%AD%E6%A1%A5%E6%AE%8A%E9%9B%AA.jpg/800px-%E6%96%AD%E6%A1%A5%E6%AE%8A%E9%9B%AA.jpg' },
        { key: 'lingyin', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Lingyin_Temple%2C_Hangzhou_01.jpg/1024px-Lingyin_Temple%2C_Hangzhou_01.jpg' },
        { key: 'xixi', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Xixi_National_Wetland_Park.jpg/1024px-Xixi_National_Wetland_Park.jpg' },
        { key: 'songcheng', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Hangzhou_Songcheng.jpg/1024px-Hangzhou_Songcheng.jpg' },
        { key: 'longjing', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Longjing_Tea_plantations.jpg/1024px-Longjing_Tea_plantations.jpg' },
    ];

    console.log('\n--- Downloading images ---');
    const imageMap = {};
    for (const cfg of imageConfigs) {
        const destPath = path.join(WORK_DIR, `${cfg.key}.jpg`);
        try {
            await downloadImage(cfg.url, destPath);
            const stats = fs.statSync(destPath);
            if (stats.size > 10000) {  // At least 10KB
                imageMap[cfg.key] = destPath;
                console.log(`[OK] ${cfg.key}.jpg (${(stats.size/1024).toFixed(0)}KB)`);
            } else {
                console.log(`[Skip] ${cfg.key}.jpg - too small (${stats.size}B)`);
            }
        } catch(e) {
            console.log(`[Fail] ${cfg.key}.jpg: ${e.message}`);
        }
    }

    console.log('\n--- Building PDF content ---');
    const printer = new Printer(FONTS, fs, new URLResolver(fs));

    function img(key, width = 420) {
        const p = imageMap[key];
        if (!p) return { text: '', margin: [0, 0, 0, 8] };
        return { image: p, width, alignment: 'center', margin: [0, 0, 0, 8] };
    }

    const docDefinition = {
        pageSize: 'A4',
        pageMargins: [40, 40, 40, 40],
        info: {
            title: '杭州3日游完全攻略 - 2026年4月',
            author: '虾康康',
            subject: '杭州旅游攻略'
        },
        content: [
            // ==================== COVER PAGE ====================
            {
                stack: [
                    { text: '', spacing: 60 },
                    {
                        text: '🌸 人间天堂',
                        style: 'coverSubtitle',
                        alignment: 'center',
                        color: '#4a7c59'
                    },
                    {
                        text: '杭州 · 春季3日游',
                        style: 'coverTitle',
                        alignment: 'center'
                    },
                    { text: '', spacing: 15 },
                    {
                        text: '2026年4月 · 自由行完全攻略',
                        style: 'coverDate',
                        alignment: 'center',
                        color: '#888888'
                    },
                    { text: '', spacing: 30 },
                    img('cover', 400),
                    { text: '', spacing: 30 },
                    {
                        text: '中档自由行预算：¥1500-2500/人',
                        style: 'budget',
                        alignment: 'center',
                        color: '#2e7d32'
                    },
                    { text: '', spacing: 20 },
                    {
                        text: '柳绿桃红 · 春满西湖 · 龙井飘香',
                        style: 'coverPoem',
                        alignment: 'center',
                        color: '#888888'
                    }
                ],
                pageBreak: 'after'
            },

            // ==================== OVERVIEW ====================
            {
                text: '行程概览',
                style: 'pageTitle',
                pageBreak: 'before'
            },
            {
                text: '杭州四月气温 11-22°C，春意盎然，是全年最美时节之一。西湖垂柳、苏堤桃红、太子湾郁金香、龙井春茶……一幅江南春意图等你来！',
                style: 'intro'
            },
            { text: '', spacing: 10 },
            // Summary table
            {
                table: {
                    headerRows: 1,
                    widths: ['auto', '*', '*', '*'],
                    body: [
                        [{ text: '日期', style: 'th' }, { text: '上午', style: 'th' }, { text: '下午', style: 'th' }, { text: '晚餐推荐', style: 'th' }],
                        [{ text: 'Day 1', style: 'tdBold' }, { text: '断桥残雪 → 白堤漫步', style: 'td' }, { text: '苏堤春晓 → 雷峰塔', style: 'td' }, { text: '河坊街/高银街', style: 'td' }],
                        [{ text: 'Day 2', style: 'tdBold' }, { text: '灵隐寺 · 飞来峰', style: 'td' }, { text: '龙井村问茶', style: 'td' }, { text: '青芝坞', style: 'td' }],
                        [{ text: 'Day 3', style: 'tdBold' }, { text: '西溪国家湿地公园', style: 'td' }, { text: '太子湾公园赏花', style: 'td' }, { text: '胜利河美食街', style: 'td' }]
                    ]
                },
                layout: 'lightHorizontalLines'
            },
            { text: '', spacing: 15 },
            // Budget overview
            {
                table: {
                    widths: ['*', '*', '*'],
                    body: [
                        [{ text: '预算项目', style: 'th' }, { text: '建议花费', style: 'th' }, { text: '备注', style: 'th' }],
                        [{ text: '交通', style: 'tdBold' }, { text: '¥300-500', style: 'td' }, { text: '含杭州内部交通+城际', style: 'td' }],
                        [{ text: '门票', style: 'tdBold' }, { text: '¥400-600', style: 'td' }, { text: '灵隐寺+飞来峰75, 西溪80等', style: 'td' }],
                        [{ text: '餐饮', style: 'tdBold' }, { text: '¥400-700', style: 'td' }, { text: '正餐50-150/餐', style: 'td' }],
                        [{ text: '住宿', style: 'tdBold' }, { text: '¥400-700', style: 'td' }, { text: '2晚中档酒店(200-350/晚)', style: 'td' }],
                        [{ text: '总计', style: 'tdBold', fillColor: '#e8f5e9', color: '#2e7d32' }, { text: '¥1500-2500/人', style: 'tdBold', fillColor: '#e8f5e9', color: '#2e7d32' }, { text: '仅供参考，可自行调整', style: 'td', fillColor: '#e8f5e9' }]
                    ]
                },
                layout: 'lightHorizontalLines'
            },

            // ==================== DAY 1 ====================
            {
                text: 'Day 1 · 西湖环湖一日',
                style: 'dayTitle',
                pageBreak: 'before'
            },
            img('duanqiao'),
            { text: '🌅 上午：断桥残雪 → 白堤漫步', style: 'sectionTitle' },
            { ul: [
                '🚇 交通：地铁1号线"龙翔桥站"A口出，步行5分钟到断桥',
                '📍 断桥残雪：西湖十景之首，春天垂柳拂面，桃花盛开',
                '📍 白堤：漫步1公里，两侧桃花垂柳，"间株桃花间株柳"',
                '⏱ 建议游览时间：2-3小时（断桥+白堤）',
                '💰 门票：免费（断桥、白堤）'
            ], style: 'bodyList' },
            { text: '', spacing: 8 },
            { text: '🌞 下午：苏堤春晓 → 雷峰塔', style: 'sectionTitle' },
            { ul: [
                '🚇 交通：白堤步行至苏堤（约30分钟），或骑车环湖',
                '📍 苏堤：全长2.8公里，六桥烟柳，桃红柳绿，春天最美',
                '📍 雷峰塔：登塔俯瞰西湖，门票¥40（可线上预订）',
                '⏱ 建议游览时间：3-4小时（苏堤2h + 雷峰塔1.5h）',
                '💰 门票：雷峰塔¥40，苏堤免费'
            ], style: 'bodyList' },
            { text: '', spacing: 8 },
            { text: '🌙 晚餐：河坊街 / 高银街', style: 'sectionTitle' },
            { ul: [
                '📍 河坊街：杭州历史文化街区，夜景绝美',
                '🍜 推荐美食：知味观味庄（百年老店）、小笼包、葱包烩',
                '💰 人均：¥60-120'
            ], style: 'bodyList' },
            { text: '', spacing: 8 },
            { text: '📌 Day 1 实用贴士', style: 'sectionTitle' },
            { ul: [
                '🚇 建议购买"杭州一日票"（地铁+部分公交），¥15/天',
                '🚲 西湖边可租公共自行车（小红车），¥1/小时',
                '⚠️ 旺季断桥游客较多，建议早上8点前到达',
                '☂️ 四月多雨，随身带伞'
            ], style: 'bodyList' },

            // ==================== DAY 2 ====================
            {
                text: 'Day 2 · 灵隐祈福 · 龙井问茶',
                style: 'dayTitle',
                pageBreak: 'before'
            },
            img('lingyin'),
            { text: '🌅 上午：灵隐寺 · 飞来峰', style: 'sectionTitle' },
            { ul: [
                '🚇 交通：地铁1号线"龙翔桥"→7号线"吴山广场"→公交灵隐专线',
                '  或地铁3号线"黄龙洞"B口出，换乘灵隐专线（约40分钟）',
                '📍 灵隐寺：千年古刹，香火鼎盛，济公出家地',
                '📍 飞来峰：奇石嶙峋，遍布五代至元代石刻造像',
                '⏱ 建议游览时间：3-4小时',
                '💰 门票：飞来峰¥45，灵隐寺¥30（进寺需另购香花券）'
            ], style: 'bodyList' },
            { text: '', spacing: 8 },
            img('longjing', 320),
            { text: '🌞 下午：龙井村 · 梅家坞茶文化', style: 'sectionTitle' },
            { ul: [
                '🚇 交通：灵隐出来乘87路公交至"龙井茶室"站（约30分钟）',
                '📍 龙井村：中国十大名茶西湖龙井核心产区',
                '📍 体验：茶农家品茶（¥50-100/杯），或参与采茶体验',
                '📍 梅家坞：茶园风光秀美，是周恩来总理多次视察之地',
                '⏱ 建议游览时间：2-3小时',
                '💰 门票：免费（品茶自费）'
            ], style: 'bodyList' },
            { text: '', spacing: 8 },
            { text: '🌙 晚餐：青芝坞', style: 'sectionTitle' },
            { ul: [
                '📍 青芝坞：靠近灵隐的特色美食街区，环境清幽',
                '🍜 推荐：绿茶餐厅（¥80-120）、龙井茶宴',
                '🏨 住宿：青芝坞周边有不少精品民宿'
            ], style: 'bodyList' },
            { text: '', spacing: 8 },
            { text: '📌 Day 2 实用贴士', style: 'sectionTitle' },
            { ul: [
                '🕐 灵隐寺开放时间：06:30-18:00，建议早点出发避开人流',
                '🍵 龙井茶：不要在景区门口买，贵！进村找茶农家更实惠',
                '⚠️ 飞来峰至灵隐寺一路爬坡，建议穿舒适运动鞋',
                '📱 提前在"杭州西湖风景名胜区"公众号预约门票'
            ], style: 'bodyList' },

            // ==================== DAY 3 ====================
            {
                text: 'Day 3 · 西溪泛舟 · 太子湾赏花',
                style: 'dayTitle',
                pageBreak: 'before'
            },
            img('xixi'),
            { text: '🌅 上午：西溪国家湿地公园', style: 'sectionTitle' },
            { ul: [
                '🚇 交通：地铁19号线"西溪湿地北"A口出，步行10分钟',
                '📍 西溪湿地：中国首个国家湿地公园，"杭州之肾"',
                '📍 四月景色：绿树成荫，鸟类繁多，乘摇橹船游览最惬意',
                '⏱ 建议游览时间：3-4小时（乘船游览）',
                '💰 门票：¥80（大门票），摇橹船¥100/小时（可拼船）'
            ], style: 'bodyList' },
            { text: '', spacing: 8 },
            { text: '🌞 下午：太子湾公园', style: 'sectionTitle' },
            { ul: [
                '🚇 交通：地铁1号线"龙翔桥"→公交194路至"苏堤"',
                '  或西溪湿地出来步行/打车（约15分钟）',
                '📍 太子湾公园：四月是杭州赏花圣地，郁金香、樱花盛放',
                '📍 拍照攻略：公园入口处的大风车是经典机位',
                '⏱ 建议游览时间：1.5-2小时',
                '💰 门票：免费（需提前在"掌上西湖"预约）'
            ], style: 'bodyList' },
            { text: '', spacing: 8 },
            img('songcheng', 320),
            { text: '🌙 晚餐 + 夜游：胜利河美食街', style: 'sectionTitle' },
            { ul: [
                '📍 胜利河美食街：杭州"夜宵圣地"，特色小吃云集',
                '🍜 推荐：老苍门家常菜、桐州酸菜鱼、小笼包',
                '🚇 交通：地铁1号线"武林广场"或"凤起路"',
                '💰 人均：¥60-100'
            ], style: 'bodyList' },
            { text: '', spacing: 8 },
            { text: '📌 Day 3 实用贴士', style: 'sectionTitle' },
            { ul: [
                '🌸 四月太子湾赏花旺季，务必提前预约！',
                '🚣 西溪湿地推荐乘摇橹船，深度游览而非电瓶船',
                '⚠️ 美食街晚间较热闹，注意保管好随身物品',
                '🛍️ 可在胜利河美食街购买杭州特产（如酱鸭、桂花糕）'
            ], style: 'bodyList' },

            // ==================== FOOD SECTION ====================
            {
                text: '杭州必吃美食清单',
                style: 'pageTitle',
                pageBreak: 'before'
            },
            {
                text: '来杭州，这些地道美味千万不可错过！',
                style: 'intro'
            },
            { text: '', spacing: 10 },
            {
                table: {
                    widths: ['*', 220, 120],
                    body: [
                        [{ text: '美食名称', style: 'th' }, { text: '推荐理由', style: 'th' }, { text: '推荐店铺', style: 'th' }],
                        [{ text: '西湖醋鱼', style: 'tdBold' }, { text: '鱼肉鲜嫩，酸甜可口，西湖代表名菜', style: 'td' }, { text: '楼外楼', style: 'td' }],
                        [{ text: '东坡肉', style: 'tdBold' }, { text: '肥而不腻，入口即化，色泽红亮', style: 'td' }, { text: '杭州酒家', style: 'td' }],
                        [{ text: '龙井虾仁', style: 'tdBold' }, { text: '龙井茶香+河虾鲜嫩，绝妙搭配', style: 'td' }, { text: '知味观味庄', style: 'td' }],
                        [{ text: '片儿川', style: 'tdBold' }, { text: '"江南第一面"，雪菜笋片汤底极鲜', style: 'td' }, { text: '奎元馆', style: 'td' }],
                        [{ text: '葱包烩儿', style: 'tdBold' }, { text: '杭州街头烟火小吃，油脆香甜', style: 'td' }, { text: '河坊街小摊', style: 'td' }],
                        [{ text: '定胜糕', style: 'tdBold' }, { text: '传统祈福糕点，软糯香甜，桂花飘香', style: 'td' }, { text: '梁空洞', style: 'td' }],
                        [{ text: '杭州小笼包', style: 'tdBold' }, { text: '皮薄汁多，鲜香四溢，早餐首选', style: 'td' }, { text: '皇饭儿', style: 'td' }],
                        [{ text: '宋嫂鱼羹', style: 'tdBold' }, { text: '南宋名菜，口感嫩滑似蟹肉', style: 'td' }, { text: '知味观味庄', style: 'td' }],
                        [{ text: '干炸响铃', style: 'tdBold' }, { text: '外皮酥脆如铃，泗乡豆腐皮特色', style: 'td' }, { text: '楼外楼', style: 'td' }]
                    ]
                },
                layout: 'lightHorizontalLines'
            },
            { text: '', spacing: 12 },
            { text: '🍽️ 美食地图推荐', style: 'sectionTitle' },
            { ul: [
                '📍 河坊街/高银街：老字号集中，游客首选',
                '📍 胜利河美食街：夜宵圣地，本地人常去',
                '📍 南宋御街（中山南路）：烟火气十足',
                '📍 青芝坞：靠近灵隐，环境好，适合午餐',
                '📍 小河直街：京杭大运河边，文艺小资'
            ], style: 'bodyList' },

            // ==================== PRACTICAL INFO ====================
            {
                text: '实用信息大全',
                style: 'pageTitle',
                pageBreak: 'before'
            },
            { text: '🗓️ 四月天气与穿衣建议', style: 'sectionTitle' },
            {
                table: {
                    widths: ['*', '*'],
                    body: [
                        [{ text: '项目', style: 'th' }, { text: '详情', style: 'th' }],
                        [{ text: '平均气温', style: 'tdBold' }, { text: '11-22°C', style: 'td' }],
                        [{ text: '天气特点', style: 'tdBold' }, { text: '温暖舒适，昼夜温差大（可达10°C+）', style: 'td' }],
                        [{ text: '降雨', style: 'tdBold' }, { text: '四月多雨，小雨/阵雨为主，记得带伞', style: 'td' }],
                        [{ text: '穿搭建议', style: 'tdBold' }, { text: '"洋葱式"穿衣：长袖+薄外套+备一件中等厚度外套', style: 'td' }],
                        [{ text: '鞋子', style: 'tdBold' }, { text: '舒适运动鞋（多步行）+备一双防滑鞋', style: 'td' }],
                        [{ text: '其他', style: 'tdBold' }, { text: '围巾（防风+拍照）+口罩（柳絮花粉过敏者）', style: 'td' }]
                    ]
                },
                layout: 'lightHorizontalLines'
            },
            { text: '', spacing: 12 },
            { text: '🚇 杭州地铁攻略', style: 'sectionTitle' },
            { ul: [
                '📱 地铁APP："杭州市民卡"或"metro大都会"（可刷二维码进站）',
                '💳 交通联合卡：全国交通联合卡均可使用',
                '🚌 主要景点地铁可达：',
                '  1号线：龙翔桥（西湖）、武林广场、凤起路',
                '  2号线：京杭大运河、拱宸桥',
                '  7号线：吴山广场（河坊街）',
                '  19号线：西溪湿地北',
                '💡 建议购买杭州一日票/三日票，含地铁+部分公交'
            ], style: 'bodyList' },
            { text: '', spacing: 12 },
            { text: '🏨 住宿推荐区域', style: 'sectionTitle' },
            { ul: [
                '📍 西湖湖滨（最佳位置，方便早起游湖）',
                '📍 龙翔桥/凤起路附近（地铁枢纽，交通便利）',
                '📍 青芝坞（近灵隐，环境清幽，适合慢节奏）',
                '📍 河坊街周边（美食多，夜生活丰富）',
                '💰 中档酒店：¥200-400/晚，四月旺季需提前1-2周预订'
            ], style: 'bodyList' },
            { text: '', spacing: 12 },
            { text: '⚠️ 重要注意事项', style: 'sectionTitle' },
            { ul: [
                '📱 提前预约：灵隐寺、西溪湿地、太子湾公园均需提前预约',
                '⏰ 早起出行：旺季西湖边清晨人少景美，建议6:30-7:00出发',
                '☂️ 四月多雨：随身携带折叠伞或雨衣',
                '🍵 龙井茶：景区门口慎买，推荐进龙井村找茶农家购买',
                '📸 拍照：太子湾公园大风车、雷峰塔四层观景台是最佳机位',
                '🧴 防晒：四月阳光渐强，户外需做好防晒'
            ], style: 'bodyList' },

            // ==================== FINAL PAGE ====================
            {
                stack: [
                    { text: '', spacing: 60 },
                    { text: '愿你在杭州', style: 'finalPoem', alignment: 'center' },
                    { text: '遇见最美的春天 🌸', style: 'finalPoem', alignment: 'center' },
                    { text: '', spacing: 30 },
                    { text: '西湖的水，你的笑容', style: 'finalPoem2', alignment: 'center', color: '#666666' },
                    { text: '龙井的茶，你的从容', style: 'finalPoem2', alignment: 'center', color: '#666666' },
                    { text: '', spacing: 50 },
                    { text: '—— 虾康康 制作', style: 'finalCredit', alignment: 'center' },
                    { text: '2026年3月', style: 'finalCredit', alignment: 'center' }
                ]
            }
        ],

        styles: {
            coverTitle: { fontSize: 36, bold: true, color: '#1a1a2e' },
            coverSubtitle: { fontSize: 16, color: '#4a7c59' },
            coverDate: { fontSize: 13, color: '#888888' },
            coverPoem: { fontSize: 12, italics: true },
            budget: { fontSize: 15, bold: true },
            pageTitle: { fontSize: 22, bold: true, color: '#1a1a2e', margin: [0, 0, 0, 8] },
            dayTitle: { fontSize: 19, bold: true, color: '#2e7d32', margin: [0, 0, 0, 8] },
            sectionTitle: { fontSize: 13, bold: true, color: '#4a7c59', margin: [0, 6, 0, 4] },
            intro: { fontSize: 11, color: '#444444', lineHeight: 1.6 },
            bodyList: { fontSize: 10, color: '#333333', lineHeight: 1.7 },
            th: { bold: true, fillColor: '#4a7c59', color: '#ffffff', fontSize: 10, alignment: 'center' },
            tdBold: { bold: true, fontSize: 10, color: '#333333' },
            td: { fontSize: 10, color: '#555555' },
            finalPoem: { fontSize: 22, bold: true, color: '#2e7d32' },
            finalPoem2: { fontSize: 13, italics: true, color: '#666666' },
            finalCredit: { fontSize: 10, color: '#999999' }
        },

        defaultStyle: {
            font: 'NotoSansSC',
            fontSize: 10
        }
    };

    console.log('\n--- Generating PDF ---');
    const pdfPath = path.join(WORK_DIR, 'hangzhou-3day-guide.pdf');
    const pdfDoc = await printer.createPdfKitDocument(docDefinition);
    const writeStream = fs.createWriteStream(pdfPath);
    pdfDoc.pipe(writeStream);
    pdfDoc.end();

    writeStream.on('finish', () => {
        const stats = fs.statSync(pdfPath);
        console.log(`\n✅ PDF generated: ${pdfPath}`);
        console.log(`📄 File size: ${(stats.size / 1024).toFixed(1)} KB`);
    });
    writeStream.on('error', (err) => {
        console.error('Error writing PDF:', err);
    });
}

main().catch(console.error);
