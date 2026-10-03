import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const code=readFileSync(new URL('../../js/site-navigation.js',import.meta.url),'utf8');
const start=code.indexOf('        if (kind === "saved" && row.type === "poi")');
const end=code.indexOf('        if (row.unread)',start);
function click({ready=true, same=true, modifiers={}}={}) {
 const calls=[];
 const href='https://cypruseye.com/index.html?poi=agios-georgios-pegeia-site&lang=pl#map';
 let handler;
 const window={location:{href:same?href:'https://cypruseye.com/index.html?lang=pl'},history:{pushState:(...args)=>calls.push(['history',...args])},CE_HOME_MAP:{ready,openPoi:id=>calls.push(['open',id])}};
 vm.runInNewContext(code.slice(start,end),{kind:'saved',row:{type:'poi'},a:{href,addEventListener:(_,cb)=>handler=cb},window,URL,closePanel:()=>calls.push(['close'])});
 handler({button:0,preventDefault:()=>calls.push(['prevent']),...modifiers});
 return calls;
}
test('same URL still opens the saved point immediately without a reload or history duplicate',()=>{
 assert.deepEqual(click(),[['prevent'],['close'],['open','agios-georgios-pegeia-site']]);
});
test('new selection updates the URL after selecting the existing map',()=>{
 const calls=click({same:false});
 assert.deepEqual(calls.slice(0,3),[['prevent'],['close'],['open','agios-georgios-pegeia-site']]);
 assert.equal(calls[3][0],'history');
});
test('unready map and modified clicks retain standard link navigation',()=>{
 assert.deepEqual(click({ready:false}),[]);
 for(const key of ['ctrlKey','metaKey','shiftKey','altKey'])assert.deepEqual(click({modifiers:{[key]:true}}),[]);
});
