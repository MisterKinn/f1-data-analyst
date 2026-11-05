// Stable gateway tools. MCP clients (claude.ai, ChatGPT) cache a connector's tool list and
// do not reliably re-fetch it after a deploy or on notifications/tools/list_changed. These two
// tools never change name or schema, so once a client has them it can reach every tool the
// server offers now or later, without anyone reconnecting the connector.
export const GATEWAY_LIST='kongboda_tools',GATEWAY_CALL='kongboda_call';
const ro={readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true};
export const GATEWAY_TOOLS=[
 {name:GATEWAY_LIST,description:'Live list of every Kongboda Motorsports tool on the server right now, with descriptions and input schemas. Your client may hold an older copy of this connector’s tool list. Call this whenever a tool you need, or one named in an answer, instruction or error, is missing from your list, then run it with kongboda_call.',
  inputSchema:{type:'object',properties:{query:{type:'string',maxLength:60,description:'Optional word to filter tool names and descriptions, e.g. openf1 or telemetry.'}},additionalProperties:false},annotations:ro},
 {name:GATEWAY_CALL,description:'Run any current read-only Kongboda Motorsports tool by name, including tools added after your client loaded this connector. Same login, permissions and argument validation as calling the tool directly. Get the name and argument schema from kongboda_tools.',
  inputSchema:{type:'object',properties:{name:{type:'string',pattern:'^[a-z0-9_]{1,64}$'},arguments:{type:'object'}},required:['name'],additionalProperties:false},annotations:ro}
];
// Only read-only tools run through the gateway; tools that change data stay direct calls.
export const callableThroughGateway=tool=>!!tool&&tool.annotations?.readOnlyHint===true&&![GATEWAY_LIST,GATEWAY_CALL].includes(tool.name);
export function gatewayList(tools,query){
 const q=String(query||'').toLowerCase();
 const rows=tools.filter(t=>![GATEWAY_LIST,GATEWAY_CALL].includes(t.name)).filter(t=>!q||t.name.includes(q)||String(t.description||'').toLowerCase().includes(q));
 return {tools:rows.map(t=>({name:t.name,description:t.description,inputSchema:t.inputSchema,read_only:t.annotations?.readOnlyHint===true,run_with:callableThroughGateway(t)?'kongboda_call':'direct call only'})),
  how_to_call:'kongboda_call {"name":"<tool name>","arguments":{...}}. If the tool is already in your own list you can also call it directly.'};
}
export const UNKNOWN_TOOL=name=>`"${String(name).slice(0,64)}" is not a current Kongboda tool (it may have been renamed or removed). Call kongboda_tools for the current list and run tools with kongboda_call.`;
