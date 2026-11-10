import{test}from'node:test';import assert from'node:assert/strict';
import{mkdtemp,readFile,rm}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';import{execFile}from'node:child_process';import{promisify}from'node:util';
test('actual exported previews retain valid inline JavaScript, including regex replacement tokens',async()=>{
 const out=await mkdtemp(join(tmpdir(),'kongboda-preview-test-'));
 try{
  await promisify(execFile)(process.execPath,['scripts/export-preview.mjs','--output',out]);
  const manifest=JSON.parse(await readFile(join(out,'manifest.json'),'utf8'));assert.equal(manifest.pages.length,32);
  for(const file of ['index.html','index.en.html']){
   const html=await readFile(join(out,file),'utf8');const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];assert.ok(scripts.length>=3);
   for(const [,source]of scripts)assert.doesNotThrow(()=>new Function(source));
  }
 }finally{await rm(out,{recursive:true,force:true});}
});
