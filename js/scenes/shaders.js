// Fragment-shader scenes and backgrounds. Each defines vec3 scene(vec2 p) in display space (see SHADER_MAIN).
import { ShaderScene } from '../common.js';

export const BG_DARK = `
vec3 scene(vec2 p){
  float r=length(p);
  vec3 c=RED*0.07*exp(-r*2.2)*(0.5+uBass);
  c+=RED*0.04*smoothstep(0.004,0.0,abs(fract(p.y*2.0-uTime*0.05)-0.5)-0.49)*exp(-r);
  return c;
}`;

export const BG_RAYS = `
vec3 scene(vec2 p){
  float a=atan(p.y,p.x), r=length(p);
  float rays=pow(max(sin(a*14.0+uTime*0.3),0.0),6.0)+0.6*pow(max(sin(a*9.0-uTime*0.2+1.0),0.0),10.0);
  vec3 c=RED*rays*exp(-r*1.3)*(0.25+uBass*0.5);
  c+=RED*0.22*exp(-r*2.5);
  c+=uAccent*0.15*rays*exp(-r*3.0)*(uBeat+uDrop);
  return c;
}`;

export const BG_LASERS = `
vec3 scene(vec2 p){
  vec3 c=vec3(0.02,0.0,0.0);
  for(float i=0.0;i<10.0;i++){
    vec2 o=vec2((i/9.0-0.5)*1.7,-0.6);
    float ang=1.5708+sin(uTime*0.6+i*1.3)*0.65;
    vec2 dir=vec2(cos(ang),sin(ang));
    vec2 d=p-o;
    float along=dot(d,dir);
    float perp=abs(d.x*dir.y-d.y*dir.x);
    float beam=0.0016/(perp+0.0012)*step(0.0,along)*exp(-along*0.9);
    vec3 col=mod(i,2.0)<1.0?RED*1.3:uAccent;
    c+=col*beam*(0.3+uBeat*1.0+uHigh*0.3+uDrop);
  }
  c+=RED*0.25*exp(-(p.y+0.5)*2.5)*(0.4+uBass);
  return c;
}`;

export const BG_STAGE = `
vec3 scene(vec2 p){
  vec3 c=mix(vec3(0.0),RED*0.12,smoothstep(0.6,-0.5,p.y));
  for(float i=0.0;i<4.0;i++){
    vec2 o=vec2((i/3.0-0.5)*1.4,0.62);
    float ang=-1.5708+sin(uTime*0.35+i*2.1)*0.35;
    vec2 dir=vec2(cos(ang),sin(ang));
    vec2 d=p-o;
    float along=max(dot(d,dir),0.0);
    float perp=abs(d.x*dir.y-d.y*dir.x);
    float w=0.02+along*0.18;
    c+=vec3(1.0,0.9,0.85)*smoothstep(w,0.0,perp)*exp(-along*1.2)*0.12*(0.6+uBeat*0.6);
  }
  return c;
}`;

const TUNNEL = `
vec3 scene(vec2 p){
  float a=atan(p.y,p.x)/6.28318;
  float r=length(p)+1e-3;
  float z=0.35/r+uTravel;
  float ring=0.5-abs(fract(z)-0.5);
  float line=smoothstep(0.08,0.0,ring);
  float st=abs(fract(a*10.0+z*0.1)-0.5);
  vec3 col=mod(floor(z+0.5),2.0)<1.0?RED*1.4:uAccent;
  vec3 c=col*line*(1.0+uBeat*2.5)+RED*smoothstep(0.025,0.0,st)*0.4;
  c*=smoothstep(0.05,0.6,r);
  float d=emblemD(p,0.7*(1.0+uBeat*0.06+uDrop*0.2));
  c*=1.0-0.85*smoothstep(0.12,0.0,d);
  c+=vec3(1.15)*smoothstep(0.003,-0.003,d);
  c+=RED*0.012/(abs(d)+0.01)*(0.4+uBass);
  return c;
}`;

const ATA = `
vec3 scene(vec2 p){
  float asp=uRes.x/uRes.y;
  vec2 cp=p-vec2(-asp*0.22,0.0);
  float a=atan(cp.y,cp.x);
  float rays=smoothstep(0.0,0.35,sin(a*12.0+uTime*0.25));
  vec3 c=RED*(0.08+0.14*rays)*exp(-length(cp)*1.1)*(0.8+uBass*0.6)+vec3(0.02,0.0,0.0);
  if(uHasImg>0.5){
    float H=0.98;
    vec2 uv=vec2(cp.x/(H*uImgAsp)+0.5,cp.y/H+0.5);
    float g=max(uBeat*step(0.65,uBeat),uDrop);
    uv.x+=(hash(vec2(floor(uv.y*40.0),floor(uTime*24.0)))-0.5)*0.05*g;
    float sh=0.004+0.012*uBeat;
    vec4 t0=texture2D(uImg,uv);
    float L=dot(t0.rgb,vec3(0.299,0.587,0.114));
    float Lr=dot(texture2D(uImg,uv+vec2(sh,0.0)).rgb,vec3(0.299,0.587,0.114));
    vec3 duo=mix(vec3(0.03,0.0,0.0),RED,smoothstep(0.05,0.45,L));
    duo=mix(duo,vec3(1.1),smoothstep(0.5,0.9,L));
    duo.r=max(duo.r,smoothstep(0.45,0.9,Lr)*1.1);
    duo*=0.88+0.12*sin(gl_FragCoord.y*2.0);
    float m=t0.a*step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0);
    m*=smoothstep(0.0,0.08,uv.x)*smoothstep(1.0,0.92,uv.x)*smoothstep(0.0,0.06,uv.y)*smoothstep(1.0,0.94,uv.y);
    c=mix(c,duo*(0.95+uBeat*0.2),m);
  } else {
    float d=emblemD(cp,0.9*(1.0+uBeat*0.05));
    c+=vec3(1.15)*smoothstep(0.003,-0.003,d)+RED*0.015/(abs(d)+0.01);
  }
  return c;
}`;

const FIREWORKS = `
vec3 scene(vec2 p){
  vec3 c=vec3(0.01,0.0,0.015)+RED*0.15*exp(-(p.y+0.5)*3.0)*(0.6+uBass*0.6);
  for(float i=0.0;i<5.0;i++){
    float tt=uTime*0.32+hash(vec2(i,1.7));
    float id=floor(tt); float t=fract(tt);
    vec2 ctr=vec2(hash(vec2(id,i))*1.3-0.65,hash(vec2(i,id+3.1))*0.35+0.02);
    float k=hash(vec2(id*1.7,i*2.3));
    vec3 col=k<0.45?RED*1.5:(k<0.8?vec3(1.2):uAccent*1.2);
    float rad=(1.0-pow(1.0-t,3.0))*(0.25+0.15*k);
    float fade=pow(1.0-t,1.5);
    for(float j=0.0;j<28.0;j++){
      float ang=j/28.0*6.28318+hash(vec2(j,id+i))*0.2;
      vec2 pos=ctr+vec2(cos(ang),sin(ang))*rad*(0.8+0.2*hash(vec2(j,i)))-vec2(0.0,t*t*0.12);
      vec2 d=p-pos;
      c+=col*0.00002/(dot(d,d)+0.00004)*fade;
    }
    c+=col*0.02/(length(p-ctr)+0.02)*pow(1.0-t,6.0);
  }
  return c*(1.0+uBeat*0.5+uDrop);
}`;

export const tunnelScene = ctx => new ShaderScene(ctx, { key: 'tunnel', name: 'Ay Yıldız Tünel', energy: 'high', textPos: [0.5, 0.88, 0.8], src: TUNNEL });
export const ataScene = ctx => new ShaderScene(ctx, {
  key: 'ata', name: 'Atatürk', energy: 'low', textPos: [0.72, 0.5, 0.44], src: ATA,
  extraText: () => [{ t: 'MUSTAFA KEMAL ATATÜRK', x: 0.72, y: 0.66, s: 0.04, w: 0.44 }]
});
export const fireworksScene = ctx => new ShaderScene(ctx, { key: 'fireworks', name: 'Havai Fişek', energy: 'mid', textPos: [0.5, 0.82, 0.8], src: FIREWORKS });
