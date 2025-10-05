import {twoline2satrec, propagate} from "satellite.js"
import type { TLE } from "./types"
/// <reference lib="webworker" />
/* eslint-env worker */
type InitMsg = {type:"init"; tles:TLE[]};
type TickMsg = {type:"tick"; timeUTC:number};
type OutReady = {type:"ready";total:number; groups:[string, number][]};
type OutFrame = {type:"frame"; timeUTC:number;ids:Uint32Array; types:Uint8Array;positions:Float32Array;};
const satrecs: any[] = [];
let ids: number[] = [];
let types: number[] = [];
const groupsCodes = new Map<string, number>();
function groupCode(g:string) {
    if(!groupsCodes.has(g)) groupsCodes.set(g, groupsCodes.size);
    return groupsCodes.get(g)!;}
self.onmessage = (e:MessageEvent<InitMsg | TickMsg>) => {
    const msg = e.data;
    if(msg.type === 'init') {
        satrecs.length = 0;
        ids = [];
        types = [];
        groupsCodes.clear();
        for(const t of msg.tles) {
            try {
                const rec = twoline2satrec(t.line1, t.line2);
                satrecs.push(rec);
                ids.push(t.noraId);
                types.push(groupCode(t.group));

            }
            catch(e) {
                console.error(e);
            }
        }
        self.postMessage({type:"ready", total:satrecs.length, groups:[...groupsCodes.entries()]} as OutReady);
        return;

    }
    if(msg.type === "tick") {
        const date = new Date(msg.timeUTC);
        const n = satrecs.length;
        const positions = new Float32Array(3 * n);
        const outIds = new Uint32Array(n);
        const outTypes = new Uint8Array(n);
        for(let i = 0; i < n; i++) {
            const pv = propagate(satrecs[i], date)
            const p = pv?.position;
            const off = i * 3;
           if(p) {
            positions[off] = p.x;
            positions[off + 1] = p.y;
            positions[off + 2] = p.z;

           }
           else {
            positions[off] = positions[off + 1] = positions[off + 2] = NaN;

           }
           outIds[i] = ids[i];
           outTypes[i] = types[i];
        }
        self.postMessage({type:"frame", timeUTC:msg.timeUTC, ids:outIds, types:outTypes, positions} as OutFrame);
    }
};
