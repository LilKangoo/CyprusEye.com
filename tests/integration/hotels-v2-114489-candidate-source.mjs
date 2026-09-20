import assert from 'node:assert/strict';
import {mask} from './hotels-v2-114488-read-compiler.mjs';

// Parse only the requested CREATE declaration. Masking keeps offsets while
// excluding keywords embedded in comments, configuration literals and bodies.
export function candidateSource(sql,name){
 const code=mask(sql);
 const marker=`CREATE FUNCTION ${name}(`;
 const start=code.indexOf(marker);
 assert.ok(start>=0,`${name} CREATE missing`);
 assert.equal(code.indexOf(marker,start+marker.length),-1,`${name} CREATE duplicate`);
 const tail=code.slice(start);
 const end=tail.indexOf(';');
 assert.ok(end>=0,`${name} declaration terminator missing`);
 const declaration=tail.slice(0,end);
 assert.doesNotMatch(declaration.slice(marker.length),/\bCREATE\s+FUNCTION\b/i);
 const matches=[...declaration.matchAll(/\bAS\b/gi)];
 assert.equal(matches.length,1,`${name} exact declaration AS missing/ambiguous`);
 const literal=sql.slice(start+matches[0].index+2,start+end).trim();
 const single=/^'((?:''|[^'])*)'$/.exec(literal);
 if(single)return single[1].replaceAll("''","'");
 const dollar=/^(\$\w*\$)([\s\S]*)\1$/.exec(literal);
 assert.ok(dollar,`${name} unsupported/malformed body literal`);
 return dollar[2];
}
