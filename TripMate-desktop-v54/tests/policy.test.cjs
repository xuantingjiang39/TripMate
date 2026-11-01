'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {isWorkspaceURL,isShellURL,externalURL,failureMessage} = require('../src/policy.cjs');
test('workspace accepts only exact HTTPS origin and no credentials',()=>{
  for(const url of ['https://111.230.133.155/','https://111.230.133.155/api/health']) assert.equal(isWorkspaceURL(url),true);
  for(const url of ['http://111.230.133.155/','https://111.230.133.155.evil.test/','https://111.230.133.155:8443/','https://x@111.230.133.155/','file:///C:/Windows/','javascript:alert(1)','bad']) assert.equal(isWorkspaceURL(url),false,url);
});
test('shell IPC accepts exact local shell only',()=>{
  assert.equal(isShellURL('tripmate-desktop://app/index.html'),true);
  for(const url of ['https://111.230.133.155/','tripmate-desktop://other/index.html','tripmate-desktop://app/shell.js','file:///index.html']) assert.equal(isShellURL(url),false);
});
test('external links reject executable protocols and credentials, upgrade HTTP',()=>{
  assert.equal(externalURL('https://m.meituan.com/hotel/12'),'https://m.meituan.com/hotel/12');
  assert.equal(externalURL('http://dpurl.cn/example'),'https://dpurl.cn/example');
  for(const url of ['file:///C:/a.exe','cmd.exe /c calc','javascript:alert(1)','data:text/html,bad','intent://something','https://user:pass@example.com/']) assert.equal(externalURL(url),null);
});
test('errors offer recovery without suggesting TLS bypass',()=>{
  assert.match(failureMessage(-202),/证书/);assert.match(failureMessage(-106),/联网/);assert.match(failureMessage(-118),/超时/);
});
