import type { TimelineQuery, TimelineRecord } from './types.js';

export function buildWorkMemoryCard(records: TimelineRecord[], query: TimelineQuery) {
  const selected = records.filter(record =>
    (!query.startDate || record.date >= query.startDate) &&
    (!query.endDate || record.date <= query.endDate) &&
    (!query.project || record.projects.includes(query.project)));
  const dates = selected.map(record => record.date).sort();
  return {
    project: query.project || '全部项目',
    startDate: query.startDate || dates[0] || '',
    endDate: query.endDate || dates.at(-1) || '',
    reports: selected.length,
    activeDays: new Set(dates).size,
    commits: selected.reduce((sum, record) => sum + record.commitsCount, 0),
    files: selected.reduce((sum, record) => sum + record.filesCount, 0),
    projects: new Set(selected.flatMap(record => record.projects)).size,
    milestones: selected.filter(record => record.milestone).length,
    highlights: selected.filter(record => record.milestone).slice(-3).reverse().map(record => `${record.date}  ${record.title}`),
    tags: [...new Set(selected.flatMap(record => record.techTags))].slice(0, 6),
  };
}

export type WorkMemoryCard = ReturnType<typeof buildWorkMemoryCard>;

const palettes: Record<string, { background: string; ink: string; muted: string; accent: string; label: string; title: string; subtitle: string; edition: string }> = {
  'card-paper': { background: '#f5efdf', ink: '#383b32', muted: '#7b7b69', accent: '#ae5537', label: '时光纸笺', title: '把日常，酿成时光。', subtitle: '每一个认真度过的日子，都有回响。', edition: '01 / THE JOURNAL' },
  'card-blueprint': { background: '#09282c', ink: '#e5f4e9', muted: '#93b5ad', accent: '#b4f3bb', label: '工程蓝图', title: '让想法，有迹可循。', subtitle: '从第一行代码，到每一次交付。', edition: '02 / THE BLUEPRINT' },
  'card-orbit': { background: '#10121e', ink: '#f2efff', muted: '#a4a8c0', accent: '#c4bdff', label: '星轨纪念', title: '微光，自有引力。', subtitle: '那些持续的投入，终将连成星轨。', edition: '03 / THE ORBIT' },
};

function escapeXml(value: string) {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);
}

function truncate(value: string, length: number) {
  const chars = Array.from(value);
  return chars.length > length ? `${chars.slice(0, length).join('')}…` : value;
}

/** Vector artwork is embedded in the exported SVG, with no external assets. */
function artwork(itemId: string) {
  if (itemId === 'card-paper') return `
    <defs>
      <pattern id="paper-grain" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="1" cy="2" r=".6" fill="#82765d" opacity=".14"/><circle cx="5" cy="6" r=".5" fill="#fff" opacity=".5"/></pattern>
      <clipPath id="landscape"><circle cx="930" cy="280" r="172"/></clipPath>
      <linearGradient id="sunset" x2="0" y2="1"><stop stop-color="#ddad75"/><stop offset="1" stop-color="#ecdbc1"/></linearGradient>
    </defs>
    <rect width="1200" height="820" fill="url(#paper-grain)"/>
    <path d="M716 100V490" stroke="#b8b19c" stroke-dasharray="3 7"/>
    <circle cx="930" cy="280" r="187" fill="none" stroke="#b9b29b"/>
    <circle cx="930" cy="280" r="180" fill="none" stroke="#b9b29b" stroke-dasharray="1 5"/>
    <g clip-path="url(#landscape)">
      <circle cx="930" cy="280" r="172" fill="url(#sunset)"/>
      <circle cx="967" cy="215" r="59" fill="#f8efd9"/>
      <path d="M730 358L810 250 868 318 925 266 1022 362 1140 282V480H730Z" fill="#adac8a"/>
      <path d="M720 401L845 311 940 403 1014 331 1140 417V480H720Z" fill="#697760"/>
      <path d="M735 448Q830 355 932 428T1140 405V490H735Z" fill="#394e43"/>
      ${Array.from({ length: 9 }, (_, i) => `<path d="M740 ${367 + i * 14}Q850 ${301 + i * 15} 960 ${391 + i * 12}T1130 ${370 + i * 12}" fill="none" stroke="#f2e9d1" opacity=".18"/>`).join('')}
    </g>
    <g transform="translate(1052 380) rotate(12)"><rect width="70" height="80" rx="3" fill="#ae5537"/><rect x="5" y="5" width="60" height="70" rx="1" fill="none" stroke="#f5efdf" opacity=".7"/><text x="35" y="34" text-anchor="middle" font-size="23" fill="#f5efdf" font-family="serif">时光</text><text x="35" y="62" text-anchor="middle" font-size="23" fill="#f5efdf" font-family="serif">留印</text></g>`;
  if (itemId === 'card-blueprint') return `
    <defs><pattern id="blue-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="#9fd6bb" stroke-width=".5" opacity=".13"/></pattern>
    <linearGradient id="tower" x2="0" y2="1"><stop stop-color="#8ad9ad" stop-opacity=".4"/><stop offset="1" stop-color="#1e6464" stop-opacity=".12"/></linearGradient></defs>
    <rect x="700" y="96" width="440" height="390" fill="url(#blue-grid)"/>
    <g stroke="#a9dfbd" fill="none" stroke-width="1.2">
      <path d="M720 405L936 285 1140 405 924 525Z" opacity=".35"/>
      <path d="M760 374L936 275 1100 374 924 475Z" opacity=".6"/>
      <path d="M830 341V223L930 166 1030 223V341L930 399Z" fill="url(#tower)"/>
      <path d="M830 223L930 281 1030 223M930 281V399M930 166V118"/>
      <path d="M871 199V136L930 102 989 136V199L930 233Z" fill="#20524e"/>
      <path d="M871 136L930 170 989 136M930 170V233"/>
      ${Array.from({ length: 6 }, (_, i) => `<path d="M830 ${241 + i * 17}L930 ${299 + i * 17} 1030 ${241 + i * 17}" opacity=".5"/>`).join('')}
      <path d="M785 345V255L830 229M1070 345V255L1030 232M785 255L774 249M1070 255L1081 249" stroke-dasharray="4 5"/>
      <path d="M776 415L924 500 1074 415M776 408V422M1074 408V422" opacity=".65"/>
      <circle cx="930" cy="102" r="5" fill="#b4f3bb"/><circle cx="924" cy="475" r="4" fill="#b4f3bb"/>
      <path d="M733 114h18m-9-9v18M1110 114h18m-9-9v18M733 472h18m-9-9v18" opacity=".65"/>
    </g>`;
  return `
    <defs>
      <radialGradient id="nebula"><stop stop-color="#5a477c" stop-opacity=".6"/><stop offset="1" stop-color="#10121e" stop-opacity="0"/></radialGradient>
      <radialGradient id="planet" cx=".3" cy=".2" r=".85"><stop stop-color="#e7dec9"/><stop offset=".28" stop-color="#b5a8c8"/><stop offset=".58" stop-color="#5b5b80"/><stop offset=".85" stop-color="#252c47"/><stop offset="1" stop-color="#101524"/></radialGradient>
      <linearGradient id="foil" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e7d9ac"/><stop offset=".25" stop-color="#9dded8"/><stop offset=".52" stop-color="#a49cdb"/><stop offset=".76" stop-color="#efbad5"/><stop offset="1" stop-color="#f2dfb5"/></linearGradient>
      <clipPath id="planet-clip"><circle cx="922" cy="284" r="115"/></clipPath>
    </defs>
    <ellipse cx="930" cy="280" rx="300" ry="270" fill="url(#nebula)"/>
    ${Array.from({ length: 38 }, (_, i) => `<circle cx="${725 + ((i * 73) % 410)}" cy="${100 + ((i * 47) % 380)}" r="${i % 5 === 0 ? 1.7 : .8}" fill="#e2d8ff" opacity="${.25 + (i % 4) * .15}"/>`).join('')}
    <g fill="none" stroke="url(#foil)"><circle cx="922" cy="284" r="183" opacity=".16"/><circle cx="922" cy="284" r="203" stroke-dasharray="2 10" opacity=".35"/>
      <ellipse cx="922" cy="284" rx="228" ry="78" transform="rotate(-32 922 284)" stroke-width="2" opacity=".6"/>
    </g>
    <circle cx="922" cy="284" r="115" fill="url(#planet)"/>
    <g clip-path="url(#planet-clip)" fill="none" stroke="#ece2ec" opacity=".1">
      ${Array.from({ length: 12 }, (_, i) => `<ellipse cx="890" cy="${183 + i * 17}" rx="132" ry="32" transform="rotate(-24 922 284)"/>`).join('')}
    </g>
    <path d="M730 360C716 402 820 393 956 309S1140 152 1114 208" fill="none" stroke="url(#foil)" stroke-width="10"/>
    <path d="M730 360C716 402 820 393 956 309S1140 152 1114 208" fill="none" stroke="#f1e6ef" stroke-width="1" opacity=".75"/>
    <g fill="url(#foil)"><circle cx="1070" cy="144" r="9"/><path d="M778 173l3 10 10 3-10 3-3 10-3-10-10-3 10-3Z"/><circle cx="1028" cy="430" r="3"/></g>`;
}

/** One SVG serves both preview and export; no remote images, fonts or HTML. */
export function renderWorkMemoryCard(data: WorkMemoryCard, itemId: string) {
  const palette = palettes[itemId];
  if (!palette) throw new Error('纪念卡卡面不存在');
  const paper = itemId === 'card-paper';
  const text = (x: number, y: number, value: string, size = 20, fill = palette.ink, extra = '') =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${escapeXml(value)}</text>`;
  const metrics = [[data.commits, '累计提交', 'COMMITS'], [data.files, '累计文件', 'FILES'], [data.projects, '涉及项目', 'PROJECTS'], [data.milestones, '里程碑', 'MILESTONES']];
  const highlights = data.highlights.length ? data.highlights : ['持续记录的日常，同样值得珍藏。'];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="820" viewBox="0 0 1200 820" role="img" aria-label="工作纪念卡">
    <defs><clipPath id="card-bounds"><rect width="1200" height="820" rx="24"/></clipPath></defs>
    <g clip-path="url(#card-bounds)" font-family="Microsoft YaHei, PingFang SC, sans-serif">
      <rect width="1200" height="820" fill="${palette.background}"/>
      ${artwork(itemId)}
      <rect x="20" y="20" width="1160" height="780" rx="12" fill="none" stroke="${palette.accent}" opacity=".25"/>
      <path d="M56 86H1144" stroke="${palette.accent}" opacity=".3"/>
      ${text(56, 60, '码迹 / 工作纪念卡', 15, palette.accent, 'letter-spacing="3"')}
      ${text(1144, 60, palette.edition, 13, palette.muted, 'text-anchor="end" letter-spacing="3"')}
      ${text(56, 145, truncate(data.project, 24), 17, palette.muted)}
      ${text(53, 211, palette.title, 41, palette.ink, paper ? 'font-family="Georgia, Songti SC, SimSun, serif"' : 'font-weight="600" letter-spacing="1"')}
      ${text(56, 253, palette.subtitle, 17, palette.muted)}
      ${text(50, 385, String(data.activeDays).padStart(2, '0'), 108, paper ? palette.accent : palette.ink, 'font-family="Georgia, serif"')}
      ${text(56, 423, '个活跃日，让积累拥有形状', 17, palette.muted)}
      ${text(56, 478, `${data.startDate.replaceAll('-', '.')}  —  ${data.endDate.replaceAll('-', '.')}`, 16, palette.ink, 'font-family="Consolas, monospace" letter-spacing="1"')}
      ${text(930, 492, palette.label, 14, palette.accent, 'text-anchor="middle" letter-spacing="6"')}
      <rect x="44" y="520" width="1112" height="100" rx="3" fill="${palette.accent}" opacity="${paper ? '.07' : '.06'}"/>
      ${metrics.map(([value, label, english], i) => text(70 + i * 278, 565, Number(value).toLocaleString('en-US'), 31, palette.ink, 'font-family="Georgia, serif"') + text(70 + i * 278, 598, String(label), 13, palette.muted) + text(320 + i * 278, 598, String(english), 10, palette.muted, 'text-anchor="end" letter-spacing="1"') + (i ? `<path d="M${44 + i * 278} 540V600" stroke="${palette.accent}" opacity=".18"/>` : '')).join('')}
      ${text(56, 656, '值得记住的瞬间', 13, palette.accent)}
      ${highlights.slice(0, 2).map((line, i) => text(56, 686 + i * 27, truncate(line, 48), 15)).join('')}
      ${text(1144, 656, 'BUILT WITH', 10, palette.muted, 'text-anchor="end" letter-spacing="2"')}
      ${data.tags.slice(0, 4).map((tag, i) => text(1144, 681 + i * 20, truncate(tag, 18), 13, palette.accent, 'text-anchor="end"')).join('')}
      <path d="M56 756H1144" stroke="${palette.accent}" opacity=".25"/>
      ${text(56, 779, `${data.reports} 份日报 · 提交与文件按日报累计，非去重值；合篇日报按整份统计。`, 11, palette.muted)}
      ${text(1144, 779, '里程碑沿用时间长河标记', 11, palette.muted, 'text-anchor="end"')}
    </g>
  </svg>`;
}
