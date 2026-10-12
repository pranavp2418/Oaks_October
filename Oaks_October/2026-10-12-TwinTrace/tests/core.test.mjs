import test from 'node:test';import assert from 'node:assert/strict';import {sample,towers,train,embeddings,rank,bruteRank,recallAtK,hardNegatives,weightDigest,USERS,ITEMS} from '../src/core.js';
test('synthetic schema and pairing bounds',()=>{const d=sample();assert.equal(d.users.length,USERS);assert.equal(d.items.length,ITEMS);assert.equal(d.pairs.length,36);assert.ok(d.pairs.every(([u,i])=>u<USERS&&i<ITEMS))});
test('tower training runs and returns finite losses',async()=>{const d=sample(),m=towers();const h=await train(m,d,3);assert.equal(h.length,3);assert.ok(h.every(Number.isFinite))});
test('embeddings have expected dimensions',()=>{const d=sample(),e=embeddings(towers(),d);assert.deepEqual([e.users.length,e.users[0].length],[USERS,4]);assert.deepEqual([e.items.length,e.items[0].length],[ITEMS,4])});
test('ranking matches independent brute force for all users',()=>{const d=sample(),e=embeddings(towers(),d);for(let u=0;u<USERS;u++)assert.deepEqual(rank(e,u,7),bruteRank(e,u,7))});
test('counterfactual exclusion removes group',()=>{const d=sample(),e=embeddings(towers(),d);for(let u=0;u<USERS;u++)assert.ok(rank(e,u,10,u%3).every(x=>Math.floor(x.id/6)!==u%3))});
test('recall and hard negatives are bounded',()=>{const d=sample(),e=embeddings(towers(),d),r=recallAtK(e,d);assert.ok(r>=0&&r<=1);const h=hardNegatives(e,d);assert.equal(h.length,USERS);assert.ok(h.every(x=>x>=0&&x<ITEMS))});
test('identical seeded towers have identical digest',async()=>assert.equal(await weightDigest(towers()),await weightDigest(towers())));
