import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStrict } from '../src/strict-json.mjs';
test('raw editor duplicate, escaped-key and case-alias rejection precedes parsing',()=>{
 for(const text of ['{"id":1,"id":2}','{"id":1,"ID":2}','{"spec":1,"ſpec":2}','{"nested":{"id":1,"i\\u0064":2}}']) assert.throws(()=>parseStrict(text),/ambiguous/);
 assert.deepEqual(parseStrict('{"a":[1,{"b":"comma,:{}"}],"c":null}'),{a:[1,{b:'comma,:{}'}],c:null});
});
