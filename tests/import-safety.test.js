import test from 'node:test';
import assert from 'node:assert/strict';
import {assertInputSize, assertTableSize, readDelimitedRecords, missingNumber} from '../js/import-safety.js';
test('interactive byte and cell bounds reject large inputs', () => {
  assert.doesNotThrow(()=>assertInputSize(2*1024*1024));
  assert.throws(()=>assertInputSize(2*1024*1024+1), /2 MB/);
  assert.throws(()=>assertInputSize('🙂'.repeat(600000)), /2 MB/);
  assert.throws(()=>assertTableSize(5001,2), /5,000/);
  assert.throws(()=>assertTableSize(3000,40), /100,000/);
});
test('quoted records preserve commas, escaped quotes, BOM and embedded newlines', () => {
  const {records} = readDelimitedRecords('\uFEFFlabel,value\r\n"A, B",2\r\n"A\nB",3\r\n"He said ""yes""",4');
  assert.deepEqual(records, [['label','value'],['A, B','2'],['A\nB','3'],['He said "yes"','4']]);
});
test('malformed quoted records are rejected',()=>{
  assert.throws(()=>readDelimitedRecords('a,b\n"open,2'),/Unclosed/);
  assert.throws(()=>readDelimitedRecords('a,b\n"closed"oops,2'),/Unexpected/);
});
test('missing values are never converted to observed zero',()=>{
  for (const x of [null,undefined,'',' ','NA','null',false,{}]) assert.ok(Number.isNaN(missingNumber(x)));
  assert.equal(missingNumber('0'),0);
  assert.equal(missingNumber('-12.5'),-12.5);
});
import {parseDelimitedText} from '../js/exporters.js';
test('Forecast CSV rejects duplicate columns and partial parses',()=>{
  for (const csv of ['t,y,p,p\na,1,2,3\nb,2,3,4\nc,3,4,5','t,y\na,1\nb,2\nc,3\nd,wrong','t,y\na,1\nb,2\nc,3\n"open,4']) assert.equal(parseDelimitedText(csv).valid,false);
});
test('Forecast CSV keeps missing predictors out of observed values',()=>{
  const result=parseDelimitedText('t,y,p\na,1,\nb,2,0\nc,3,4');
  assert.equal(result.valid,true);assert.equal(result.observations[0].predictors.p,undefined);assert.equal(result.observations[1].predictors.p,0);
});
