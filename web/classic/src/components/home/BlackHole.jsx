import React, { useEffect, useRef } from 'react';

const vertex = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main(){vUv=uv;gl_Position=vec4(position,0.0,1.0);}`;

const fragment = `
precision highp float;
uniform float uTime; uniform vec2 uResolution; uniform vec2 uMouse; uniform vec2 uCenter; uniform float uSeed;
uniform vec3 uTintA; uniform vec3 uTintB; uniform vec3 uTintC; varying vec2 vUv;
const float DISK_IN=2.6; const float DISK_OUT=10.0; const float CAM_DIST=26.0; const float FOCAL=1.4; const int STEPS=110;
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;} vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);} vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod289(i);vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}
float hash21(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
vec4 diskShade(vec3 hit,vec3 rd){float hr=length(hit.xz);float ang=atan(hit.z,hit.x);float omega=2.8*pow(hr,-1.5);float sa=ang+uTime*omega;vec3 np=vec3(cos(sa)*1.15,sin(sa)*1.15,log(hr)*4.6+uSeed);float n=0.52*snoise(np)+0.31*snoise(np*vec3(2.3,2.3,2.7))+0.17*snoise(np*vec3(5.1,5.1,5.6));n=0.5+0.5*n;float streak=0.25+0.75*pow(n,2.2);float clump=smoothstep(0.74,0.95,n);float fade=smoothstep(DISK_IN,DISK_IN+1.0,hr)*(1.0-smoothstep(6.0,DISK_OUT,hr));float density=fade*pow(DISK_IN/hr,1.7);float t=clamp((hr-DISK_IN)/(DISK_OUT-DISK_IN),0.0,1.0);vec3 brand=mix(uTintA,uTintB,0.54+0.46*sin(ang-uTime*0.05));vec3 inner=vec3(1.0,0.97,1.0);vec3 outer=mix(brand,uTintC,0.70);vec3 base=mix(inner,brand,smoothstep(0.02,0.35,t));base=mix(base,outer,smoothstep(0.40,0.95,t));vec3 tangent=normalize(vec3(-hit.z,0.0,hit.x));float dop=dot(tangent,normalize(rd));float beam=pow(clamp(1.0-0.62*dop,0.4,2.2),3.0);base=mix(base,uTintA,clamp(-dop*0.36,0.0,0.36));base=mix(base,mix(uTintB,uTintC,0.35),clamp(dop*0.38,0.0,0.38));float flick=0.93+0.07*sin(uTime*0.9+sin(uTime*0.37)*2.2);float e=density*streak*beam*flick*(1.0+0.9*clump);return vec4(base*e*1.4,clamp(e*1.5,0.0,1.0));}
vec3 starLayer(vec2 sc,float scale,float threshold,float sharp){vec2 cell=floor(sc*scale);vec2 cuv=fract(sc*scale);float sh=hash21(cell+floor(uSeed));vec2 spos=vec2(hash21(cell+7.13),hash21(cell+3.71));float sd=length(cuv-spos);float star=step(threshold,sh)*exp(-sd*sd*sharp);float tw=0.6+0.4*sin(uTime*(0.3+sh*2.0)+sh*41.0);vec3 tintC=mix(uTintA,uTintB,0.15+hash21(cell+11.7)*0.55);tintC=mix(vec3(0.86,0.90,1.0),tintC,0.45);return tintC*star*tw;}
vec3 background(vec3 dir){vec3 d=normalize(dir);vec2 sc=vec2(atan(d.z,d.x)*3.2,asin(clamp(d.y,-1.0,1.0))*6.4);vec3 col=starLayer(sc,14.0,0.92,380.0)*0.6;col+=starLayer(sc+17.3,31.0,0.80,520.0)*0.22;float nn=snoise(d*2.3+uSeed)*0.5+0.5;float nn2=snoise(d*5.9-uSeed)*0.5+0.5;vec3 nebula=mix(uTintA,uTintB,clamp(0.54+0.76*d.x,0.0,1.0));nebula=mix(nebula,uTintC,0.18);col+=nebula*0.050*nn*nn*(0.5+0.5*nn2);return col;}
void main(){float aspect=uResolution.x/max(uResolution.y,1.0);vec2 sp=(vUv-0.5)*vec2(aspect,1.0)-uCenter;float az=uMouse.x*0.20;float el=0.115+uMouse.y*0.05;vec3 ro=CAM_DIST*vec3(cos(el)*sin(az),sin(el),-cos(el)*cos(az));vec3 fwd=normalize(-ro);vec3 right=normalize(cross(fwd,vec3(0.0,1.0,0.0)));vec3 up=cross(right,fwd);vec3 rd=normalize(fwd*FOCAL+right*sp.x+up*sp.y);vec3 pos=ro;float b=dot(ro,rd);float disc=b*b-(dot(ro,ro)-225.0);if(disc>0.0){float tEnter=-b-sqrt(disc);if(tEnter>0.0)pos=ro+rd*tEnter;}vec3 hv=cross(pos,rd);float h2=dot(hv,hv);vec3 vel=rd;vec3 col=vec3(0.0);float through=1.0;bool captured=false;for(int i=0;i<STEPS;i++){float r2=dot(pos,pos);float r=sqrt(r2);if(r<1.0){captured=true;break;}if(r>15.5&&dot(pos,vel)>0.0)break;float dt=clamp(0.30*(r-1.0),0.04,0.8);vel+=(-1.5*h2*pos/(r2*r2*r))*dt;vec3 next=pos+vel*dt;if(pos.y*next.y<0.0){vec3 hit=mix(pos,next,pos.y/(pos.y-next.y));float hr=length(hit.xz);if(hr>DISK_IN&&hr<DISK_OUT){vec4 e=diskShade(hit,vel);col+=e.rgb*through;through*=1.0-e.a;if(through<0.03)break;}}pos=next;}if(!captured)col+=background(vel)*through;vec2 hp=sp*vec2(1.0,1.9);float halo=exp(-length(hp)*3.2)*0.10+exp(-length(hp)*7.5)*0.09;vec3 brandHalo=mix(mix(uTintA,uTintB,0.55),uTintC,0.18);col+=brandHalo*halo*smoothstep(0.10,0.17,length(sp));col=1.0-exp(-col*1.7);col*=0.94+0.12*hash21(gl_FragCoord.xy*0.71);col+=(hash21(gl_FragCoord.xy)-0.5)*0.004;gl_FragColor=vec4(col,1.0);}
`;

export default function BlackHole({ className = '' }) {
  const host = useRef(null);

  useEffect(() => {
    const root = host.current;
    if (!root) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'black-hole-canvas';
    root.appendChild(canvas);

    const gl = canvas.getContext('webgl', {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      powerPreference: 'high-performance',
    });
    if (!gl) return;

    const shader = (type, source) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(s) || 'Shader compilation failed';
        gl.deleteShader(s);
        throw new Error(info);
      }
      return s;
    };

    let program = null;
    let vs = null;
    let fs = null;

    try {
      vs = shader(gl.VERTEX_SHADER, vertex);
      fs = shader(gl.FRAGMENT_SHADER, fragment);
      if (!vs || !fs) return;

      program = gl.createProgram();
      if (!program) return;

      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || 'Program link failed');
      }
    } catch (e) {
      console.warn('BlackHole WebGL init skipped:', e);
      return;
    }

    gl.useProgram(program);

    const bind = (name, data) => {
      const loc = gl.getAttribLocation(program, name);
      if (loc < 0) return;
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    };

    bind('position', [-1, -1, 1, -1, -1, 1, 1, 1]);
    bind('uv', [0, 0, 1, 0, 0, 1, 1, 1]);

    const u = (name) => gl.getUniformLocation(program, name);
    const time = u('uTime');
    const res = u('uResolution');
    const mouse = u('uMouse');
    const center = u('uCenter');

    gl.uniform1f(u('uSeed'), Math.random() * 100);
    gl.uniform3f(u('uTintA'), 0.349, 0.859, 0.933);
    gl.uniform3f(u('uTintB'), 0.988, 0.451, 0.749);
    gl.uniform3f(u('uTintC'), 0.42, 0.298, 1.0);

    let target = { x: 0, y: 0 };
    let current = { x: 0, y: 0 };
    let frame = 0;
    let last = performance.now();
    let elapsed = 0;
    let visible = true;
    const reduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = root.clientWidth || window.innerWidth;
      const h = root.clientHeight || window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(res, canvas.width, canvas.height);

      const isLargeScreen = window.matchMedia ? window.matchMedia('(min-width: 1024px)').matches : false;
      gl.uniform2f(
        center,
        isLargeScreen ? 0.32 : 0.0,
        isLargeScreen ? 0.02 : 0.22
      );
    };

    const render = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += dt;
      current.x += (target.x - current.x) * 0.045;
      current.y += (target.y - current.y) * 0.045;
      gl.uniform1f(time, reduced.matches ? 8 : elapsed);
      gl.uniform2f(mouse, current.x, current.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (visible && !reduced.matches) {
        frame = requestAnimationFrame(render);
      }
    };

    const pointer = (e) => {
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(root);

    const io = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          if (visible) {
            cancelAnimationFrame(frame);
            last = performance.now();
            frame = requestAnimationFrame(render);
          } else {
            cancelAnimationFrame(frame);
          }
        })
      : null;
    if (io) io.observe(root);

    window.addEventListener('pointermove', pointer, { passive: true });
    resize();
    frame = requestAnimationFrame(render);
    canvas.style.opacity = '1';

    return () => {
      cancelAnimationFrame(frame);
      if (ro) ro.disconnect();
      if (io) io.disconnect();
      window.removeEventListener('pointermove', pointer);
      canvas.remove();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  return (
    <div
      ref={host}
      className={`black-hole-stage ${className}`}
      aria-hidden='true'
    />
  );
}
