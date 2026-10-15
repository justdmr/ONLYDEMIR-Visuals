// Post pipeline: scene A/B -> compose (transition, mirror, punch/shake, EQ overlay, text) -> trails -> bloom -> final (glitch, RGB, grade, grain, sRGB)
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
    uTextAlpha: { value: 0 }, uTextScale: { value: 1 }, uTextCenter: { value: new THREE.Vector2(0.5, 0.5) }, uTextGlitch: { value: 0 }
  },
  vertexShader: VERT,
  fragmentShader: `
uniform sampler2D tA, tB, tText, uSpec, uWave;
uniform float uMix, uTrans, uTime, uMirror, uAspect, uPunch, uEQ, uEQSize, uBass, uTextAlpha, uTextScale, uTextGlitch;
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
  vec2 tuv=(vUv-uTextCenter)/uTextScale+uTextCenter;
  float row=floor(tuv.y*28.0);
  float tear=uTextGlitch*step(0.55,hash(vec2(row,floor(uTime*18.0))));
  tuv.x+=(hash(vec2(row,floor(uTime*24.0)))-0.5)*0.14*tear;
  vec4 t=texture2D(tText,tuv);
  float ghost=texture2D(tText,tuv+vec2(0.008,0.002)*uTextGlitch).a;
  c=mix(c,t.rgb*1.3,t.a*uTextAlpha);
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

export class Compositor {
  constructor(renderer) {
    this.renderer = renderer;
    const opts = { type: THREE.HalfFloatType, samples: 4 };
    this.rtA = new THREE.WebGLRenderTarget(1, 1, opts);
    this.rtB = new THREE.WebGLRenderTarget(1, 1, opts);
    this.composer = new EffectComposer(renderer);
    this.compose = new ShaderPass(ComposeShader);
    this.feedback = new FeedbackPass();
    this.feedback.enabled = false;
    this.trails = new AfterimagePass(0.88);
    this.trails.enabled = false;
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.25, 0.45, 0.85);
    this.final = new ShaderPass(FinalShader);
    [this.compose, this.feedback, this.trails, this.bloom, this.final].forEach(p => this.composer.addPass(p));
  }
  setSize(w, h, pr) {
    this.rtA.setSize(w * pr, h * pr);
    this.rtB.setSize(w * pr, h * pr);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.compose.uniforms.uAspect.value = w / h;
    this.final.uniforms.uRes.value.set(w * pr, h * pr);
  }
  render(a, b, dt) {
    const r = this.renderer;
    r.setRenderTarget(this.rtA); r.clear(); a.render(r);
    if (b) { r.setRenderTarget(this.rtB); r.clear(); b.render(r); }
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
  // lines: [{ t, x, y, s (height fraction), w (max width fraction), c (colour) }]; glow = css colour of the halo
  draw(lines, glow, font, tracking = 0.04, glowAmt = 1) {
    const key = JSON.stringify([lines, glow, font, tracking, glowAmt]);
    if (key === this.key) return false;
    this.key = key;
    const { g, canvas: { width: W, height: H } } = this;
    g.clearRect(0, 0, W, H);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const l of lines) {
      let size = H * l.s;
      const setFont = s => { g.font = font.replace('{s}', s); if ('letterSpacing' in g) g.letterSpacing = `${s * tracking}px`; };
      setFont(size);
      const tw = g.measureText(l.t).width;
      if (tw > W * l.w) { size *= W * l.w / tw; setFont(size); }
      g.shadowColor = glow;
      g.shadowBlur = size * 0.35 * glowAmt;
      g.fillStyle = l.c || '#fff';
      g.fillText(l.t, W * l.x, H * l.y);
      g.shadowBlur = 0;
      g.fillText(l.t, W * l.x, H * l.y);
    }
    this.tex.needsUpdate = true;
    return true;
  }
}
