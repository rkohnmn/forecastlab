import test from 'node:test';
import assert from 'node:assert/strict';
import {parseObservationJSON} from '../js/import-validation.js';

const rows = [0, 2, 4].map((value, i) => ({timestamp: `2026-0${i + 1}`, value}));
test('observation imports preserve zero, normalize numeric strings, and retain predictors', () => {
  const source = {metadata:{title:'Example'}, observations: rows.map(o => ({...o, value:String(o.value), predictors:{price:'12.5', missing:null}}))};
  const parsed = parseObservationJSON(JSON.stringify(source));
  assert.deepEqual(parsed.observations.map(o=>o.value), [0,2,4]);
  assert.deepEqual(parsed.observations[0].predictors, {price:12.5, missing:null});
  assert.equal(parsed.metadata.hasPredictors,true);
  assert.deepEqual(parsed.metadata.predictorNames,['price','missing']);
});
test('observation imports accept aliases and explicit missing values', () => {
  const observations = [...rows.map(o=>({label:o.timestamp, observed_y:o.value})), {label:'2026-04', value:null}];
  const parsed = parseObservationJSON(JSON.stringify({observations}));
  assert.equal(parsed.observations[0].timestamp,'2026-01');
  assert.equal(parsed.observations[3].value,null);
});
for (const [name, source] of [
  ['invalid JSON','{'], ['null','null'], ['empty observations','{"observations":[]}'],
  ['forecast result','{"forecasts":[1,2,3]}'],
  ['null row',JSON.stringify({observations:[...rows,null]})],
  ['boolean value',JSON.stringify({observations:[...rows,{value:true}]})],
  ['non-finite value',JSON.stringify({observations:[...rows,{value:'Infinity'}]})],
  ['invalid timestamp',JSON.stringify({observations:[...rows,{value:1,timestamp:{}}]})],
  ['invalid predictors',JSON.stringify({observations:[...rows,{value:1,predictors:[]}]})],
  ['all missing',JSON.stringify({observations:[{value:null},{value:''},{value:' '}]})]
]) test(`observation imports reject ${name}`,()=>assert.throws(()=>parseObservationJSON(source)));
