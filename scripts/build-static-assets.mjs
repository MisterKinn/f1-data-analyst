import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {websiteRoute,staticAssetPaths} from '../worker/website.js';

// Only explicitly public assets enter Vercel's output directory. The Sites
// worker bundle and hosting metadata must never become downloadable files.
export async function buildStaticAssets(root='dist/public'){
 const manifest=[];
 for(const path of staticAssetPaths()){
  const response=websiteRoute(new Request('https://build.invalid'+path));
  if(!response||response.status!==200)throw Error('Missing static asset: '+path);
  const body=Buffer.from(await response.arrayBuffer()),target=resolve(root,'.'+path);
  if(!target.startsWith(resolve(root)+'/'))throw Error('Invalid asset path');
  await mkdir(dirname(target),{recursive:true});await writeFile(target,body);
  manifest.push({path,bytes:body.length,sha256:createHash('sha256').update(body).digest('hex'),contentType:response.headers.get('content-type')});
 }
 await mkdir('dist',{recursive:true});
 await writeFile('dist/static-assets.json',JSON.stringify(manifest,null,2)+'\n');
 return manifest;
}
