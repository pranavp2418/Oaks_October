import{test}from'node:test';import assert from'node:assert/strict';import{toolSchemas}from'../server/agent.mjs';
test('model-facing budget contract is an actual bounded JSON array schema',()=>{
 const budget=toolSchemas.find(t=>t.name==='compare_budgets').parameters.properties.budgets;
 assert.equal(budget.type,'array');assert.equal(budget.items.type,'integer');assert.equal(budget.maxItems,3);
 assert.deepEqual(toolSchemas.find(t=>t.name==='compare_budgets').example.arguments.budgets,[20,42]);
});
