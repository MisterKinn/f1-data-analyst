// Official class allocation evidence. Never infer a round's selection from the product range.
const partnerSource='https://www.fiawec.com/en/news/tyre-partners/8259';
const barcelonaSource='https://www.fiawec.com/en/news/michelin-prepared-for-hardest-race-of-the-year/13875';
export function wecTyreAllocations(event){
 if(event.series!=='wec')return null;
 const year=Number(event.start.slice(0,4)),barcelona=year===2026&&event.circuit==='barcelona';
 return [
  {category:'Hypercar',supplier:'Michelin',status:barcelona?'confirmed':'unverified',compounds:barcelona?['Soft','Medium','Wet']:[],source:barcelona?barcelonaSource:null,checkedAt:'2026-10-31'},
  {category:'LMGT3',supplier:'Goodyear',status:year===2026?'confirmed':'unverified',compounds:year===2026?['Medium','Wet']:[],source:year===2026?partnerSource:null,checkedAt:'2026-10-31'}
 ];
}
