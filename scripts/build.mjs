import {build} from 'esbuild';
import {mkdir,copyFile,readFile} from 'node:fs/promises';
let release=null;try{release=JSON.parse(await readFile('.openai/github-release.json','utf8'));if(!/^[0-9a-f]{40}$/.test(release.commit_sha))throw Error('Invalid release SHA');}catch(e){if(e.code!=='ENOENT')throw e;}
await mkdir('dist/server',{recursive:true});
await mkdir('dist/.openai',{recursive:true});
await build({entryPoints:['worker/index.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/server/index.js',legalComments:'inline',define:{__GITHUB_RELEASE__:JSON.stringify(release)}});
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Built dist/server/index.js');
