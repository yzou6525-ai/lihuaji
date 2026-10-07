const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const modulePath = path.resolve(__dirname, '../web/shop-links.js');
const moduleReady = import('data:text/javascript;base64,' + fs.readFileSync(modulePath).toString('base64'));
const original = () => ({active: true, external_id: '1082079045031', source: {
  source_status: '在售', external_url: 'https://item.taobao.com/item.htm?id=1082079045031'
}});

test('only an active original listing with the matching numeric product ID is accepted', async () => {
  const {taobaoProductUrl} = await moduleReady;
  const p = original();
  assert.equal(taobaoProductUrl(p), p.source.external_url);
  for (const active of [false, undefined, 1, 'true']) assert.equal(taobaoProductUrl({...p, active}), '');
  for (const status of ['仓库中', '', undefined]) assert.equal(taobaoProductUrl({...p, source: {...p.source, source_status: status}}), '');
  for (const external_id of ['', undefined, 1082079045031, '1082079045031\n', '<script>', '１２３']) {
    assert.equal(taobaoProductUrl({...p, external_id}), '');
  }
  for (const missing of [null, undefined, {}, {...p, source: null}]) assert.equal(taobaoProductUrl(missing), '');
});

test('reject schemes, redirect parameters, userinfo, lookalike hosts and escaped URL forms', async () => {
  const {taobaoProductUrl} = await moduleReady;
  const p = original();
  for (const external_url of [
    'http://item.taobao.com/item.htm?id=1082079045031',
    '//item.taobao.com/item.htm?id=1082079045031',
    'javascript:alert(1)',
    'https://item.taobao.com.attacker.example/item.htm?id=1082079045031',
    'https://item.taobao.com@attacker.example/item.htm?id=1082079045031',
    'https://attacker.example@item.taobao.com/item.htm?id=1082079045031',
    'https://item.taobao.com:443/item.htm?id=1082079045031',
    'https://item.taobao.com/item.htm?id=1082079045031&redirect=https://attacker.example',
    'https://item.taobao.com/item.htm?id=1082079045031&id=1',
    'https://item.taobao.com/item.htm?id=1082079045031#extra',
    'https://item.taobao.com/item.htm?id=%31%30%38%32%30%37%39%30%34%35%30%33%31',
    'https://item.taobao.com/item.htm?id=1058430287511',
    p.source.external_url + '\n',
    p.source.external_url + '" onclick="alert(1)',
    ' ' + p.source.external_url, null, undefined
  ]) assert.equal(taobaoProductUrl({...p, source: {...p.source, external_url}}), '', String(external_url));
});
