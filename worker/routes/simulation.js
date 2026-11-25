import {liveEnergyLimit} from '../lapsim/live-energy.js';
import {simulationFirstView} from '../simulation-cache.js';
import {chooseLanguage} from '../localization.js';

// /simulation: the live energy limit, then the stored first view for exactly that page (first-view job, stage 4)
export async function simulationStart(request){
 const q=new URL(request.url).searchParams,lapsimEnergy=await liveEnergyLimit(q.get('track')||'monza').catch(()=>null);
 const lapsimFirstView=await simulationFirstView({track:q.get('track'),car:q.get('car'),evo:q.get('evo')},chooseLanguage(request),lapsimEnergy).catch(()=>null);
 return {lapsimEnergy,lapsimFirstView};
}
