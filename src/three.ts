import * as THREE from "three"
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js"
import { createOrbitsOnlineLayer, DEFAULT_GROUPS, WORLD_UNITS_PER_KM } from "./orbit-online";
import { twoline2satrec,propagate } from "satellite.js";
export function createEarth(container:HTMLElement) {
THREE.Cache.enabled = true;
const scene = new THREE.Scene();
let simSpeed = 1;
let simEpochMs = Date.now();
let lastRealMs = performance.now();
let userLonDeg = 0;
let haveGeo = false;
const AXIAL_TILT = THREE.MathUtils.degToRad(23.44);
const LONGTITUDE_OFFSET_DEG = -90;
const camera =  new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(0,0,15);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 2;
scene.background = new THREE.Color(0x000000);
container.appendChild(renderer.domElement);
const loaderDiv = document.createElement('div');
loaderDiv.style.cssText =  `position:absolute;
inset:0;
display:flex;
align-items:center;
justify-content:center;
background:rgba(0,0,0,0.7);
color:#ffffff;
font:600 14px/1.4 system-ui;
z-index:99;`;
loaderDiv.textContent = 'Loading...0%';
container.appendChild(loaderDiv);
const hud = document.createElement('div');
hud.style.cssText = `position:absolute;top:25px;right:10px;z-index:10;display:flex;gap:12px;
align-items:center;background:rgba(0,0,0,0.55);color:#ffffff;padding:8px 10px;border-radius:8px;
font:12px/1.3 system-ui`;
container.appendChild(hud);
const timeDiv = document.createElement('div');
timeDiv.textContent = '-:-:-';
hud.appendChild(timeDiv);
const speedWrap = document.createElement('label');
speedWrap.style.display = 'flex';
speedWrap.style.alignItems = 'center';
speedWrap.style.gap = '6px';
speedWrap.title = 'Speed:';
speedWrap.innerHTML = `<span>Speed:</span>`;
hud.appendChild(speedWrap);
const speedInput = document.createElement('input');
speedInput.type = 'range';
speedInput.min = '1';speedInput.max = '10000';speedInput.step = '0.5';
speedInput.value = String(simSpeed);
speedInput.style.width = '140px';
speedWrap.appendChild(speedInput);
const speedVal = document.createElement('span');
speedVal.textContent = `${simSpeed}×`;
speedWrap.appendChild(speedVal);
speedInput.addEventListener('input', () => {
    simSpeed = Number(speedInput.value);
    speedVal.textContent = `${simSpeed.toFixed(1)}×`;
    try {(orbits as any)?.setTimeScale?.(simSpeed);} catch{}
});
if('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
        pos => {
            userLonDeg = pos.coords.longitude || 0;
            haveGeo = true;
        }
    );
}
timeDiv.style.position = 'absolute';
timeDiv.style.top = '10px';
timeDiv.style.right = '10px';
timeDiv.style.padding = '4px 8px';
timeDiv.style.background = 'rgba(0, 0, 0, 0.5)';
timeDiv.style.color = '#ffffff';
timeDiv.style.fontFamily = 'sans-serif';
timeDiv.style.fontSize = '14px';
container.style.position = 'relative';
container.appendChild(timeDiv);
container.style.position = 'fixed';
(container.style as any).inset = '0';
container.style.left = '0';
container.style.top = '0';
container.style.right = '0';
container.style.bottom = '0';
container.style.width = '100vw';
container.style.height = '100vh';
container.style.margin = '0';
container.style.padding = '0';
container.style.background = '#000';

renderer.domElement.style.position = 'absolute';
renderer.domElement.style.inset = '0';
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';
renderer.domElement.style.display = 'block';

timeDiv.style.zIndex = '10';
const light = new THREE.DirectionalLight(0xffffff, 1);
light.intensity = 1.4;
const hemi = new THREE.HemisphereLight(0x88aaff, 0x0b0b14, 0.4);
scene.add(hemi);
const maxAniso = renderer.capabilities.getMaxAnisotropy();
light.target.position.set(0,0,0);
scene.add(light.target);
scene.add(light);
const ambient = new THREE.AmbientLight(0xffffff, 0.25);
scene.add(ambient);
ambient.intensity = 0.18;
light.position.set(50, 10, 20);
const manager = new THREE.LoadingManager();
manager.onProgress = (_url, loaded, total) => {
    if(loaderDiv) loaderDiv.textContent = `Loading...${Math.round((loaded/total) * 100)}%`;
};
manager.onError = (url) => console.warn('FAIL:', url);
manager.onLoad = () => {
    loaderDiv.remove();
    start();
    orbits.boot();
    try {(orbits as any)?.setTimeMs?.(simEpochMs);} catch{}
    try {(orbits as any)?.setTimeScale?.(simSpeed);} catch{}
};
const loader = new THREE.TextureLoader(manager);
const prep = (tex:THREE.Texture, asColor = true)=> {
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = maxAniso || 1;
    tex.colorSpace = asColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return tex;
};

loader.setPath('/textures/');
const StarsTex = prep(loader.load('8k_stars_milky_way.jpg'), true);
StarsTex.colorSpace = THREE.SRGBColorSpace;
const StarsGeo = new THREE.SphereGeometry(1000, 64, 64);
const StarsMat = new THREE.MeshBasicMaterial({
    map:StarsTex,
    side:THREE.BackSide,
    depthWrite:false,
});
const Stars = new THREE.Mesh(StarsGeo, StarsMat);
scene.add(Stars);
const EarthDaytexture = prep(loader.load('8k_earth_daymap.jpg'), true);
const EarthNightTexture = prep(loader.load('8k_earth_nightmap.jpg'), true);
const EarthCloudsTexture = prep(loader.load('8k_earth_clouds.jpg'), false);

const orbits = createOrbitsOnlineLayer(scene, {
    groups:DEFAULT_GROUPS,
    maxObjects:50000,
    refreshMs:3 * 60 * 60 * 1000,
    tickMs:250
});
const raycaster = new THREE.Raycaster();
function worldThresholdForPixels(camera:THREE.PerspectiveCamera, pixels:number) {
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const depth = Math.abs(camera.position.length());
    const worldForPixels = 2 * Math.tan(vFov / 2) * depth / renderer.domElement.clientHeight;
    return worldForPixels * pixels;
}
const _v3 = new THREE.Vector3();
function worldToScreenPx(world:THREE.Vector3) {
    _v3.copy(world).project(camera);
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;
    return {
        x:(_v3.x * 0.5 + 0.5) * w,
        y: (-_v3.y * 0.5 + 0.5) * h,
    };
}
raycaster.params.Points = {threshold:1.5};
const tip = document.createElement('div');
tip.style.cssText = `position:absolute;pointer-events:none;z-index:20;background:rgba(0,0,0,0.7);color:#ffffff;padding: 6px 8px;
border-radius:6px;font:12px / 1.3 system-ui;transform:translate(10px, 10px);opacity:0; transition:opacity .12s;`;
container.appendChild(tip);
const orbitMat = new THREE.LineBasicMaterial({
    color:0xffffff,
    transparent:true,
    opacity:0.6,
});
const orbitGeom = new THREE.BufferGeometry();
const orbitLine = new THREE.Line(orbitGeom, orbitMat);
orbitLine.renderOrder = 5;
orbitLine.visible = false;
scene.add(orbitLine);
let hoveredIndex: number = -1;
let hoveredId: number | null = null;
let lastOrbitForId: number | null = null;
let orbitComputeTimer:number | null = null;
function buildOrbitLine(tle:{line1:string, line2:string}, simTimeUTC: number) {
    const rec = twoline2satrec(tle.line1, tle.line2);
    const periodMin = (2 * Math.PI) / rec.no;
    const periodMs = periodMin * 60_000;
    const steps = 256;
    const positions:number[] = [];
    for(let i = 0; i <= steps; i++) {
        const t = simTimeUTC+ (i / steps) * periodMs;
        const pv = propagate(rec, new Date(t));
        const p = pv?.position;
        if(!p) continue;
        positions.push(
            p.x* WORLD_UNITS_PER_KM,
            p.y* WORLD_UNITS_PER_KM,
            p.z* WORLD_UNITS_PER_KM
        );
    }   
    const arr = new Float32Array(positions);
    orbitGeom.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    orbitGeom.computeBoundingSphere();
    orbitLine.visible = true;
}
function setTipContent(name:string, id:number, group:string, altKm:number) {
    tip.innerHTML = `<b>${name}</b> <span style = "opacity:0.8" >#${id}</span><br/>
    ${group} • alt ≈ ${Math.round(altKm).toLocaleString()} km`;

}
const pointerNDC = new THREE.Vector2();
function mouseMove(ev:MouseEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    pointerNDC.set(x, y);
    raycaster.params.Points = {threshold:worldThresholdForPixels(camera, 100)};
    raycaster.setFromCamera(pointerNDC, camera);
    let intersects = raycaster.intersectObject(orbits.points, false)[0];
    if(!intersects) {
        raycaster.params.Points = {threshold:worldThresholdForPixels(camera, 200)};
        intersects = raycaster.intersectObject(orbits.points, false)[0];
    }   
    const frame = orbits.getFrame();
    if(!intersects || !frame || !frame.positionsKm || !frame.ids) {
        if(hoveredId != null && hoveredIndex >= 0 &&  frame && frame.positionsKm) {
            const off = hoveredIndex * 3;
            const world = new THREE.Vector3(
                frame.positionsKm[off + 0] * WORLD_UNITS_PER_KM,
                frame.positionsKm[off + 1] * WORLD_UNITS_PER_KM,
                frame.positionsKm[off + 2] * WORLD_UNITS_PER_KM,
            );
            const p = worldToScreenPx(world);
            const dx = p.x - ev.clientX;
            const dy = p.y - ev.clientY;
            const distPx = Math.hypot(dx, dy);
            if(distPx <= 18) {
                alert("OK");
            tip.style.left = `${ev.clientX}px`;
            tip.style.top = `${ev.clientY}px`;
            tip.style.opacity = '1';
            orbitLine.visible = true;
            return;
            }
        }
        hoveredIndex = -1;
        hoveredId = null;
        tip.style.opacity = '0';
        orbitLine.visible = false;
        return;
    }

    const idx = intersects.index!;
    if(idx >= frame.count) return;
    const id = frame.ids[idx];
    hoveredIndex = idx;
    hoveredId = id;
    const tle = orbits.getTleById(id);
    const off = idx * 3;
    const xKm = frame.positionsKm[off + 0];
    const yKm = frame.positionsKm[off + 1];
    const zKm = frame.positionsKm[off + 2];
    const rKm = Math.hypot(xKm, yKm, zKm);
    const altKm = rKm - 6371;
    setTipContent(tle?.name || 'UNKNOWN', id, tle?.group || 'unknown' ,altKm);
            tip.style.left = `${ev.clientX}px`;
            tip.style.top = `${ev.clientY}px`;
            tip.style.opacity = '1';
    if(lastOrbitForId !== id) {
        lastOrbitForId = id;
        orbitLine.visible = false;
        if(orbitComputeTimer) window.clearTimeout(orbitComputeTimer);
        orbitComputeTimer = window.setTimeout(() => {
                if(tle) buildOrbitLine(tle, simEpochMs);
        }, 120);
    }
}
renderer.domElement.addEventListener('mousemove', mouseMove);
orbits.points.renderOrder = 4;
EarthCloudsTexture.colorSpace = THREE.NoColorSpace;
EarthDaytexture.colorSpace = THREE.SRGBColorSpace;
EarthNightTexture.colorSpace = THREE.SRGBColorSpace;
const sphereMat = new THREE.MeshPhongMaterial({map:EarthDaytexture});
sphereMat.specular = new THREE.Color(0x222222);
sphereMat.shininess = 20;

sphereMat.emissiveMap = EarthNightTexture;
sphereMat.emissive =  new THREE.Color(0xffffff);
sphereMat.emissiveIntensity = 1.0;
sphereMat.needsUpdate = true;

sphereMat.onBeforeCompile = (shader) => {
    shader.uniforms.uSunDir = {value:light.position.clone().normalize()};
    (sphereMat as any).userData = (sphereMat as any).userData || {};
    (sphereMat as any).userData.shader = shader;
    shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common> 
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;`
    ).replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;`   
    );
    shader.fragmentShader = shader.fragmentShader.replace(
         '#include <common>',
        `#include <common> 
        varying vec3 vWorldNormal;
        uniform vec3 uSunDir;
        varying vec3 vWorldPos;`

    ).replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        vec3 N = normalize(vWorldNormal);
        float dayFactor = clamp(dot(N, normalize(uSunDir)), 0.0, 1.0);
        float twilight = smoothstep(0.05, 0.25, dayFactor);
        float night = 1.0 - twilight;
        diffuseColor.rgb *= mix(0.1, 1.0, twilight);
        totalEmissiveRadiance = mix(vec3(0.0), totalEmissiveRadiance * 1.6, night);
        float glow = smoothstep(0.0, 0.25, 1.0 - dayFactor);
        diffuseColor.rgb += vec3(0.3, 0.35, 0.5) * glow * 0.25;
        `
    );
};
const sphereGeo = new THREE.SphereGeometry(5, 64, 64);
const earth = new THREE.Mesh(sphereGeo, sphereMat);
scene.add(earth);

const atmosphereGeo = new THREE.SphereGeometry(5.15, 64, 64);
const atmosphereMat = new THREE.ShaderMaterial({
    transparent:true,
    depthWrite:false,
    side:THREE.BackSide,
    blending:THREE.AdditiveBlending,
    uniforms:{
        glowIntensity:{value:0.45},
        uSunDir:{value : new THREE.Vector3().copy(light.position).normalize()}, 

    },
    vertexShader:`
    varying vec3 vWorldNormal;
    varying vec3 vWorldPos;
    void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
    fragmentShader: `
    precision mediump float;
    varying vec3 vWorldNormal;
    varying vec3 vWorldPos;
    uniform float glowIntensity;
    uniform vec3 uSunDir;
    void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.0);
    float daySide = clamp(dot(N, normalize(uSunDir)), 0.0, 1.0);
    float dayBoost = mix(0.4, 1.0, daySide);
    vec3 col = vec3(0.35, 0.55, 1.0) * rim * dayBoost;
    gl_FragColor = vec4(col * glowIntensity * 2.4, rim * glowIntensity * 1.6 * dayBoost);
    }`

});
const atmosphere = new THREE.Mesh(atmosphereGeo, atmosphereMat);
scene.add(atmosphere);
earth.renderOrder = 1;
atmosphere.renderOrder = 3;
EarthCloudsTexture.anisotropy = maxAniso;
const cloudsAlpha = EarthCloudsTexture;
const cloudsMat = new THREE.MeshPhongMaterial({
    color:new THREE.Color(0xffffff),
    alphaMap:cloudsAlpha,
    transparent:true,
    depthWrite:false,
    opacity:0.62,
    alphaTest:0.005,
});
cloudsMat.map = null;
cloudsMat.needsUpdate = true;
const clouds = new THREE.Mesh(new THREE.SphereGeometry(5.03, 64, 64), cloudsMat);
scene.add(clouds);
clouds.renderOrder = 2;
earth.rotation.z = AXIAL_TILT;
clouds.rotation.z = AXIAL_TILT;
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
function dayOfYear(d:Date) {
    const start = Date.UTC(d.getUTCFullYear(),0, 1);
    const diff = d.getTime()-start;
    return Math.floor(diff / 86400000) + 1;
}
function solarDeclinationRad(d:Date) {
    const N = dayOfYear(d);
    return THREE.MathUtils.degToRad(23.44) * Math.sin(2 * Math.PI * (N - 80) / 365.2422);
}
function updateSunAndEarth(simDate: Date) {
    const dec = solarDeclinationRad(simDate);
    const R = 200;
    light.position.set(R * Math.cos(dec), R * Math.sin(dec), 0);
    light.target.position.set(0,0,0);
    light.target.updateMatrixWorld?.();
    const utcHours = simDate.getUTCHours() + simDate.getUTCMinutes() / 60 + simDate.getUTCSeconds() / 3600;
    const lonOffSetHours = (userLonDeg || 0 ) / 15;
    const localSolarHours = (utcHours + lonOffSetHours + 24) % 24;
    const phaseDeg = LONGTITUDE_OFFSET_DEG - (userLonDeg || 0);
    const phaseRad = THREE.MathUtils.degToRad(phaseDeg);
    const frac = localSolarHours / 24;
    earth.rotation.y = - frac * Math.PI * 2 + phaseRad;
    clouds.rotation.y = earth.rotation.y + 0.03;
}
const MoonGeo = new THREE.SphereGeometry(1.35, 64, 64);
const MoonMat = new THREE.MeshPhongMaterial({
    map:loader.load('moon.jpg'),
    shininess:5,
    color:0xffffff,
});
const Moon = new THREE.Mesh(MoonGeo, MoonMat);
scene.add(Moon);
const MOON_DISTANCE = 15;
const MOON_ORBIT_SPEED = 0.03;
Moon.position.set(MOON_DISTANCE, 0, 0);
let raf = 0;
function animate() {
    raf = requestAnimationFrame(animate);
    const nowReal = performance.now();
    const dtReal = nowReal - lastRealMs;
    lastRealMs = nowReal;
    simEpochMs += dtReal * simSpeed;
    const simNowMs = simEpochMs;
    const simDate = new Date(simNowMs);
    timeDiv.textContent = simDate.toLocaleTimeString();

    updateSunAndEarth(simDate);
    controls.update();
    const ud = (sphereMat as any).userData;
    if(ud?.shader?.uniforms?.uSunDir) {
        ud.shader.uniforms.uSunDir.value.copy(light.position).normalize();
        
    }
    (atmosphere.material as THREE.ShaderMaterial).uniforms.uSunDir.value
    .copy(light.position)
    .normalize();
    Stars.rotation.y += 0.00002;
    const time = simNowMs* 0.00005;
    Moon.position.x = Math.cos(time * MOON_ORBIT_SPEED) * MOON_DISTANCE;
    Moon.position.z = Math.sin(time * MOON_ORBIT_SPEED) * MOON_DISTANCE;
    Moon.rotation.y += 0.0005 * simSpeed;
   try {
    (orbits as any)?.setTimeMs?.(simNowMs);
   } catch{}
    renderer.render(scene, camera);
};
function start(){lastRealMs = performance.now();simEpochMs = Date.now();animate();}
const ro = new ResizeObserver(() => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    camera.aspect = w /h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);

});
ro.observe(container);
function dispose() {
    cancelAnimationFrame(raf);
    ro.disconnect();
    controls.dispose();
    clouds.geometry.dispose();
    cloudsMat.dispose();
    EarthCloudsTexture?.dispose();
    EarthNightTexture?.dispose();
    atmosphere.geometry.dispose();
    (atmosphere.material as THREE.Material).dispose();
    hud.remove();
    timeDiv.remove();
    StarsGeo.dispose();
    StarsMat.dispose();
    StarsTex.dispose?.();
    orbits.dispose();
    Moon.geometry.dispose();
    (Moon.material as any).dispose();
    renderer.domElement.removeEventListener('mousemove', mouseMove);
    orbitGeom.dispose();
    (orbitMat as THREE.Material).dispose();
    tip.remove();
    renderer.dispose();
    container.replaceChildren();
    sphereGeo.dispose();
    sphereMat.dispose();
    EarthDaytexture.dispose?.();
}
return {dispose};
}

