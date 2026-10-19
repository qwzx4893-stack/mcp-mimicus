import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { NetworkPolicy,GuardedProxy } from '../dist/security/network.js';
import { ConfigSchema } from '../dist/config.js';
import { robotsAllowed } from '../dist/security/robots.js';
import { fixture,config,temporary,cleanup } from './helpers.mjs';

test('I: rejects unsafe schemes, credentials, IPv4/IPv6 private and mixed DNS answers',async()=>{
  const unsafe=['127.0.0.1','10.0.0.1','172.16.0.1','192.168.0.1','169.254.169.254','0.0.0.0','100.64.0.1','224.0.0.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1','2001:db8::1'];
  for(const address of unsafe){
    const cfg=ConfigSchema.parse({dataDir:'.',allowedOrigins:['https://public.example']});
    const p=new NetworkPolicy(cfg,async()=>[{address,family:address.includes(':')?6:4}]);
    await assert.rejects(()=>p.target('https://public.example/'),/Unsafe/);
  }
  const cfg=ConfigSchema.parse({dataDir:'.',allowedOrigins:['https://public.example']});
  const p=new NetworkPolicy(cfg,async()=>[{address:'93.184.216.34',family:4},{address:'127.0.0.1',family:4}]);
  await assert.rejects(()=>p.target('https://public.example/'));
  for(const url of ['file:///a','ftp://public.example','https://u:p@public.example','https://unapproved.example'])await assert.rejects(()=>p.target(url));
});

test('I: proxy pins validated DNS answer and rejects changed resolution, POST and unapproved redirect target',async()=>{
  const f=await fixture();const dir=temporary();const cfg=config(dir,f.origin);let lookups=0;
  const fakeOrigin=`http://fixture.test:${new URL(f.origin).port}`;
  const policy=new NetworkPolicy({...cfg,developmentOrigins:[fakeOrigin]},async()=>[{address:++lookups===1?'127.0.0.1':'169.254.169.254',family:4}]);
  const proxy=new GuardedProxy(policy);const proxyUrl=new URL(await proxy.start());
  const get=(path,method='GET')=>new Promise((ok,no)=>{const req=request({host:proxyUrl.hostname,port:proxyUrl.port,path,method},res=>{res.resume();res.on('end',()=>ok(res.statusCode));});req.on('error',no);req.end();});
  try{
    assert.equal(await get(fakeOrigin+'/'),200);assert.equal(lookups,1);
    assert.equal(await get(fakeOrigin+'/'),403);assert.equal(await get(fakeOrigin+'/','POST'),403);
    assert.equal(await get('http://169.254.169.254/'),403);assert.equal(f.hits.length,1);
  }finally{await proxy.close();await f.close();cleanup(dir);}
});

test('robots policy honors specific group, longest rule, wildcard and allow exceptions',()=>{
  const rules='User-agent: *\nDisallow: /private\nAllow: /private/public\nDisallow: /*.zip$';
  assert.equal(robotsAllowed(rules,'/private/a'),false);assert.equal(robotsAllowed(rules,'/private/public/a'),true);
  assert.equal(robotsAllowed(rules,'/test.zip'),false);assert.equal(robotsAllowed(rules,'/test.zip/a'),true);
  assert.equal(robotsAllowed('User-agent: *\nDisallow: /\nUser-agent: mcp-mimicus\nAllow: /','/ok'),true);
});
