import {existsSync,readdirSync,lstatSync,unlinkSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),target=resolve(root,'dist'),files=[];
if(!target.startsWith(resolve(root)+sep))throw new Error('Build output outside project');
function collect(dir){if(lstatSync(dir).isSymbolicLink())throw new Error('Refusing linked build output');for(const item of readdirSync(dir,{withFileTypes:true})){const path=resolve(dir,item.name);if(!path.startsWith(target+sep))throw new Error('Unexpected build path');if(item.isSymbolicLink())throw new Error('Refusing linked build entry');if(item.isDirectory())collect(path);else if(/\.(?:js|d\.ts|map)$/.test(item.name))files.push(path);else throw new Error('Unexpected non-compiler file in dist; preserve/review it before building: '+path);}}
if(existsSync(target)){collect(target);for(const file of files)unlinkSync(file);}
