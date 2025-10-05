import type { TLE } from "./types";
import * as THREE from "three"
import OrbitsWorker from "./orbits.worker.ts?worker"
export function parseTLE(text:string, group:string) : TLE[] {
    const lines = text.trim().split(/\r?\n/);
    const out:TLE[] = [];
    for(let i = 0; i <lines.length; i+=3) {
        const name = lines[i]?.trim();
        const l1 = lines[i + 1]?.trim();
        const l2 = lines[i + 2]?.trim();
        if(!name || !l1?.startsWith("1 ") || !l2?.startsWith("2 ")) continue;
        const noraId = Number(l1.slice(2, 7));
        out.push({name, noraId, line1:l1, line2:l2, group});
    }
    return out;
}
const CELESTRAK = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle";
export function urlForGroup(group : string) {
    return `${CELESTRAK}?GROUP=${encodeURIComponent(group)}&FORMAT=TLE`;
}
export const DEFAULT_GROUPS = [
    "active",
    "debris",
    "rocket-bodies",
    "starlink",
];
async function fetchWithTimeout(url:string, ms = 15000, signal?:AbortSignal) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort("timeout"), ms);
    try {
        const res = await fetch(url, {signal: signal ?? ctrl.signal, mode:"cors"});
        return res;
    }
    finally {
        clearTimeout(id);
    }
}
function cacheKey(group:string) {return `tle:${group}`;}
function saveCache(group:string, text:string) {
    try {
        localStorage.setItem(cacheKey(group), JSON.stringify({ts:Date.now(), text}));
    }
    catch (e) {
        console.error(e);
    }
}
function loadCache(group:string, maxAgeMs:number) : string | null {
    try {
        const raw = localStorage.getItem(cacheKey(group));
        if(!raw) return null;
        const {ts, text} = JSON.parse(raw);
        if(Date.now() - ts > maxAgeMs) return null;
        return text;
    } catch{return null;}
}
export async function fetchTLEGroup(group:string, opts?:{maxAgeMs?:number}) {
    const MaxAgeMs = opts?.maxAgeMs ?? 60 * 60  * 1000;
    const url = urlForGroup(group);
    try {
        const res = await fetchWithTimeout(url, 15000);
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if(!text?.trim()) throw new Error(`Empty TLE`);
        saveCache(group, text);
        return parseTLE(text, group);
    }
    catch(e) {
        console.warn(`[tle] network failed for ${group}`, e);
        const cached = loadCache(group, MaxAgeMs);
        if(cached) {
            console.warn(`[tle] using cached ${group}`);
            return parseTLE(cached, group);
        }
        throw new Error(`No data for group ${group}`);


    }
    
}
export async function fetchTLEGroups(groups:string[], maxAgeMs?:number) : Promise <TLE[]> {
    const res = await Promise.allSettled(groups.map(g => fetchTLEGroup(g, {maxAgeMs})));
    const all:TLE[] = [];
    for(const r of res) {
        if(r.status === 'fulfilled') all.push(...r.value);
        else console.warn("[tle] skip group:", r);

    }
    const seen = new Set<number>();
    return all.filter(t => (seen.has(t.noraId) ? false : (seen.add(t.noraId), true)));
}
export function downSampleByGroup(tles:TLE[], max = 50000) : TLE[] {
    if(tles.length <= max) return tles;
    const byGroup = new Map<string, TLE[]>();
    for(const t of tles) {
        if(!byGroup.has(t.group)) byGroup.set(t.group, []);
        byGroup.get(t.group)!.push(t);
    }
    const order = ["active", "starlink", "rocket-bodies", "debris"];
    const out:TLE[] = [];
    let budget = max;
    for(const g of order) {
        const arr = byGroup.get(g) ?? [];
        if(arr.length <= budget) {out.push(...arr);budget -= arr.length;}
        else {
            const keep = Math.max(0, budget);
            for(let i = 0; i < keep; i++) {
                const idx = Math.floor((i * arr.length) / keep);
                out.push(arr[idx]);
            }
            budget = 0;
        }
    }
    if(budget > 0) {
        for(const [g, arr] of byGroup) {
            if(order.includes(g)) continue;
            if(arr.length <= budget) {
                out.push(...arr);
                budget -= arr.length;
            }
            else {
                for(let i = 0; i < budget; i++) {
                    const idx = Math.floor((i * arr.length) / budget);
                    out.push(arr[idx]);
                }
                budget = 0;
                break;
            }
        }
    }
return out;
}
export const WORLD_UNITS_PER_KM = 5 / 6371;
export type OrbitsOnlineOpts = {
    groups?:string[];
    maxObjects?:number;
    refreshMs?:number;
    tickMs?:number;
};
export function createOrbitsOnlineLayer(scene:THREE.Scene, opts:OrbitsOnlineOpts = {}) {
    const groups = opts.groups ?? DEFAULT_GROUPS;
    const MAX = opts.maxObjects ?? 50000;
    const REFRESH_MS = opts.refreshMs ?? 3 * 60 * 60 * 1000;
    const TICK_MS = opts.tickMs ?? 250;
    const geom = new THREE.BufferGeometry();
    const pos =  new Float32Array(MAX * 3);
    const col = new Float32Array(MAX * 3);
    geom.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geom.setAttribute("color", new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    geom.setDrawRange(0,0);
    const mat = new THREE.ShaderMaterial({
        transparent:true,
        depthWrite:false,
        vertexColors:true,
        uniforms: {
            uSize:{value:2.0},
            uPixelRatio:{value: Math.min(window.devicePixelRatio, 2)},

        },
        vertexShader: `
        varying vec3 vColor;
        uniform float uSize;
        uniform float uPixelRatio;
        void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = uSize * uPixelRatio * (300.0 / -mvPosition.z);
        gl_PointSize = clamp(gl_PointSize, 1.0, 16.0);
        }
        `,
        fragmentShader: `
        precision mediump float;
        varying vec3 vColor;
        void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float alpha = smoothstep(0.5, 0.45, d);
        if(alpha <= 0.0) discard;
        gl_FragColor = vec4(vColor, alpha);
        }
        `
    });
    const points = new THREE.Points(geom, mat);
    points.renderOrder = 2;
    scene.add(points);
    const defaultColor = new THREE.Color('#aaaaaa');
    let codeToColor:THREE.Color[] = [];
    const worker = new OrbitsWorker();
    let tickTimer: number | null = null;
    let refreshTimer: number | null = null;
     worker.onmessage = (e: MessageEvent<any>) => {
        const msg = e.data;
        if(msg.type === "ready") {
            return;
        }
        if(msg.type === "frame") {
            const positions:Float32Array = msg.positions;
            const types: Uint8Array = msg.types;
            const n = types.length;
            lastIds = msg.ids;
            lastTypes = msg.types;
            lastPositionsKm = msg.positions;
            lastCount = n;
            for(let i = 0; i < n; i++) {
                const off = i * 3;
                pos[off + 0] = positions[off + 0] * WORLD_UNITS_PER_KM;
                pos[off + 1] = positions[off + 1] * WORLD_UNITS_PER_KM;
                pos[off + 2] = positions[off + 2] * WORLD_UNITS_PER_KM;
                const c = codeToColor[types[i]] ?? defaultColor;
                col[off+0] = c.r;
                col[off + 1] = c.g;
                col[off + 2] = c.b;
            }
            geom.setDrawRange(0, n);
            (geom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
            (geom.attributes.color as THREE.BufferAttribute).needsUpdate = true;
        }
    };
    const tleById = new Map<number, TLE>();
    let lastIds: Uint32Array | null = null;
    let lastTypes: Uint8Array | null = null;
    let lastPositionsKm:Float32Array | null = null;
    let lastCount = 0;
   
    async function loadAndInit() {
        console.log("[orbits] fetching TLE groups:", groups.join(", "));
        const tlesRaw = await fetchTLEGroups(groups, 60 * 60 * 1000);
        const tles = downSampleByGroup(tlesRaw, MAX);
        console.log("[orbits] tles:", tlesRaw.length, "→ after downsample:", tles.length);
        worker.postMessage({type:"init", tles});
        tleById.clear();
        tles.forEach(t => {
            tleById.set(t.noraId, t);
        });
        worker.postMessage({type:"init", tles});
    }
    function getFrame() {
        return {
            count:lastCount,
            ids:lastIds,
            types:lastTypes,
            positionsKm:lastPositionsKm,
        };
    }
    function getTleById(id:number) {return tleById.get(id) || null;}
    async function boot() {
        await loadAndInit();
        tickTimer = window.setInterval(() => {
            const simTimeUTC = Date.now();
            worker.postMessage({type:"tick", timeUTC:simTimeUTC});

        },TICK_MS);
        refreshTimer = window.setInterval(async() => {
            try {
                await loadAndInit();

            } catch(e) {
                console.warn("[orbits] refresh failed", e);

            }
        }, REFRESH_MS);
        
    }   
    function dispose() {
        if(tickTimer) window.clearInterval(tickTimer);
        if(refreshTimer) window.clearInterval(refreshTimer);
        worker.terminate();
        scene.remove(points);
        geom.dispose();
        (mat as THREE.Material).dispose();

    }
    return {points, boot, dispose, getFrame, getTleById};
}
