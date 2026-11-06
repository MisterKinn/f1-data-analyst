// Maps GT-class team names to their logo asset ids.
export function gtTeamLogoFor(series,category,row){
 if(!['wec','imsa','elms','alms'].includes(series)||!/gtd|lmgt3|gt3/i.test(category)||/manufacturer|marque|constructor/i.test(category))return null;
 const driver=/driver/i.test(category);
 const name=[row.team,driver?'':row.name].filter(v=>typeof v==='string').join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const mappings=[['gt-afcorse',/\baf\s*corse\b/],['gt-ao',/\bao\s*racing\b/],['gt-manthey',/\bmanthey\b/],['gt-wrt',/\bwrt\b/],['gt-united',/\bunited\s*autosports\b/],['gt-proton',/\bproton\b/],['gt-tfsport',/\btf\s*sport\b/],['gt-akkodis',/\bakkodis\b|\basp\s*team\b/],['gt-prattmiller',/pratt\s*miller|corvette\s*racing/],['gt-getspeed',/get\s*speed/],['gt-heartofracing',/heart\s*of\s*racing/],['gt-lonestar',/lone\s*star\s*racing/],['gt-paulmiller',/paul\s*miller/],['gt-turner',/turner\s*motorsport/]];
 return mappings.find(([,pattern])=>pattern.test(name))?.[0]??null;
}
