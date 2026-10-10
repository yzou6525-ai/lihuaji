// Shared line icon vocabulary for the Ivory Museum Archive theme.
const paths = {
  arrow:'<path d="M4 12h15m-5-5 5 5-5 5"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  scan:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M6 12h12"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  home:'<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
  flower:'<path d="M12 10C6 1 1 9 8 13c-5 7 5 11 6 3 8 4 11-5 3-6 2-8-7-10-7-2"/><circle cx="12" cy="12" r="2"/>',
  needle:'<path d="m7 17 9-13c2-3 6 0 4 3L7 17l-4 4Z"/><path d="m16 6 2-1M7 17c3 7 10 4 9 1"/>',
  archive:'<path d="m3 9 9-6 9 6H3Zm2 3v7m5-7v7m4-7v7m5-7v7M3 21h18"/>',
  user:'<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  camera:'<path d="M3 7h4l2-3h6l2 3h4v13H3Z"/><circle cx="12" cy="13" r="4"/>',
  game:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="m15 17 2 2 4-5"/>',
  book:'<path d="M12 5C8 3 5 3 2 4v16c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-6-1-10 1Zm0 0v16"/>',
  users:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-17a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 4v3"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  palette:'<path d="M20 14c3-9-7-14-13-9-8 6-2 17 6 16 5-1-2-6 2-7Z"/><circle cx="8" cy="9" r=".7"/><circle cx="12" cy="7" r=".7"/><circle cx="16" cy="9" r=".7"/>'
};
export const icon=(name,cls='')=>`<svg class="ui-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.flower}</svg>`;
export const primaryNav=[['home','首页','home'],['library','灵感','flower'],['create','译绣','needle'],['gallery','绣馆','archive'],['profile','我的','user']];
export const routeIcons={story:'needle',home:'home',library:'flower',create:'needle',gallery:'archive',profile:'user',ar:'scan',face:'camera',game:'game',guide:'book',palette:'palette',collaborate:'users',about:'info',exhibit:'flower',search:'search'};
export const activeSection=page=>({story:'create',product:'gallery',face:'gallery',exhibit:'gallery',palette:'library',search:'library',ar:'create',guide:'create',game:'library',collaborate:'profile',about:'profile'})[page]||page;

