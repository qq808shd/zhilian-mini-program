const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup() {
  let definition, route='pages/study/index', pending, calls=0, toasts=0;
  const wx={switchTab:options=>{pending=options;calls++;},showToast:()=>{toasts++;}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../miniprogram/custom-tab-bar/index.js'),'utf8'),{Component:v=>definition=v,getCurrentPages:()=>[{route}],wx});
  const component={...definition.methods,data:structuredClone(definition.data),setData(v){Object.assign(this.data,v);}};
  return {component,definition,get calls(){return calls;},get toasts(){return toasts;},get pending(){return pending;},route:v=>{route=v;}};
}
const event=index=>({currentTarget:{dataset:{index}}});
test('all four tabs follow actual routes after direct entry, cached return and successful switch',()=>{
  const f=setup(),c=f.component;
  for(const [index,tab] of c.data.tabs.entries()) {f.route(tab.route);f.definition.pageLifetimes.show.call(c);assert.equal(c.data.selected,index);}
  f.route('pages/study/index');c.refresh();c.onTab(event(1));assert.equal(f.pending.url,'/pages/exam/index');assert.equal(c.data.selected,0);
  f.route('pages/exam/index');f.pending.success();f.pending.complete();assert.equal(c.data.selected,1);
});
test('repeated, invalid and failed tab switches do not show a false selected page',()=>{
  const f=setup(),c=f.component;c.onTab(event(0));c.onTab(event(9));assert.equal(f.calls,0);
  c.onTab(event(2));c.onTab(event(3));assert.equal(f.calls,1);f.pending.fail();f.pending.complete();assert.equal(c.data.selected,0);assert.equal(f.toasts,1);
  c.onTab(event(3));assert.equal(f.calls,2);assert.equal(f.pending.url,'/pages/me/index');
});
