import test from 'node:test';import assert from 'node:assert/strict';
import {externalMcpAccount} from '../worker/external-mcp.js';
test('caller-provided identity and Claude labels never authenticate external MCP',async()=>{const r=new Request('https://example.test/api/mcp',{headers:{'oai-authenticated-user-id':'owner','user-agent':'Claude'}});assert.equal(await externalMcpAccount(r,{BUCKET:{get:async()=>null}}),null);});
