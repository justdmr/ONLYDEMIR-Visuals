// More fragment-shader scenes: raymarched chrome and tunnels, equaliser styles, digital rain, synthwave, lasers.
import { ShaderScene } from '../common.js';

const UTIL = `
vec2 rot(vec2 v,float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c)*v; }
float smin(float a,float b,float k){ float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0); return mix(b,a,h)-k*h*(1.0-h); }
float specAt(float x){ return texture2D(uSpec,vec2(clamp(x,0.0,1.0),0.5)).r; }
`;

const LIQUID = UTIL + `
float map(vec3 p){
  float t=uTime*0.6;
  p.xz=rot(p.xz,t*0.4); p.xy=rot(p.xy,t*0.23);
  float d=length(p)-1.0-uBass*0.12;
  d+=sin(p.x*3.0+t*2.0)*sin(p.y*3.2+t*1.6)*sin(p.z*2.8+t*1.2)*(0.07+uBass*0.22+uDrop*0.3);
  for(float i=0.0;i<5.0;i++){
    vec3 c=vec3(sin(t*0.9+i*1.7)*1.7,cos(t*0.7+i*2.3)*1.1,sin(t*0.5+i*1.1)*1.3);
    d=smin(d,length(p-c)-0.28-uBeat*0.08,0.55);
  }
  return d;
}
vec3 envc(vec3 r){
  float a=atan(r.z,r.x);
  vec3 c=mix(vec3(0.02,0.0,0.01),vec3(0.75),smoothstep(0.1,0.95,r.y));
  c+=vec3(1.4)*smoothstep(0.96,1.0,sin(a*3.0+uTime*0.2))*smoothstep(-0.1,0.5,r.y);
  c+=RED*2.2*smoothstep(0.8,1.0,sin(r.y*7.0-uTime*1.5))*smoothstep(0.4,-0.4,r.y);
  c+=uAccent*1.5*smoothstep(0.985,1.0,sin(a*7.0-uTime))*smoothstep(-0.6,0.0,r.y)*smoothstep(0.4,0.0,r.y);
  return c;
}
vec3 scene(vec2 p){
  vec3 ro=vec3(0.0,0.0,4.6), rd=normalize(vec3(p,-1.7));
  float t=0.0, d=1.0;
  for(int i=0;i<90;i++){ d=map(ro+rd*t); if(d<0.001||t>9.0) break; t+=d*0.85; }
  vec3 c=RED*0.1*exp(-length(p)*2.0)*(0.6+uBass);
  if(d<0.01){
    vec3 pos=ro+rd*t;
    vec2 e=vec2(0.0015,-0.0015);
    vec3 n=normalize(e.xyy*map(pos+e.xyy)+e.yyx*map(pos+e.yyx)+e.yxy*map(pos+e.yxy)+e.xxx*map(pos+e.xxx));
    float fr=pow(1.0-max(dot(-rd,n),0.0),3.0);
    c=envc(reflect(rd,n))*(0.55+0.45*fr)+RED*fr*(0.6+uBeat*1.5);
  }
  return c;
}`;

const FRACTAL = UTIL + `
float sdBoxFrame(vec3 p,vec3 b,float e){
  p=abs(p)-b; vec3 q=abs(p+e)-e;
  return min(min(
    length(max(vec3(p.x,q.y,q.z),0.0))+min(max(p.x,max(q.y,q.z)),0.0),
    length(max(vec3(q.x,p.y,q.z),0.0))+min(max(q.x,max(p.y,q.z)),0.0)),
    length(max(vec3(q.x,q.y,p.z),0.0))+min(max(q.x,max(q.y,p.z)),0.0));
}
vec3 scene(vec2 p){
  vec3 rd=normalize(vec3(p,-1.1));
  rd.xy=rot(rd.xy,uTime*0.08);
  float t=0.1; vec3 glow=vec3(0.0);
  for(int i=0;i<96;i++){
    vec3 q=rd*t;
    q.z-=uTravel*3.0;
    float id=floor(q.z/2.0+0.5);
    q.z-=id*2.0;
    q.xy=rot(q.xy,id*0.3+uTime*0.15);
    float s=1.0+0.18*sin(id*1.3+uTime);
    float d=sdBoxFrame(q,vec3(1.7*s,1.0*s,0.03),0.03);
    vec3 col=mod(id,2.0)<1.0?RED*1.2:uAccent;
    glow+=col*0.0016/(0.0025+abs(d))*exp(-t*0.07);
    t+=max(abs(d)*0.6,0.03);
    if(t>36.0) break;
  }
  return glow*(0.45+uBeat*0.8+uDrop);
}`;

const RADIAL = `
vec3 scene(vec2 p){
  float a=atan(p.y,p.x), r=length(p);
  float x=abs(fract(a/6.2831853+0.25)-0.5)*2.0;
  float N=90.0, id=floor(x*N), fx=fract(x*N);
  float s=texture2D(uSpec,vec2((id+0.5)/N*0.8,0.5)).r;
  float r0=0.24+uBass*0.035+uDrop*0.05;
  float h=0.02+s*0.32;
  float m=smoothstep(0.1,0.2,fx)*smoothstep(0.9,0.8,fx);
  vec3 col=mix(RED*1.3,uAccent*1.2,clamp((r-r0)/0.3,0.0,1.0));
  vec3 c=col*step(r0,r)*step(r,r0+h)*m;
  c+=col*exp(-abs(r-r0-h)*70.0)*m*0.8;
  c+=RED*0.6*step(r0-s*0.08-0.012,r)*step(r,r0-0.012)*m;
  c+=RED*exp(-abs(r-r0+0.005)*400.0)*1.5;
  c+=uAccent*exp(-abs(r-(r0+0.42+uBass*0.05))*300.0)*0.5;
  c+=uAccent*step(0.75,fract(a*40.0/6.2831853+uTime*0.15))*exp(-abs(r-0.64)*350.0);
  c*=1.0-0.85*smoothstep(r0,r0-0.03,r);
  float d=emblemD(p,0.3*(1.0+uBeat*0.08));
  c+=vec3(1.15)*smoothstep(0.003,-0.003,d)+RED*0.006/(abs(d)+0.008)*(0.5+uBass);
  c+=RED*0.12*exp(-r*3.0)*(uBass+uBeat);
  return c;
}`;

const LED = `
vec3 scene(vec2 p){
  vec2 grid=vec2(64.0,36.0);
  vec2 cell=floor(vUv*grid), f=fract(vUv*grid)-0.5;
  float led=smoothstep(0.42,0.28,length(f));
  float x=abs(cell.x+0.5-grid.x*0.5)/(grid.x*0.5);
  float s=texture2D(uSpec,vec2(x*0.85,0.5)).r;
  float yy=abs(cell.y+0.5-grid.y*0.5);
  float lvl=yy/(grid.y*0.5);
  float on=step(yy,s*grid.y*0.5);
  float peak=step(abs(yy-floor(s*grid.y*0.5+1.0)),0.5);
  vec3 col=mix(RED*1.4,uAccent*1.3,smoothstep(0.45,0.95,lvl));
  vec3 c=mix(vec3(0.035,0.012,0.015),col,on)*led;
  c+=uAccent*peak*led*0.9;
  c+=col*led*0.2*exp(-abs(vUv.y-fract(uTime*0.4))*25.0)*(1.0-on);
  return c*(1.0+uBeat*0.4);
}`;

const SCOPE = `
vec3 scene(vec2 p){
  vec3 c=RED*0.05*(step(0.985,fract(p.x*8.0))+step(0.985,fract(p.y*8.0)));
  float a=atan(p.y,p.x), r=length(p);
  float w=texture2D(uWave,vec2(fract(a/6.2831853+0.5),0.5)).r-0.5;
  float R=0.27+w*0.3+uBass*0.03;
  float d=abs(r-R);
  c+=uAccent*exp(-d*450.0)*1.6+RED*exp(-d*45.0)*0.7;
  for(float i=0.0;i<3.0;i++){
    float wv=texture2D(uWave,vec2(fract(vUv.x+i*0.17),0.5)).r-0.5;
    float y=(i-1.0)*0.33+wv*0.4;
    float dd=abs(p.y-y);
    vec3 col=i==1.0?uAccent:RED*1.3;
    c+=col*(exp(-dd*500.0)*1.3+exp(-dd*40.0)*0.22);
  }
  float e=emblemD(p,0.22*(1.0+uBeat*0.1));
  c+=vec3(1.1)*smoothstep(0.003,-0.003,e);
  return c*(1.0+uDrop);
}`;

const RAIN = `
vec3 scene(vec2 p){
  float asp=uRes.x/uRes.y;
  vec2 g=vec2(38.0,floor(38.0/asp*1.25));
  vec2 cell=floor(vUv*g), f=fract(vUv*g);
  float sp=0.3+hash(vec2(cell.x,1.0))*0.9;
  float head=fract(uTime*sp*0.3+hash(vec2(cell.x,7.0)));
  float y=1.0-(cell.y+0.5)/g.y;
  float dist=head-y; if(dist<0.0) dist+=1.0;
  float trail=exp(-dist*6.0*(1.0+hash(vec2(cell.x,3.0))));
  float ch=floor(hash(cell+floor(uTime*(2.0+sp*6.0)))*19.0);
  float gl=texture2D(uGlyph,vec2((ch+f.x)/19.0,f.y)).a;
  vec3 col=mix(RED*1.3,uAccent*1.5,smoothstep(0.035,0.0,dist));
  vec3 c=col*gl*trail*(1.3+uBeat*0.8);
  float d=emblemD(p,0.55*(1.0+uBeat*0.05));
  c*=1.0-0.9*smoothstep(0.05,0.0,d);
  c+=RED*0.01/(abs(d)+0.01)*(0.4+uBass);
  return c;
}`;

const SYNTH = `
vec3 scene(vec2 p){
  float h=-0.08;
  vec3 c;
  if(p.y>h){
    c=mix(RED*0.3,vec3(0.01,0.0,0.04),clamp((p.y-h)*1.8,0.0,1.0));
    c+=vec3(0.8,0.8,1.0)*step(0.997,hash(floor(p*260.0)))*smoothstep(0.1,0.3,p.y-h)*(0.6+uHigh);
    vec2 sc=vec2(0.0,0.18); float sr=0.3+uBass*0.035;
    float d=length(p-sc);
    vec3 sun=mix(RED*1.1,uAccent,clamp((p.y-sc.y+sr)/(2.0*sr),0.0,1.0));
    float k=fract(p.y*22.0-uTime*0.6);
    float gap=clamp((sc.y-p.y)/sr,0.0,1.0)*0.7;
    c+=sun*smoothstep(sr,sr-0.004,d)*step(gap,k);
    c+=sun*0.35*exp(-max(d-sr,0.0)*7.0)*(0.7+uBeat*0.8)*smoothstep(sr-0.01,sr,d);
    float mx=p.x*3.0;
    float mtn=h+0.06+0.05*sin(mx*1.7)+0.03*sin(mx*4.3+1.0)+0.02*sin(mx*9.1);
    c=mix(c,vec3(0.02,0.0,0.03)+RED*0.05,step(p.y,mtn));
  } else {
    float z=0.22/(h-p.y+0.002);
    vec2 g=vec2(p.x*z*1.6,z+uTravel*1.5);
    vec2 gf=0.5-abs(fract(g)-0.5);
    float w=0.012*z;
    float line=max(smoothstep(w,0.0,gf.x),smoothstep(w,0.0,gf.y));
    vec3 lc=mix(RED*1.2,uAccent,clamp(-p.y*1.5+uMid*0.5,0.0,1.0));
    c=vec3(0.03,0.0,0.05)+lc*line*exp(-z*0.12)*(1.0+uBeat*1.5);
  }
  c+=RED*exp(-abs(p.y-h)*35.0)*(0.5+uBass*0.5);
  return c;
}`;

const LASERS = `
float beam(vec2 p,vec2 o,float ang,float w){
  vec2 dir=vec2(cos(ang),sin(ang)), d=p-o;
  float along=dot(d,dir);
  float perp=abs(d.x*dir.y-d.y*dir.x);
  return w/(perp+w*0.75)*step(0.0,along)*exp(-along*0.45);
}
vec3 scene(vec2 p){
  float asp=uRes.x/uRes.y;
  vec3 c=vec3(0.0);
  float open=0.55+0.45*sin(uTime*0.6);
  for(float i=0.0;i<15.0;i++){
    float a=-1.5708+(i/14.0-0.5)*2.4*open+sin(uTime*1.1+i*0.7)*0.06*(1.0+uMid);
    c+=(mod(i,2.0)<1.0?RED*1.5:uAccent)*beam(p,vec2(0.0,0.62),a,0.0022);
  }
  for(float i=0.0;i<6.0;i++){
    float s=i<3.0?-1.0:1.0;
    float a=1.5708+s*(0.35+0.25*sin(uTime*0.8+i*1.9));
    c+=RED*1.5*beam(p,vec2(s*asp*0.5,-0.55),a,0.0026);
  }
  float smoke=0.65+0.35*sin(p.x*3.0+uTime*0.4)*sin(p.y*5.0-uTime*0.3);
  c*=smoke*(0.75+uBeat*1.2+uHigh*0.4+uDrop);
  c+=RED*0.12*exp(-length(p-vec2(0.0,0.62))*2.5);
  return c;
}`;

export const liquidScene = ctx => new ShaderScene(ctx, { key: 'liquid', cat: 'psy', name: 'Sıvı Krom', energy: 'low', textPos: [0.5, 0.88, 0.8], src: LIQUID });
export const fractalScene = ctx => new ShaderScene(ctx, { key: 'fractal', cat: 'psy', name: 'Fraktal Tünel', energy: 'high', textPos: [0.5, 0.5, 0.7], src: FRACTAL });
export const radialScene = ctx => new ShaderScene(ctx, { key: 'radial', cat: 'eq', name: 'Radyal EQ', energy: 'high', textPos: [0.5, 0.9, 0.6], src: RADIAL });
export const ledScene = ctx => new ShaderScene(ctx, { key: 'led', cat: 'eq', name: 'LED Duvar', energy: 'high', textPos: [0.5, 0.5, 0.8], src: LED });
export const scopeScene = ctx => new ShaderScene(ctx, { key: 'scope', cat: 'eq', name: 'Osiloskop', energy: 'mid', textPos: [0.5, 0.9, 0.6], src: SCOPE });
export const rainScene = ctx => new ShaderScene(ctx, { key: 'rain', cat: 'psy', name: 'Dijital Yağmur', energy: 'mid', textPos: [0.5, 0.85, 0.7], src: RAIN });
export const synthScene = ctx => new ShaderScene(ctx, { key: 'synth', cat: 'psy', name: 'Synthwave', energy: 'low', textPos: [0.5, 0.7, 0.7], src: SYNTH });
export const laserScene = ctx => new ShaderScene(ctx, { key: 'lasers', cat: 'psy', name: 'Lazer Şov', energy: 'high', textPos: [0.5, 0.86, 0.7], src: LASERS });
