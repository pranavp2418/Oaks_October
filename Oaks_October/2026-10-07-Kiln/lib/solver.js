import fs from 'node:fs';import {fileURLToPath} from 'node:url';import fengari from 'fengari';
const {lua,lauxlib,lualib,to_luastring,to_jsstring}=fengari;
const source=fs.readFileSync(fileURLToPath(new URL('../core/solver.lua',import.meta.url)),'utf8');
const integer=(x,min,max)=>Number.isInteger(x)&&x>=min&&x<=max;
export function validate(input){
 if(!input||!Array.isArray(input.jobs)||input.jobs.length<1||input.jobs.length>9)throw Error('Provide 1–9 jobs');
 const jobs=input.jobs.map(j=>({...j,predecessors:j.predecessors??[]}));const ids=new Set();
 for(const j of jobs){if(!/^[A-Za-z0-9_-]{1,30}$/.test(j.id??'')||typeof j.id!=='string'||ids.has(j.id)||typeof j.family!=='string'||!/^[A-Za-z0-9_-]{1,20}$/.test(j.family))throw Error('IDs/families must be unique safe identifiers');ids.add(j.id);if(!integer(j.duration,1,200)||!integer(j.release,0,1000)||!integer(j.due,0,2000)||!integer(j.weight,1,100)||!Array.isArray(j.predecessors))throw Error('Invalid duration/release/due/weight/precedence')}
 for(const j of jobs)if(j.predecessors.some(x=>!ids.has(x)||x===j.id)||new Set(j.predecessors).size!==j.predecessors.length)throw Error('Unknown, duplicate or self predecessor');
 const visited=new Set(),active=new Set(),map=new Map(jobs.map(j=>[j.id,j]));function dfs(id){if(active.has(id))throw Error('Precedence cycle');if(visited.has(id))return;active.add(id);for(const x of map.get(id).predecessors)dfs(x);active.delete(id);visited.add(id)}for(const j of jobs)dfs(j.id);
 const setup=input.setup??3,budget=input.budget??30000;if(!integer(setup,0,100)||!integer(budget,1,100000))throw Error('Invalid setup or search budget');return {jobs,setup,budget}
}
function literal(x){if(Array.isArray(x))return '{'+x.map(literal).join(',')+'}';if(x&&typeof x==='object')return '{'+Object.entries(x).map(([k,v])=>k+'='+literal(v)).join(',')+'}';if(typeof x==='string')return JSON.stringify(x);return String(x)}
export function solve(input){const valid=validate(input),L=lauxlib.luaL_newstate();try{lualib.luaL_openlibs(L);const code='INPUT='+literal(valid)+'\n'+source;if(lauxlib.luaL_loadstring(L,to_luastring(code))!==lua.LUA_OK||lua.lua_pcall(L,0,1,0)!==lua.LUA_OK)throw Error(to_jsstring(lua.lua_tostring(L,-1)));return JSON.parse(to_jsstring(lua.lua_tostring(L,-1)))}finally{lua.lua_close(L)}}
