import React, { useRef, useEffect } from 'react';

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16) / 255,
    parseInt(clean.slice(2, 4), 16) / 255,
    parseInt(clean.slice(4, 6), 16) / 255,
  ];
}

export const DEFAULT_FLUID_PARAMS = {
  type: 'fluid',
  mouseRadius: 0.09,
  mouseStrength: 1.8,
  mouseSmoothing: 0.1,
  mouseVelocity: 0.2,
  decay: 0.925,
  distortBoost: 2.2,
  noiseBoost: 0.3,
  swirlBoost: 0.8,
  glowIntensity: 0.13,
  glowColors: ['#fff7d1', '#538dca', '#2d448b'],
  speed: 28,
  distortion: 18,
  swirl: 20,
  swirlIterations: 12,
  scale: 1.77,
  rotation: 15,
  proportion: 60,
  softness: 80,
  shapeScale: 0,
  offsetX: -124,
  offsetY: -48,
  grain: 0.005,
  colors: ['#000000', '#1A3870', '#204a7e', '#eed8aa', '#000000'],
  lightX: 0.89,
  lightY: 0.46,
  lightCore: 0.14,
  lightHalo: 0.2,
  vignette: 0.38,
  lightFollow: 0.63,
  bloomThreshold: 0.61,
  bloomRange: 0.18,
  bloomStrength: 0.4,
};

const VERT_SHADER = `#version 300 es
in vec4 a_position;
out vec2 vUv;
void main() {
  vUv = a_position.xy * 0.5 + 0.5;
  gl_Position = a_position;
}
`;

const FRAG_SIM_SHADER = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D u_prev;
uniform vec2 u_mouse;
uniform vec2 u_velocity;
uniform float u_brushRadius;
uniform float u_brushStrength;
uniform float u_decay;
out vec4 fragColor;

void main() {
  vec4 prev = texture(u_prev, vUv);

  prev.r *= u_decay;
  prev.gb = mix(vec2(0.5), prev.gb, u_decay);

  float dist = distance(vUv, u_mouse);

  float influence = exp(-dist * dist / (u_brushRadius * u_brushRadius * 0.5));
  influence = max(0.0, influence - 0.01);

  float speed = length(u_velocity);
  float presenceStrength = u_brushStrength * 0.3;
  float velBonus = min(speed * 3.0, 0.7) * u_brushStrength;
  float totalStrength = presenceStrength + velBonus;

  prev.r = max(prev.r, influence * totalStrength);
  float blendAmt = influence * min(totalStrength, 0.4) * 0.3;
  prev.g = mix(prev.g, clamp(u_velocity.x * 2.0 + 0.5, 0.0, 1.0), blendAmt);
  prev.b = mix(prev.b, clamp(u_velocity.y * 2.0 + 0.5, 0.0, 1.0), blendAmt);

  fragColor = prev;
}
`;

const FRAG_FLUID_SHADER = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec3 u_c1, u_c2, u_c3, u_c4, u_c5;
uniform float u_scale;
uniform vec2 u_offset;
uniform float u_grain;
uniform float u_speed;
uniform sampler2D u_flowmap;
uniform float u_distortBoost;
uniform float u_swirlBoost;
uniform float u_glowIntensity;
uniform vec3 u_glowColor1;
uniform vec3 u_glowColor2;
uniform vec3 u_glowColor3;
uniform vec2 u_lightPos;
uniform float u_lightCore;
uniform float u_lightHalo;
uniform float u_vignette;
uniform float u_bloomThreshold;
uniform float u_bloomRange;
uniform float u_bloomStrength;
out vec4 fragColor;

vec3 mod289v3(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289v4(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289v4(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}

float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);
  const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289v3(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;
  vec4 s1=floor(b1)*2.+1.;
  vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
  m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

float hash(vec2 p){
  vec3 p3=fract(vec3(p.xyx)*.1031);
  p3+=dot(p3,p3.yzx+33.33);
  return fract((p3.x+p3.y)*p3.z);
}

float fbm(vec3 p){
  float v=0.,amp=.6;vec3 shift=vec3(100.);
  for(int i=0;i<1;i++){v+=amp*snoise(p);p=p*2.+shift;amp*=.4;}
  return v;
}

float fluidNoise(vec2 uv,float t){
  float n1=fbm(vec3(uv*.6,t*.06));
  float n2=fbm(vec3(uv*.6+5.2,t*.06+1.3));
  vec2 w1=vec2(n1,n2)*.6;
  float n3=fbm(vec3((uv+w1)*.7+1.7,t*.05+3.1));
  float n4=fbm(vec3((uv+w1)*.7+9.2,t*.05+5.7));
  vec2 w2=vec2(n3,n4)*.5;
  return fbm(vec3((uv+w1+w2)*.5,t*.04));
}

vec2 curlish(vec2 uv,float t){
  float eps=.02;
  float n=snoise(vec3(uv*.8,t));
  float nx=snoise(vec3((uv+vec2(eps,0.))*.8,t));
  float ny=snoise(vec3((uv+vec2(0.,eps))*.8,t));
  return vec2(-(ny-n)/eps,(nx-n)/eps)*.003;
}

void main(){
  float aspect=u_resolution.x/u_resolution.y;
  vec2 uv=gl_FragCoord.xy/u_resolution;
  vec2 suv=vec2(uv.x*aspect, uv.y) * u_scale + u_offset;
  float t=u_time;

  vec4 flow = texture(u_flowmap, uv);
  float influence = flow.r;
  vec2 flowDir = (flow.gb - 0.5) * 2.0;

  suv += flowDir * influence * u_distortBoost * 0.8;
  float swirlAngle = influence * u_swirlBoost * 2.5;
  float cs = cos(swirlAngle), sn = sin(swirlAngle);
  vec2 delta = suv - vec2(uv.x * aspect, uv.y) * u_scale;
  suv += (mat2(cs, sn, -sn, cs) * delta - delta) * influence;

  vec2 curl=curlish(suv,t*.04);
  vec2 uvD=suv+curl*12.;
  float f=fluidNoise(uvD,t);
  float swirl=snoise(vec3(uvD*.8+f*1.5,t*.035))*.5+.5;
  float n=f*.5+.5;
  vec3 col=mix(u_c1,u_c2,smoothstep(.2,.5,n));
  col=mix(col,u_c3,smoothstep(.35,.65,n+swirl*.25));
  col=mix(col,u_c4,smoothstep(.6,.85,swirl)*.55);
  col=mix(col,u_c5,smoothstep(.5,.8,n*swirl)*.35);

  float glow = smoothstep(0.0, 0.8, influence);
  float glowNoise = snoise(vec3(uvD * 1.5, t * 0.08)) * 0.5 + 0.5;
  float glowDist = smoothstep(0.0, 1.0, influence);
  vec3 glowMix = mix(u_glowColor3, u_glowColor2, glowDist);
  glowMix = mix(glowMix, u_glowColor1, glowDist * glowNoise);
  col = mix(col, glowMix, glow * u_glowIntensity);

  if(u_grain>0.0){
    vec2 flowOffset = (uvD - suv) * u_resolution.y;
    vec2 gp = floor((gl_FragCoord.xy + flowOffset) / 5.0);
    float gr=hash(gp)*2.-1.;
    col+=gr*u_grain;
  }

  float luma=dot(col,vec3(.299,.587,.114));
  float bloom=smoothstep(u_bloomThreshold-u_bloomRange,u_bloomThreshold+u_bloomRange,luma);
  col+=(col*.85+vec3(.15,.145,.13))*bloom*u_bloomStrength;

  float ld=length((uv-u_lightPos)*vec2(aspect,1.));
  float core=exp(-ld*ld*4.5);
  float halo=exp(-ld*1.8);
  col+=vec3(1.,.97,.9)*core*u_lightCore+vec3(.72,.8,1.)*halo*u_lightHalo;

  float vig=1.-smoothstep(.35,.75,length(uv-.5));
  col=mix(col*(1.-u_vignette),col,vig);
  fragColor=vec4(col,1.);
}
`;

export default function DeepSeekHeroFluid({ params = DEFAULT_FLUID_PARAMS }) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(0);
  const startTimeRef = useRef(0);
  const mouseState = useRef({
    x: 0.5,
    y: 0.5,
    smoothX: 0.5,
    smoothY: 0.5,
    vx: 0,
    vy: 0,
    svx: 0,
    svy: 0,
  });
  const isVisibleRef = useRef(true);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    });
    if (!gl) return;

    const compileShader = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        return null;
      }
      return shader;
    };

    const createProgram = (fragSource) => {
      const vs = compileShader(gl.VERTEX_SHADER, VERT_SHADER);
      const fs = compileShader(gl.FRAGMENT_SHADER, fragSource);
      if (!vs || !fs) return null;
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(prog));
        return null;
      }
      return prog;
    };

    const simProg = createProgram(FRAG_SIM_SHADER);
    const fluidProg = createProgram(FRAG_FLUID_SHADER);
    if (!simProg || !fluidProg) return;

    const simUniforms = {
      prev: gl.getUniformLocation(simProg, 'u_prev'),
      mouse: gl.getUniformLocation(simProg, 'u_mouse'),
      velocity: gl.getUniformLocation(simProg, 'u_velocity'),
      brushRadius: gl.getUniformLocation(simProg, 'u_brushRadius'),
      brushStrength: gl.getUniformLocation(simProg, 'u_brushStrength'),
      decay: gl.getUniformLocation(simProg, 'u_decay'),
    };

    const fluidUniforms = {
      time: gl.getUniformLocation(fluidProg, 'u_time'),
      resolution: gl.getUniformLocation(fluidProg, 'u_resolution'),
      scale: gl.getUniformLocation(fluidProg, 'u_scale'),
      offset: gl.getUniformLocation(fluidProg, 'u_offset'),
      grain: gl.getUniformLocation(fluidProg, 'u_grain'),
      speed: gl.getUniformLocation(fluidProg, 'u_speed'),
      flowmap: gl.getUniformLocation(fluidProg, 'u_flowmap'),
      distortBoost: gl.getUniformLocation(fluidProg, 'u_distortBoost'),
      swirlBoost: gl.getUniformLocation(fluidProg, 'u_swirlBoost'),
      glowIntensity: gl.getUniformLocation(fluidProg, 'u_glowIntensity'),
      glowColor1: gl.getUniformLocation(fluidProg, 'u_glowColor1'),
      glowColor2: gl.getUniformLocation(fluidProg, 'u_glowColor2'),
      glowColor3: gl.getUniformLocation(fluidProg, 'u_glowColor3'),
      c1: gl.getUniformLocation(fluidProg, 'u_c1'),
      c2: gl.getUniformLocation(fluidProg, 'u_c2'),
      c3: gl.getUniformLocation(fluidProg, 'u_c3'),
      c4: gl.getUniformLocation(fluidProg, 'u_c4'),
      c5: gl.getUniformLocation(fluidProg, 'u_c5'),
      lightPos: gl.getUniformLocation(fluidProg, 'u_lightPos'),
      lightCore: gl.getUniformLocation(fluidProg, 'u_lightCore'),
      lightHalo: gl.getUniformLocation(fluidProg, 'u_lightHalo'),
      vignette: gl.getUniformLocation(fluidProg, 'u_vignette'),
      bloomThreshold: gl.getUniformLocation(fluidProg, 'u_bloomThreshold'),
      bloomRange: gl.getUniformLocation(fluidProg, 'u_bloomRange'),
      bloomStrength: gl.getUniformLocation(fluidProg, 'u_bloomStrength'),
    };

    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const bindQuad = (prog) => {
      const posAttr = gl.getAttribLocation(prog, 'a_position');
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.enableVertexAttribArray(posAttr);
      gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);
    };

    const createFBO = (w, h, data) => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if (data) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      return { fbo, tex };
    };

    let curWidth = 0;
    let curHeight = 0;
    let flowW = 0;
    let flowH = 0;
    let pingPong = false;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    curWidth = Math.round((canvas.clientWidth || window.innerWidth) * dpr);
    curHeight = Math.round((canvas.clientHeight || window.innerHeight) * dpr);
    canvas.width = curWidth;
    canvas.height = curHeight;

    flowW = Math.max(1, Math.round(curWidth / 4));
    flowH = Math.max(1, Math.round(curHeight / 4));

    const initialData = new Uint8Array(flowW * flowH * 4);
    for (let i = 0; i < flowW * flowH; i++) {
      initialData[4 * i] = 0;
      initialData[4 * i + 1] = 128;
      initialData[4 * i + 2] = 128;
      initialData[4 * i + 3] = 255;
    }

    let fboA = createFBO(flowW, flowH, initialData);
    let fboB = createFBO(flowW, flowH, initialData);

    const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseState.current.x = (e.clientX - rect.left) / rect.width;
      mouseState.current.y = 1 - (e.clientY - rect.top) / rect.height;
    };

    if (!isTouch) {
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
    }

    startTimeRef.current = performance.now();
    let lastTime = 0;
    const frameInterval = 1000 / 30;

    const renderLoop = (now) => {
      animFrameRef.current = requestAnimationFrame(renderLoop);
      if (!isVisibleRef.current || now - lastTime < frameInterval) return;
      lastTime = now - ((now - lastTime) % frameInterval);

      const deviceDpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const targetW = Math.round((canvas.clientWidth || window.innerWidth) * deviceDpr);
      const targetH = Math.round((canvas.clientHeight || window.innerHeight) * deviceDpr);

      if (targetW !== curWidth || targetH !== curHeight) {
        curWidth = targetW;
        curHeight = targetH;
        canvas.width = curWidth;
        canvas.height = curHeight;
      }

      const p = paramsRef.current;
      const m = mouseState.current;

      m.smoothX += (m.x - m.smoothX) * p.mouseSmoothing;
      m.smoothY += (m.y - m.smoothY) * p.mouseSmoothing;
      m.svx += ((m.x - m.smoothX) * 0.5 - m.svx) * p.mouseVelocity;
      m.svy += ((m.y - m.smoothY) * 0.5 - m.svy) * p.mouseVelocity;

      const srcFBO = pingPong ? fboA : fboB;
      const dstFBO = pingPong ? fboB : fboA;
      pingPong = !pingPong;

      // Pass 1: Flowmap simulation
      gl.bindFramebuffer(gl.FRAMEBUFFER, dstFBO.fbo);
      gl.viewport(0, 0, flowW, flowH);
      gl.useProgram(simProg);
      bindQuad(simProg);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, srcFBO.tex);
      gl.uniform1i(simUniforms.prev, 0);
      gl.uniform2f(simUniforms.mouse, m.smoothX, m.smoothY);
      gl.uniform2f(simUniforms.velocity, m.svx, m.svy);
      gl.uniform1f(simUniforms.brushRadius, p.mouseRadius);
      gl.uniform1f(simUniforms.brushStrength, !isTouch ? p.mouseStrength : 0);
      gl.uniform1f(simUniforms.decay, p.decay);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // Pass 2: Fluid render to canvas
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, curWidth, curHeight);

      const elapsedTime = (performance.now() - startTimeRef.current) * 0.001 * (p.speed / 100);
      const colors = p.colors || ['#000000', '#1A3870', '#204a7e', '#eed8aa', '#000000'];

      gl.useProgram(fluidProg);
      bindQuad(fluidProg);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, dstFBO.tex);
      gl.uniform1i(fluidUniforms.flowmap, 0);
      gl.uniform1f(fluidUniforms.time, elapsedTime);
      gl.uniform2f(fluidUniforms.resolution, curWidth, curHeight);
      gl.uniform1f(fluidUniforms.scale, p.scale);
      gl.uniform2f(fluidUniforms.offset, p.offsetX / 100, p.offsetY / 100);
      gl.uniform1f(fluidUniforms.grain, p.grain);
      gl.uniform1f(fluidUniforms.distortBoost, p.distortBoost);
      gl.uniform1f(fluidUniforms.swirlBoost, p.swirlBoost);

      const lx = p.lightX ?? 0.89;
      const follow = !isTouch ? (p.lightFollow ?? 0) : 0;
      gl.uniform2f(fluidUniforms.lightPos, lx + (m.smoothX - lx) * follow, p.lightY ?? 0.46);
      gl.uniform1f(fluidUniforms.lightCore, isTouch ? 0 : (p.lightCore ?? 0.14));
      gl.uniform1f(fluidUniforms.lightHalo, isTouch ? 0 : (p.lightHalo ?? 0.2));
      gl.uniform1f(fluidUniforms.vignette, p.vignette ?? 0.38);
      gl.uniform1f(fluidUniforms.bloomThreshold, p.bloomThreshold ?? 0.61);
      gl.uniform1f(fluidUniforms.bloomRange, p.bloomRange ?? 0.18);
      gl.uniform1f(fluidUniforms.bloomStrength, p.bloomStrength ?? 0.4);
      gl.uniform1f(fluidUniforms.glowIntensity, p.glowIntensity);

      const g1 = hexToRgb(p.glowColors[0] || '#ffffff');
      const g2 = hexToRgb(p.glowColors[1] || p.glowColors[0] || '#ffffff');
      const g3 = hexToRgb(p.glowColors[2] || p.glowColors[0] || '#ffffff');
      gl.uniform3f(fluidUniforms.glowColor1, g1[0], g1[1], g1[2]);
      gl.uniform3f(fluidUniforms.glowColor2, g2[0], g2[1], g2[2]);
      gl.uniform3f(fluidUniforms.glowColor3, g3[0], g3[1], g3[2]);

      const cUniforms = [
        fluidUniforms.c1,
        fluidUniforms.c2,
        fluidUniforms.c3,
        fluidUniforms.c4,
        fluidUniforms.c5,
      ];
      for (let i = 0; i < 5; i++) {
        const rgb = hexToRgb(colors[i] || colors[colors.length - 1] || '#000000');
        gl.uniform3f(cUniforms[i], rgb[0], rgb[1], rgb[2]);
      }

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    animFrameRef.current = requestAnimationFrame(renderLoop);

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
      },
      { threshold: 0 }
    );
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (!isTouch) {
        window.removeEventListener('mousemove', handleMouseMove);
      }
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
      }}
    />
  );
}
