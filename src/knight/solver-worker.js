import {solve} from './engine.js';
self.onmessage=({data})=>{try{self.postMessage({...solve(data.stage,data.path),request:data.request});}catch{self.postMessage({state:'error',path:[],request:data.request});}};
