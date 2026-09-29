// ============================================================
//  PENSÉE IA — src/ui/icons.js
// ============================================================

const svg = (body, size = 11, extra = '') =>
    `<svg viewBox="0 0 20 20" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;${extra}">${body}</svg>`;

export const ICONS = {
    copy:     svg("<rect x='7' y='7' width='10' height='10' rx='2'/><path d='M3 13V3h10'/>", 11, 'margin-right:4px;'),
    check:    svg("<polyline points='3,10 8,15 17,5'/>", 11, 'margin-right:4px;'),
    sound:    svg("<path d='M3 7v6h4l5 4V3L7 7H3z'/><path d='M15 7a4 4 0 0 1 0 6'/>", 11, 'margin-right:4px;'),
    brain:    svg("<path d='M10 2a6 6 0 0 1 6 6c0 2.5-1.5 4.7-3.7 5.6L12 16H8l-.3-2.4C5.5 12.7 4 10.5 4 8a6 6 0 0 1 6-6z'/><line x1='8' y1='18' x2='12' y2='18'/>"),
    shield:   svg("<path d='M10 2L3 5v5c0 4.4 3 8.5 7 9.5 4-1 7-5.1 7-9.5V5L10 2z'/><polyline points='7,10 9,12 13,8'/>", 12, 'margin-right:4px;'),
    file:     svg("<path d='M4 2h8l4 4v12H4V2z'/><polyline points='12,2 12,6 16,6'/>", 12, 'flex-shrink:0;'),
    download: svg("<path d='M10 3v10M5 9l5 5 5-5'/><path d='M3 17h14'/>", 11, 'flex-shrink:0;'),
    search:   svg("<circle cx='8.5' cy='8.5' r='5'/><line x1='13' y1='13' x2='17' y2='17'/>", 12),
    globe:    svg("<circle cx='10' cy='10' r='8'/><line x1='2' y1='10' x2='18' y2='10'/><path d='M10 2a14 14 0 0 1 0 16M10 2a14 14 0 0 0 0 16'/>", 12),
    terminal: svg("<rect x='2' y='3' width='16' height='14' rx='2'/><polyline points='6,8 9,10.5 6,13'/><line x1='11' y1='13' x2='14' y2='13'/>", 12),
    pencil:   svg("<path d='M14.5 2.5l3 3L7 16l-4 1 1-4z'/>", 12),
    eye:      svg("<path d='M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z'/><circle cx='10' cy='10' r='2.5'/>", 12),
    folder:   svg("<path d='M2 5a1 1 0 0 1 1-1h5l2 2h7a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z'/>", 12),
    image:    svg("<rect x='2' y='3' width='16' height='14' rx='2'/><circle cx='7' cy='8' r='1.5'/><path d='M18 14l-5-5-8 8'/>", 12),
    doc:      svg("<path d='M4 2h8l4 4v12H4V2z'/><polyline points='12,2 12,6 16,6'/><line x1='7' y1='11' x2='13' y2='11'/><line x1='7' y1='14' x2='11' y2='14'/>", 12),
    tool:     svg("<path d='M13 3a4 4 0 0 0-3.9 5L3 14.1V17h2.9L12 10.9A4 4 0 1 0 13 3z'/>", 12),
    chevron:  svg("<polyline points='5,8 10,13 15,8'/>", 10),
    spinner:  `<svg class="pz-spin" viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10" cy="10" r="7" stroke-dasharray="22 10"/></svg>`,
    ok:       svg("<polyline points='3,10 8,15 17,5'/>", 12),
    fail:     svg("<line x1='5' y1='5' x2='15' y2='15'/><line x1='15' y1='5' x2='5' y2='15'/>", 12),
    auto:     `<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="10" r="2"/><circle cx="15" cy="5" r="2"/><circle cx="15" cy="15" r="2"/><line x1="7" y1="9" x2="13" y2="6"/><line x1="7" y1="11" x2="13" y2="14"/></svg>`,
    send:     '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>',
    stop:     '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    trash:    '<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
};
