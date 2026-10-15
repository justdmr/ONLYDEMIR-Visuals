// Post pipeline: scene A/B -> compose (transition, mirror, punch/shake, EQ overlay, text) -> trails -> lens (streaks, ghosts, dirt) -> bloom -> final (glitch, RGB, grade, grain, sRGB)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const VERT = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
const HASH = 'float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }';

export const TRANSITIONS = ['Glitch', 'Flaş', 'Zoom', 'Silme', 'Karışım', 'RGB'];
export const MIRRORS = ['Yok', 'Yatay', 'Dikey', '4\'lü', 'Kaleydo 6', 'Kaleydo 12'];
export const EQ_LAYERS = ['Kapalı', 'Alt bar', 'Daire', 'Dalga', 'Kenarlar', 'Üst+Alt'];

const ComposeShader = {
  uniforms: {
    tA: { value: null }, tB: { value: null }, tText: { value: null }, uSpec: { value: null }, uWave: { value: null },
    uMix: { value: 1 }, uTrans: { value: 0 }, uTime: { value: 0 }, uMirror: { value: 0 }, uAspect: { value: 1.78 },
    uPunch: { value: 0 }, uShake: { value: new THREE.Vector2() }, uEQ: { value: 0 }, uEQSize: { value: 1 },
    uC1: { value: new THREE.Vector3(0.89, 0.04, 0.09) }, uC2: { value: new THREE.Vector3(1, 1, 1) }, uBass: { value: 0 },
    uTextAlpha: { value: 0 }, uTextScale: { value: 1 }, uTextCenter: { value: new THREE.Vector2(0.5, 0.5) }, uTextGlitch: { value: 0 },
    uTextSweep: { value: -1 }, uTextShine: { value: 0 }, tSting: { value: null }, uSting: { value: 0 }, uStingDim: { value: 0 }
  },
  vertexShader: VERT,
  fragmentShader: `
uniform sampler2D tA, tB, tText, uSpec, uWave, tSting;
uniform float uMix, uTrans, uTime, uMirror, uAspect, uPunch, uEQ, uEQSize, uBass, uTextAlpha, uTextScale, uTextGlitch, uTextSweep, uTextShine, uSting, uStingDim;
uniform vec2 uShake, uTextCenter;
uniform vec3 uC1, uC2;
varying vec2 vUv;
${HASH}
vec3 lin(vec3 c){ return pow(c,vec3(2.2)); }
vec2 kaleido(vec2 uv,float n){
  vec2 p=uv-0.5; p.x*=uAspect;
  float a=atan(p.y,p.x), r=length(p), s=6.2831853/n;
  a=mod(a+uTime*0.15,s); a=abs(a-s*0.5);
  p=r*vec2(cos(a),sin(a)); p.x/=uAspect;
  uv=p+0.5;
  return 1.0-abs(1.0-mod(uv,2.0));
}
vec2 mirror(vec2 uv){
  if(uMirror<0.5) return uv;
  if(uMirror<1.5){ uv.x=0.5-abs(uv.x-0.5); return uv; }
  if(uMirror<2.5){ uv.y=0.5-abs(uv.y-0.5); return uv; }
  if(uMirror<3.5){ return 0.5-abs(uv-0.5); }
  return kaleido(uv,uMirror<4.5?6.0:12.0);
}
float spec(float x){ return texture2D(uSpec,vec2(clamp(x,0.0,1.0),0.5)).r; }
// equaliser overlay drawn on top of any scene
vec3 eq(vec3 c){
  vec3 c1=lin(uC1)*1.6, c2=lin(uC2)*1.4;
  float k=uEQSize;
  if(uEQ<1.5||uEQ>4.5){
    float x=abs(vUv.x-0.5)*2.0, id=floor(x*48.0), fx=fract(x*48.0);
    float s=spec((id+0.5)/48.0*0.85);
    float h=s*0.3*k;
    float m=step(0.15,fx)*step(fx,0.85);
    for(int side=0;side<2;side++){
      if(side==1&&uEQ<4.5) break;
      float y=side==0?vUv.y:1.0-vUv.y;
      float seg=step(0.3,fract(y*90.0));
      vec3 col=mix(c1,c2,clamp(y/max(h,0.001),0.0,1.0));
      c=mix(c,col,step(y,h)*m*seg*0.92);
      c+=col*exp(-abs(y-h)*90.0)*m*0.5;
    }
  } else if(uEQ<2.5){
    vec2 q=(vUv-0.5)*vec2(uAspect,1.0);
    float a=atan(q.y,q.x), r=length(q);
    float x=abs(fract(a/6.2831853+0.25)-0.5)*2.0, id=floor(x*72.0), fx=fract(x*72.0);
    float s=spec((id+0.5)/72.0*0.85);
    float r0=(0.3+uBass*0.02)*k, h=s*0.2*k;
    float m=step(0.2,fx)*step(fx,0.8);
    vec3 col=mix(c1,c2,clamp((r-r0)/max(h,0.001),0.0,1.0));
    c=mix(c,col,step(r0,r)*step(r,r0+h)*m*0.95);
    c+=c1*exp(-abs(r-r0+0.006)*300.0)*0.8;
  } else if(uEQ<3.5){
    float w=texture2D(uWave,vec2(vUv.x,0.5)).r-0.5;
    float d=abs(vUv.y-0.5-w*0.6*k);
    c+=c2*exp(-d*500.0)*1.6+c1*exp(-d*70.0)*0.7;
  } else {
    float y=abs(vUv.y-0.5)*2.0, id=floor(y*36.0), fy=fract(y*36.0);
    float s=spec((id+0.5)/36.0*0.85);
    float w=s*0.16*k/uAspect;
    float x=min(vUv.x,1.0-vUv.x);
    float m=step(0.15,fy)*step(fy,0.85);
    vec3 col=mix(c1,c2,clamp(x/max(w,0.001),0.0,1.0));
    c=mix(c,col,step(x,w)*m*0.92);
  }
  return c;
}
void main(){
  vec2 uv=(vUv-0.5)/(1.0+uPunch)+0.5+uShake;
  uv=mirror(uv);
  vec3 c=texture2D(tA,uv).rgb;
  if(uMix<1.0){
    float m=uMix, mid=1.0-abs(m*2.0-1.0);
    if(uTrans<0.5){
      float n=hash(floor(vUv*vec2(32.0,18.0)));
      vec2 off=vec2((hash(vec2(floor(vUv.y*45.0),floor(uTime*30.0)))-0.5)*0.08*mid,0.0);
      c=mix(texture2D(tB,uv+off).rgb,texture2D(tA,uv-off).rgb,step(n,m));
      c+=lin(uC1)*pow(mid,6.0)*0.6;
    } else if(uTrans<1.5){
      c=m<0.5?texture2D(tB,uv).rgb:c;
      c+=vec3(pow(mid,3.0)*3.0);
    } else if(uTrans<2.5){
      vec3 b=texture2D(tB,(uv-0.5)/(1.0+m*3.0)+0.5).rgb;
      vec3 a=texture2D(tA,(uv-0.5)*(1.0+(1.0-m)*0.6)+0.5).rgb;
      c=mix(b,a,smoothstep(0.25,0.75,m))+vec3(pow(mid,4.0)*0.8);
    } else if(uTrans<3.5){
      float e=vUv.x+(vUv.y-0.5)*0.35-(m*1.5-0.2);
      c=e<0.0?c:texture2D(tB,uv).rgb;
      c+=lin(uC1)*3.0*exp(-abs(e)*60.0)+vec3(1.0)*exp(-abs(e)*400.0);
    } else if(uTrans<4.5){
      c=mix(texture2D(tB,uv).rgb,c,smoothstep(0.0,1.0,m));
    } else {
      vec3 a=c, b=texture2D(tB,uv).rgb;
      c=vec3(mix(b.r,a.r,smoothstep(0.0,0.6,m)),mix(b.g,a.g,smoothstep(0.2,0.8,m)),mix(b.b,a.b,smoothstep(0.4,1.0,m)));
    }
  }
  if(uEQ>0.5) c=eq(c);
  if(uSting>0.0){
    // drop logo: premultiplied colour + coverage alpha; the scene dims behind it
    vec4 s=texture2D(tSting,(vUv-0.5)/(1.0+uPunch*0.5)+0.5);
    c*=1.0-uStingDim;
    c=mix(c,c*(1.0-s.a)+s.rgb,uSting);
  }
  vec2 tuv=(vUv-uTextCenter)/uTextScale+uTextCenter;
  float row=floor(tuv.y*28.0);
  float tear=uTextGlitch*step(0.55,hash(vec2(row,floor(uTime*18.0))));
  tuv.x+=(hash(vec2(row,floor(uTime*24.0)))-0.5)*0.14*tear;
  vec4 t=texture2D(tText,tuv);
  float ghost=texture2D(tText,tuv+vec2(0.008,0.002)*uTextGlitch).a;
  c=mix(c,t.rgb*1.3,t.a*uTextAlpha);
  // specular glint sliding across the solid part of the letters
  float sw=exp(-pow((tuv.x+(1.0-tuv.y)*0.35-uTextSweep)*14.0,2.0));
  c+=vec3(1.0,0.97,0.92)*sw*smoothstep(0.55,1.0,t.a)*dot(t.rgb,vec3(0.33))*uTextShine*uTextAlpha*2.5;
  c+=lin(uC1)*ghost*(1.0-t.a)*uTextGlitch*uTextAlpha*1.5;
  gl_FragColor=vec4(c,1.0);
}`
};

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uBeat: { value: 0 }, uGlitch: { value: 0 }, uRGB: { value: 1 },
    uGrain: { value: 1 }, uFade: { value: 1 }, uStrobe: { value: 0 }, uInvert: { value: 0 }, uMaster: { value: 1 },
    uHue: { value: 0 }, uSat: { value: 1 }, uContrast: { value: 1 }, uVignette: { value: 1 }, uScan: { value: 0 }, uTone: { value: 1 }, uExposure: { value: 1 },
    uRes: { value: new THREE.Vector2(1, 1) }
  },
  vertexShader: VERT,
  fragmentShader: `
uniform sampler2D tDiffuse;
uniform float uTime, uBeat, uGlitch, uRGB, uGrain, uFade, uStrobe, uInvert, uMaster, uHue, uSat, uContrast, uVignette, uScan, uTone, uExposure;
// ACES filmic (Narkowicz fit)
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
uniform vec2 uRes;
varying vec2 vUv;
${HASH}
vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c,vec3(1.0/2.4))-0.055, step(0.0031308,c)); }
vec3 hueRotate(vec3 c,float a){
  const vec3 k=vec3(0.57735);
  float ca=cos(a);
  return c*ca+cross(k,c)*sin(a)+k*dot(k,c)*(1.0-ca);
}
void main(){
  vec2 uv=vUv;
  float g=uGlitch;
  if(g>0.01){
    float rows=mix(12.0,60.0,hash(vec2(floor(uTime*12.0),3.1)));
    float row=floor(uv.y*rows);
    float r=hash(vec2(row,floor(uTime*20.0)));
    if(r<g*0.45) uv.x+=(r-g*0.22)*0.25*g;
  }
  vec2 dir=uv-0.5;
  float ca=uRGB*(0.0015+0.01*uBeat)+g*0.025;
  vec3 c=vec3(texture2D(tDiffuse,uv+dir*ca).r, texture2D(tDiffuse,uv).g, texture2D(tDiffuse,uv-dir*ca).b);
  c*=uExposure;
  if(uTone>0.5) c=aces(c*1.35);
  else { vec3 k=max(c-0.8,0.0); c=min(c,0.8)+0.2*(1.0-exp(-k*4.0)); }
  if(uHue!=0.0) c=max(hueRotate(c,uHue),0.0);
  float l=dot(c,vec3(0.2126,0.7152,0.0722));
  c=max(mix(vec3(l),c,uSat),0.0);
  c*=1.0-0.45*dot(dir,dir)*1.6*uVignette;
  c*=uMaster*uFade;
  c=mix(c,1.0-c,uInvert);
  c=mix(c,vec3(1.0),uStrobe);
  c=toSRGB(clamp(c,0.0,1.0));
  c=clamp((c-0.5)*uContrast+0.5,0.0,1.0);
  c*=1.0-uScan*0.25*(0.5+0.5*sin(gl_FragCoord.y*3.14159));
  c+=(hash(uv*uRes+fract(uTime*7.0)*100.0)-0.5)*0.06*uGrain;
  gl_FragColor=vec4(c,1.0);
}`
};

// video feedback: the previous output, zoomed / rotated / hue-drifted, stays under the new frame
class FeedbackPass extends Pass {
  constructor() {
    super();
    const opts = { type: THREE.HalfFloatType };
    this.a = new THREE.WebGLRenderTarget(1, 1, opts);
    this.b = new THREE.WebGLRenderTarget(1, 1, opts);
    this.uniforms = { tCur: { value: null }, tPrev: { value: null }, uDecay: { value: 0.9 }, uZoom: { value: 1.02 }, uRot: { value: 0.005 }, uHue: { value: 0 }, uAspect: { value: 1.78 } };
    this.quad = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT,
      fragmentShader: `
uniform sampler2D tCur, tPrev; uniform float uDecay, uZoom, uRot, uHue, uAspect; varying vec2 vUv;
vec3 hueRotate(vec3 c,float a){ const vec3 k=vec3(0.57735); float ca=cos(a); return c*ca+cross(k,c)*sin(a)+k*dot(k,c)*(1.0-ca); }
void main(){
  vec2 p=vUv-0.5; p.x*=uAspect;
  float c=cos(uRot), s=sin(uRot);
  p=mat2(c,-s,s,c)*p/uZoom; p.x/=uAspect;
  vec2 q=p+0.5;
  vec3 prev=texture2D(tPrev,q).rgb*uDecay*step(0.0,q.x)*step(q.x,1.0)*step(0.0,q.y)*step(q.y,1.0);
  if(uHue!=0.0) prev=max(hueRotate(prev,uHue),0.0);
  vec3 cur=texture2D(tCur,vUv).rgb;
  gl_FragColor=vec4(max(cur,prev),1.0);
}`
    }));
    this.copy = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { t: { value: null } }, vertexShader: VERT,
      fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor=texture2D(t,vUv); }'
    }));
  }
  setSize(w, h) { this.a.setSize(w, h); this.b.setSize(w, h); this.uniforms.uAspect.value = w / h; }
  render(renderer, writeBuffer, readBuffer) {
    this.uniforms.tCur.value = readBuffer.texture;
    this.uniforms.tPrev.value = this.a.texture;
    renderer.setRenderTarget(this.b);
    this.quad.render(renderer);
    [this.a, this.b] = [this.b, this.a];
    this.copy.material.uniforms.t.value = this.a.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.copy.render(renderer);
  }
}

// seeded so the dirt pattern is the same every time the app starts
function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
// lens dirt: dust specks, soft smudges, dried water spots with brighter rims and a few wipe marks; only shows where light hits it
function dirtTexture() {
  const W = 1024, H = 576, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d'), r = rng(1923);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  const blob = (x, y, rad, a, rim) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    if (rim) { gr.addColorStop(0, `rgba(255,255,255,${a * 0.35})`); gr.addColorStop(0.82, `rgba(255,255,255,${a * 0.5})`); gr.addColorStop(0.93, `rgba(255,255,255,${a})`); }
    else { gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.6, `rgba(255,255,255,${a * 0.4})`); }
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  };
  for (let i = 0; i < 70; i++) blob(r() * W, r() * H, 30 + r() * 140, 0.03 + r() * 0.06, false);
  for (let i = 0; i < 55; i++) blob(r() * W, r() * H, 8 + r() * 40, 0.05 + r() * 0.12, true);
  for (let i = 0; i < 900; i++) blob(r() * W, r() * H, 0.6 + Math.pow(r(), 3) * 6, 0.15 + r() * 0.5, false);
  for (let i = 0; i < 9; i++) {
    g.save(); g.translate(r() * W, r() * H); g.rotate(r() * Math.PI); g.scale(1, 0.08 + r() * 0.1);
    blob(0, 0, 120 + r() * 220, 0.035 + r() * 0.04, false); g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  return t;
}

// Physically-inspired lens: anamorphic horizontal streaks, mirrored ghosts + halo with chromatic fringing, and lens dirt
// lit by the bright parts of the frame. Everything is computed at quarter resolution from a thresholded copy.
class LensPass extends Pass {
  constructor() {
    super();
    const opts = { type: THREE.HalfFloatType, depthBuffer: false };
    this.rt = { bright: new THREE.WebGLRenderTarget(1, 1, opts), sa: new THREE.WebGLRenderTarget(1, 1, opts), sb: new THREE.WebGLRenderTarget(1, 1, opts),
      ghost: new THREE.WebGLRenderTarget(1, 1, opts), gb: new THREE.WebGLRenderTarget(1, 1, opts), tiny: new THREE.WebGLRenderTarget(1, 1, opts),
      avg: new THREE.WebGLRenderTarget(1, 1, opts), avg2: new THREE.WebGLRenderTarget(1, 1, opts) };
    const mat = (uniforms, fs) => new FullScreenQuad(new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: fs, depthTest: false, depthWrite: false }));
    // local average luminance (1/16 res box of the frame) so that only point-like highlights, brighter than their
    // surroundings, feed the lens: large bright areas (skies, LED walls, chrome faces) stay clean
    this.avgQ = mat({ t: { value: null }, uTexel: { value: new THREE.Vector2() } }, `
uniform sampler2D t; uniform vec2 uTexel; varying vec2 vUv;
void main(){ vec3 s=vec3(0.0); for(int y=0;y<4;y++) for(int x=0;x<4;x++) s+=texture2D(t,vUv+(vec2(float(x),float(y))-1.5)*uTexel*4.0).rgb; gl_FragColor=vec4(s/16.0,1.0); }`);
    this.brightQ = mat({ t: { value: null }, tAvg: { value: null }, uTexel: { value: new THREE.Vector2() }, uThresh: { value: 1.6 }, uAdapt: { value: 1.6 } }, `
uniform sampler2D t, tAvg; uniform vec2 uTexel; uniform float uThresh, uAdapt; varying vec2 vUv;
float lum(vec3 c){ return max(c.r,max(c.g,c.b)); }
void main(){
  float th=uThresh+uAdapt*lum(texture2D(tAvg,vUv).rgb);
  vec3 c=vec3(0.0);
  for(int i=0;i<4;i++){
    vec2 o=vec2(i==0||i==2?-1.0:1.0,i<2?-1.0:1.0);
    vec3 s=texture2D(t,vUv+o*uTexel).rgb; float l=lum(s);
    float k=max(l-th,0.0); c+=s*(k*k/(k+th))/max(l,1e-4);
  }
  c*=0.25;
  // soft-compress so a field of very hot pixels (city lights, chrome hits) can't blow the lens out
  gl_FragColor=vec4(c/(1.0+lum(c)*0.6),1.0);
}`);
    // one horizontal blur step; three of them with growing stride make a long streak
    this.streakQ = mat({ t: { value: null }, uStep: { value: 1 }, uTexel: { value: new THREE.Vector2() } }, `
uniform sampler2D t; uniform float uStep; uniform vec2 uTexel; varying vec2 vUv;
void main(){ vec3 s=texture2D(t,vUv).rgb; float w=1.0;
  for(int i=1;i<=8;i++){ float k=pow(0.84,float(i)); vec2 o=vec2(float(i)*uStep*uTexel.x,0.0); s+=(texture2D(t,vUv+o).rgb+texture2D(t,vUv-o).rgb)*k; w+=2.0*k; }
  gl_FragColor=vec4(s/w,1.0); }`);
    this.ghostQ = mat({ t: { value: null }, uAspect: { value: 1.78 } }, `
uniform sampler2D t; uniform float uAspect; varying vec2 vUv;
vec3 chroma(vec2 uv,vec2 dir){ return vec3(texture2D(t,uv+dir*0.012).r,texture2D(t,uv).g,texture2D(t,uv-dir*0.012).b); }
void main(){
  vec2 tc=1.0-vUv;
  vec2 gv=(0.5-tc)*0.38;
  vec2 dir=normalize(gv+1e-5);
  vec3 c=vec3(0.0);
  for(int i=1;i<5;i++){
    vec2 o=fract(tc+gv*float(i));
    float w=pow(max(0.0,1.0-length(0.5-o)/0.7071),12.0);
    vec3 tint=mix(vec3(1.0,0.62,0.32),vec3(0.35,0.75,1.0),fract(float(i)*0.37));
    c+=chroma(o,dir)*w*tint;
  }
  vec2 hv=dir*vec2(1.0/uAspect,1.0)*0.36;
  vec2 ho=tc+hv;
  float hw=pow(max(0.0,1.0-length((0.5-ho)*vec2(uAspect,1.0))/(0.7071*uAspect)),4.0);
  c+=chroma(ho,dir)*hw*vec3(0.7,0.85,1.0)*0.6;
  gl_FragColor=vec4(c,1.0);
}`);
    this.blurQ = mat({ t: { value: null }, uTexel: { value: new THREE.Vector2() } }, `
uniform sampler2D t; uniform vec2 uTexel; varying vec2 vUv;
void main(){ vec3 s=vec3(0.0); float w=0.0;
  for(int y=-2;y<=2;y++) for(int x=-2;x<=2;x++){ float k=exp(-float(x*x+y*y)*0.35); s+=texture2D(t,vUv+vec2(float(x),float(y))*uTexel*1.6).rgb*k; w+=k; }
  gl_FragColor=vec4(s/w,1.0); }`);
    this.uniforms = {
      tScene: { value: null }, tStreak: { value: null }, tGhost: { value: null }, tTiny: { value: null }, tDirt: { value: dirtTexture() },
      uStreak: { value: 0.6 }, uGhost: { value: 0.35 }, uDirt: { value: 0.5 }, uTint: { value: new THREE.Vector3(0.45, 0.65, 1) }, uAspect: { value: 1.78 }
    };
    this.comp = mat(this.uniforms, `
uniform sampler2D tScene, tStreak, tGhost, tTiny, tDirt; uniform float uStreak, uGhost, uDirt, uAspect; uniform vec3 uTint; varying vec2 vUv;
void main(){
  vec3 c=texture2D(tScene,vUv).rgb;
  vec2 duv=(vUv-0.5)*vec2(min(1.0,uAspect/1.7778),min(1.0,1.7778/uAspect))+0.5;
  float dirt=texture2D(tDirt,duv).r;
  vec3 st=texture2D(tStreak,vUv).rgb, gh=texture2D(tGhost,vUv).rgb, glow=texture2D(tTiny,vUv).rgb;
  float sl=dot(st,vec3(0.3333));
  c+=uTint*sl*uStreak*2.0*(1.0+dirt*uDirt*1.5);
  c+=gh*uGhost*2.5*(1.0+dirt*uDirt*2.0);
  c+=(glow*2.0+st*0.5)*dirt*uDirt*1.4;
  gl_FragColor=vec4(c,1.0);
}`);
  }
  setSize(w, h) {
    const q = [Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(h / 4))];
    ['bright', 'sa', 'sb', 'ghost', 'gb'].forEach(k => this.rt[k].setSize(...q));
    this.rt.avg.setSize(Math.max(1, Math.round(w / 16)), Math.max(1, Math.round(h / 16)));
    this.rt.avg2.setSize(Math.max(1, Math.round(w / 16)), Math.max(1, Math.round(h / 16)));
    this.rt.tiny.setSize(Math.max(1, Math.round(w / 32)), Math.max(1, Math.round(h / 32)));
    this.full = [w, h]; this.q = q;
    this.uniforms.uAspect.value = this.ghostQ.material.uniforms.uAspect.value = w / h;
  }
  render(renderer, writeBuffer, readBuffer) {
    const { rt } = this, [qw, qh] = this.q;
    const run = (quad, target) => { renderer.setRenderTarget(target); quad.render(renderer); };
    let u = this.avgQ.material.uniforms;
    u.t.value = readBuffer.texture; u.uTexel.value.set(1 / this.full[0], 1 / this.full[1]);
    run(this.avgQ, rt.avg);
    u = this.blurQ.material.uniforms; u.t.value = rt.avg.texture; u.uTexel.value.set(16 / this.full[0], 16 / this.full[1]); run(this.blurQ, rt.avg2);
    u = this.brightQ.material.uniforms;
    u.t.value = readBuffer.texture; u.tAvg.value = rt.avg2.texture; u.uTexel.value.set(1 / this.full[0], 1 / this.full[1]);
    run(this.brightQ, rt.bright);
    u = this.streakQ.material.uniforms; u.uTexel.value.set(1 / qw, 1 / qh);
    u.t.value = rt.bright.texture; u.uStep.value = 1; run(this.streakQ, rt.sa);
    u.t.value = rt.sa.texture; u.uStep.value = 6; run(this.streakQ, rt.sb);
    u.t.value = rt.sb.texture; u.uStep.value = 30; run(this.streakQ, rt.sa);
    // wide soft glow (1/32): lights the dirt and is the source of the ghosts, so they read as soft aperture discs
    u = this.blurQ.material.uniforms; u.t.value = rt.bright.texture; u.uTexel.value.set(5 / qw, 5 / qh); run(this.blurQ, rt.tiny);
    this.ghostQ.material.uniforms.t.value = rt.tiny.texture; run(this.ghostQ, rt.ghost);
    u.t.value = rt.ghost.texture; u.uTexel.value.set(1 / qw, 1 / qh); run(this.blurQ, rt.gb);
    this.uniforms.tScene.value = readBuffer.texture; this.uniforms.tStreak.value = rt.sa.texture;
    this.uniforms.tGhost.value = rt.gb.texture; this.uniforms.tTiny.value = rt.tiny.texture;
    run(this.comp, this.renderToScreen ? null : writeBuffer);
  }
}

export class Compositor {
  constructor(renderer) {
    this.renderer = renderer;
    const opts = { type: THREE.HalfFloatType, samples: 4 };
    this.rtA = new THREE.WebGLRenderTarget(1, 1, opts);
    this.rtB = new THREE.WebGLRenderTarget(1, 1, opts);
    this.rtS = new THREE.WebGLRenderTarget(1, 1, opts);
    this.composer = new EffectComposer(renderer);
    this.compose = new ShaderPass(ComposeShader);
    this.feedback = new FeedbackPass();
    this.feedback.enabled = false;
    this.trails = new AfterimagePass(0.88);
    this.trails.enabled = false;
    this.lens = new LensPass();
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.25, 0.45, 0.85);
    this.final = new ShaderPass(FinalShader);
    [this.compose, this.feedback, this.trails, this.lens, this.bloom, this.final].forEach(p => this.composer.addPass(p));
  }
  setSize(w, h, pr) {
    this.rtA.setSize(w * pr, h * pr);
    this.rtB.setSize(w * pr, h * pr);
    this.rtS.setSize(w * pr, h * pr);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.compose.uniforms.uAspect.value = w / h;
    this.final.uniforms.uRes.value.set(w * pr, h * pr);
  }
  render(a, b, dt, sting) {
    const r = this.renderer;
    r.setRenderTarget(this.rtA); r.clear(); a.render(r);
    if (b) { r.setRenderTarget(this.rtB); r.clear(); b.render(r); }
    if (sting) {
      const ca = r.getClearAlpha();
      r.setRenderTarget(this.rtS); r.setClearAlpha(0); r.clear(); sting.render(r); r.setClearAlpha(ca);
      this.compose.uniforms.tSting.value = this.rtS.texture;
    }
    r.setRenderTarget(null);
    this.compose.uniforms.tA.value = this.rtA.texture;
    this.compose.uniforms.tB.value = this.rtB.texture;
    this.composer.render(dt);
  }
}

// Text is drawn into a canvas only when its content changes; beat scaling and glitching happen in the compose shader.
export class TextLayer {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.g = this.canvas.getContext('2d');
    this.makeTex();
    this.key = '';
  }
  // a texture's storage is fixed at first upload, so a new size needs a new texture
  makeTex() {
    if (this.tex) this.tex.dispose();
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.generateMipmaps = false;
    this.tex.minFilter = THREE.LinearFilter;
  }
  setSize(w, h) {
    this.canvas.width = Math.round(w);
    this.canvas.height = Math.round(h);
    this.makeTex();
    this.key = '';
  }
  // lines: [{ t, x, y, s (height fraction), w (max width fraction), c (colour) }]; glow = css colour of the halo; style = TEXT_STYLES index
  draw(lines, glow, font, tracking = 0.04, glowAmt = 1, style = 0) {
    const key = JSON.stringify([lines, glow, font, tracking, glowAmt, style]);
    if (key === this.key) return false;
    this.key = key;
    const { g, canvas: { width: W, height: H } } = this;
    g.clearRect(0, 0, W, H);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    for (const l of lines) {
      let size = H * l.s;
      const setFont = s => { g.font = font.replace('{s}', s); if ('letterSpacing' in g) g.letterSpacing = `${s * tracking}px`; };
      setFont(size);
      const tw = g.measureText(l.t).width;
      if (tw > W * l.w) { size *= W * l.w / tw; setFont(size); }
      const x = W * l.x, y = H * l.y, col = l.c || '#fff';
      g.save();
      (TEXT_DRAW[style] || TEXT_DRAW[0])(g, l.t, x, y, size, col, glow, glowAmt);
      g.restore();
    }
    this.tex.needsUpdate = true;
    return true;
  }
}

// polished-metal fill: bright sky on top, a dark horizon line through the middle, reflected floor below
const METALS = {
  chrome: [[0, '#ffffff'], [0.3, '#d3dae4'], [0.47, '#565c68'], [0.5, '#16181e'], [0.54, '#7d838e'], [0.78, '#f4f6f9'], [1, '#a2a8b2']],
  gold: [[0, '#fff7d6'], [0.28, '#f3d27a'], [0.47, '#9c6a17'], [0.5, '#5a3804'], [0.55, '#c08a2c'], [0.8, '#ffe6a0'], [1, '#b07d26']]
};
function metalText(g, t, x, y, s, glow, glowAmt, stops, edge) {
  const m = g.measureText(t);
  const gr = g.createLinearGradient(0, y - (m.actualBoundingBoxAscent || s * 0.4), 0, y + (m.actualBoundingBoxDescent || s * 0.4));
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  g.shadowColor = glow; g.shadowBlur = s * 0.3 * glowAmt; g.fillStyle = edge; g.fillText(t, x, y);
  g.shadowBlur = 0;
  g.lineWidth = s * 0.045; g.strokeStyle = edge; g.strokeText(t, x, y);
  g.fillStyle = gr; g.fillText(t, x, y);
  g.lineWidth = Math.max(1, s * 0.008); g.strokeStyle = 'rgba(255,255,255,.55)'; g.strokeText(t, x, y - s * 0.004);
}
export const TEXT_STYLES = ['Düz', 'Neon tüp', 'Krom', 'Altın', 'Kontur', '3D blok'];
const TEXT_DRAW = [
  (g, t, x, y, s, col, glow, ga) => {
    g.shadowColor = glow; g.shadowBlur = s * 0.35 * ga; g.fillStyle = col; g.fillText(t, x, y);
    g.shadowBlur = 0; g.fillText(t, x, y);
  },
  // glass tube: wide coloured halo passes, then a hot near-white core
  (g, t, x, y, s, col, glow, ga) => {
    g.strokeStyle = glow; g.shadowColor = glow; g.lineWidth = s * 0.05;
    for (const b of [0.9, 0.45, 0.16]) { g.shadowBlur = s * b * Math.max(0.35, ga); g.strokeText(t, x, y); }
    g.shadowBlur = s * 0.04; g.shadowColor = '#fff'; g.lineWidth = s * 0.02; g.strokeStyle = '#fff6f6'; g.strokeText(t, x, y);
  },
  (g, t, x, y, s, col, glow, ga) => metalText(g, t, x, y, s, glow, ga, METALS.chrome, '#07080b'),
  (g, t, x, y, s, col, glow, ga) => metalText(g, t, x, y, s, glow, ga, METALS.gold, '#1d1000'),
  (g, t, x, y, s, col, glow, ga) => {
    g.shadowColor = glow; g.shadowBlur = s * 0.25 * ga; g.lineWidth = Math.max(1.5, s * 0.022); g.strokeStyle = col; g.strokeText(t, x, y);
    g.shadowBlur = 0; g.strokeText(t, x, y);
  },
  // extruded block letters: stacked copies in the palette colour, shaded darker toward the back
  (g, t, x, y, s, col, glow, ga) => {
    const n = Math.max(6, Math.round(s * 0.07)), dx = 0.7, dy = 1;
    g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = s * 0.12; g.fillStyle = '#000'; g.fillText(t, x + n * dx, y + n * dy);
    g.shadowBlur = 0;
    for (let k = n; k >= 1; k--) {
      g.fillStyle = glow; g.fillText(t, x + k * dx, y + k * dy);
      g.fillStyle = `rgba(0,0,0,${0.15 + 0.55 * k / n})`; g.fillText(t, x + k * dx, y + k * dy);
    }
    g.shadowColor = glow; g.shadowBlur = s * 0.2 * ga; g.fillStyle = col; g.fillText(t, x, y);
  }
];
