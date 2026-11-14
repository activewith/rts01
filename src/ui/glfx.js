// glfx.js — WebGL 후처리(화면 전용). 2D로 그린 전장 그림을 받아 조명·빛 번짐·안개·구름 그림자·충격파 굴절·색 보정을 입힌다.
// 게임 상태는 읽지도 바꾸지도 않는다. render.js가 넘겨 주는 그림·빛 목록·안개 배열만 쓴다.
// WebGL이 없거나 컨텍스트를 잃으면 ok=false가 되고 render.js는 예전처럼 2D로만 그린다.
RTS.GLFX = function (stage, before) {
  const cv = document.createElement('canvas'); cv.className = 'k-gl'; cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
  let gl = null; try { gl = cv.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' }); } catch (e) { gl = null; }
  if (!gl) return null;
  stage.insertBefore(cv, before);
  const F = { ok: true, canvas: cv, low: false };
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); F.ok = false; cv.style.display = 'none'; });
  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const LVS = 'attribute vec2 p;attribute vec2 q;attribute vec3 c;uniform vec2 res;varying vec2 v;varying vec3 k;void main(){v=q;k=c;gl_Position=vec4(p/res*2.-1.,0.,1.);gl_Position.y=-gl_Position.y;}';
  const LFS = 'precision mediump float;varying vec2 v;varying vec3 k;void main(){float d=dot(v,v);float a=max(0.,1.-d);a*=a;gl_FragColor=vec4(k*a,1.);}';
  const NOISE = 'float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}'
    + 'float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}'
    + 'float fbm(vec2 p){return vn(p)*.55+vn(p*2.07+7.1)*.3+vn(p*4.13-3.7)*.15;}';
  // 밝은 부분 추출(절반 크기): 조명을 입힌 색에서 문턱을 넘는 만큼
  const BFS = 'precision mediump float;uniform sampler2D sc,li;uniform vec2 res;void main(){vec2 u=gl_FragCoord.xy/res;vec3 s=texture2D(sc,vec2(u.x,1.-u.y)).rgb;vec3 l=texture2D(li,u).rgb*2.;'
    + 'vec3 c=s*l;float m=max(s.r,max(s.g,s.b));c=mix(c,max(c,s*1.15),smoothstep(.78,.98,m));gl_FragColor=vec4(max(c-.72,0.)*1.3,1.);}';
  const BLUR = 'precision mediump float;uniform sampler2D t;uniform vec2 res,dir;void main(){vec2 u=gl_FragCoord.xy/res;vec3 c=texture2D(t,u).rgb*.227;'
    + 'c+=(texture2D(t,u+dir*1.385/res).rgb+texture2D(t,u-dir*1.385/res).rgb)*.316;c+=(texture2D(t,u+dir*3.231/res).rgb+texture2D(t,u-dir*3.231/res).rgb)*.07;gl_FragColor=vec4(c,1.);}';
  const FFS = 'precision highp float;uniform sampler2D sc,li,bl,fg;uniform vec2 res,map,shk;uniform vec3 cam,tint;uniform float tm,fogOn,bloomOn,cloud,ns;uniform vec4 sh[6];' + NOISE
    + 'void main(){vec2 sp=vec2(gl_FragCoord.x,res.y-gl_FragCoord.y);vec2 q=sp;'
    + 'for(int i=0;i<6;i++){if(float(i)>=ns)break;vec2 d=sp-sh[i].xy;float L=length(d)+.001;float w=(L-sh[i].z)/max(6.,sh[i].z*.18);q-=d/L*sh[i].w*exp(-w*w);}'
    + 'vec2 u=q/res;vec3 s=texture2D(sc,u).rgb;vec2 gu=vec2(gl_FragCoord.x,gl_FragCoord.y)/res;vec3 l=texture2D(li,gu).rgb*2.;'
    + 'vec3 c=s*l;float m=max(s.r,max(s.g,s.b));c=mix(c,max(c,s),smoothstep(.75,.98,m)*.8);'
    + 'vec2 w=(sp-shk)/cam.z+cam.xy;bool inMap=w.x>=0.&&w.y>=0.&&w.x<map.x&&w.y<map.y;'
    + 'if(cloud>0.&&inMap){float cs=smoothstep(.42,.78,fbm(w/700.+vec2(tm*.011,tm*.004)));c*=1.-.2*cs*cloud;}'
    + 'if(bloomOn>0.)c+=texture2D(bl,gu).rgb*.8;'
    + 'if(fogOn>0.&&inMap){vec2 t=w/32.;vec2 px=1./(map/32.);float f=0.;'
    + 'f+=texture2D(fg,(t+vec2(-.35,-.35))*px).r;f+=texture2D(fg,(t+vec2(.35,-.35))*px).r;f+=texture2D(fg,(t+vec2(-.35,.35))*px).r;f+=texture2D(fg,(t+vec2(.35,.35))*px).r;f*=.25;'
    + 'float n=fbm(w/160.+vec2(tm*.02,-tm*.013));f=clamp(f+(n-.5)*.18*smoothstep(.1,.5,f),0.,1.);'
    + 'float seen=smoothstep(.06,.5,f),un=smoothstep(.62,.93,f);float g=dot(c,vec3(.3,.59,.11));c=mix(c,vec3(g)*vec3(.36,.4,.5),seen*.85);'
    + 'vec3 cl=vec3(.025,.035,.06)+vec3(.05,.06,.085)*fbm(w/90.+vec2(-tm*.03,tm*.017));c=mix(c,cl,un*.97);}'
    + 'if(!inMap)c=vec3(.035,.05,.08);'
    + 'c*=tint;c=mix(c,.8+(1.-exp(-(c-.8)*5.))*.2,step(.8,c));c=clamp(c,0.,1.);c=mix(c,c*c*(3.-2.*c),.28);float g2=dot(c,vec3(.3,.59,.11));c=mix(vec3(g2),c,1.15);'
    + 'vec2 vu=gl_FragCoord.xy/res-.5;c*=1.-.38*pow(length(vu*vec2(1.,.8))*1.25,2.4);c+=(h21(gl_FragCoord.xy+fract(tm)*91.)-.5)*.018;'
    + 'gl_FragColor=vec4(clamp(c,0.,1.),1.);}';
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function prog(vs, fs) { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); const U = {}; p.U = n => U[n] ?? (U[n] = gl.getUniformLocation(p, n)); return p; }
  let P; try { P = { light: prog(LVS, LFS), bright: prog(VS, BFS), blur: prog(VS, BLUR), fin: prog(VS, FFS) }; }
  catch (e) { console.warn('GLFX', e.message); cv.remove(); return null; }
  const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const lbuf = gl.createBuffer(); let larr = new Float32Array(7 * 6 * 256);
  function tex(filter) { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; }
  function target(w, h) { const t = tex(gl.LINEAR); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return { t, f, w, h }; }
  const scene = tex(gl.LINEAR), fogT = tex(gl.LINEAR); let T = null, fogV = -1, fogW = 0, fogH = 0;
  function sizeTo(W, H) { if (cv.width === W && cv.height === H && T) return; cv.width = W; cv.height = H;
    if (T) for (const k in T) { gl.deleteTexture(T[k].t); gl.deleteFramebuffer(T[k].f); }
    const hw = Math.max(1, W >> 1), hh = Math.max(1, H >> 1), qw = Math.max(1, W >> 2), qh = Math.max(1, H >> 2);
    T = { light: target(hw, hh), half: target(hw, hh), b1: target(qw, qh), b2: target(qw, qh) }; }
  function draw(p) { gl.bindBuffer(gl.ARRAY_BUFFER, quad); const a = gl.getAttribLocation(p, 'p'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLES, 0, 6); gl.disableVertexAttribArray(a); }
  function bind(p, name, unit, t) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(p.U(name), unit); }
  // o: { src(2D 캔버스), lights:[x,y,r,R,G,B,...](화면 px), amb:[r,g,b], tint, cam, shake, map:[w,h], fog:{data,w,h,v}|null, shocks:[[x,y,r,s]], time, clouds }
  F.render = function (o) {
    if (!F.ok || gl.isContextLost()) return false;
    const W = o.src.width, H = o.src.height; sizeTo(W, H);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    gl.bindTexture(gl.TEXTURE_2D, scene); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, o.src);
    if (o.fog && (o.fog.v !== fogV || o.fog.w !== fogW)) { fogV = o.fog.v; fogW = o.fog.w; fogH = o.fog.h; gl.bindTexture(gl.TEXTURE_2D, fogT); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, fogW, fogH, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, o.fog.data); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4); }
    // 1) 빛 지도(절반 크기): 주변광으로 지우고 빛마다 사각형을 더한다. 값은 절반으로 저장(최대 2배 밝기)
    const L = T.light; gl.bindFramebuffer(gl.FRAMEBUFFER, L.f); gl.viewport(0, 0, L.w, L.h);
    gl.clearColor(o.amb[0] / 2, o.amb[1] / 2, o.amb[2] / 2, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    const n = o.lights.length / 6 | 0;
    if (n) { if (larr.length < n * 42) larr = new Float32Array(n * 42 * 2); let j = 0; const k = L.w / W;
      for (let i = 0; i < n; i++) { const b = i * 6, x = o.lights[b] * k, y = o.lights[b + 1] * k, r = o.lights[b + 2] * k, cr = o.lights[b + 3] / 2, cg = o.lights[b + 4] / 2, cb = o.lights[b + 5] / 2;
        for (const [qx, qy] of [[-1, -1], [1, -1], [-1, 1], [-1, 1], [1, -1], [1, 1]]) { larr[j++] = x + qx * r; larr[j++] = y + qy * r; larr[j++] = qx; larr[j++] = qy; larr[j++] = cr; larr[j++] = cg; larr[j++] = cb; } }
      const p = P.light; gl.useProgram(p); gl.uniform2f(p.U('res'), L.w, L.h); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.bindBuffer(gl.ARRAY_BUFFER, lbuf); gl.bufferData(gl.ARRAY_BUFFER, larr.subarray(0, j), gl.STREAM_DRAW);
      const ap = gl.getAttribLocation(p, 'p'), aq = gl.getAttribLocation(p, 'q'), ac = gl.getAttribLocation(p, 'c');
      gl.enableVertexAttribArray(ap); gl.enableVertexAttribArray(aq); gl.enableVertexAttribArray(ac);
      gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 28, 0); gl.vertexAttribPointer(aq, 2, gl.FLOAT, false, 28, 8); gl.vertexAttribPointer(ac, 3, gl.FLOAT, false, 28, 16);
      gl.drawArrays(gl.TRIANGLES, 0, n * 6); gl.disableVertexAttribArray(ap); gl.disableVertexAttribArray(aq); gl.disableVertexAttribArray(ac); gl.disable(gl.BLEND); }
    // 2) 빛 번짐: 밝은 부분(절반) → 가로·세로 흐림(4분의 1) 두 번
    const bloom = !F.low && o.bloom !== false;
    if (bloom) { let p = P.bright; gl.useProgram(p); gl.bindFramebuffer(gl.FRAMEBUFFER, T.half.f); gl.viewport(0, 0, T.half.w, T.half.h); gl.uniform2f(p.U('res'), T.half.w, T.half.h); bind(p, 'sc', 0, scene); bind(p, 'li', 1, L.t); draw(p);
      p = P.blur; gl.useProgram(p); gl.uniform2f(p.U('res'), T.b1.w, T.b1.h); let src = T.half.t;
      for (let it = 0; it < 2; it++) { gl.bindFramebuffer(gl.FRAMEBUFFER, T.b1.f); gl.viewport(0, 0, T.b1.w, T.b1.h); bind(p, 't', 0, src); gl.uniform2f(p.U('dir'), 1 + it, 0); draw(p);
        gl.bindFramebuffer(gl.FRAMEBUFFER, T.b2.f); bind(p, 't', 0, T.b1.t); gl.uniform2f(p.U('dir'), 0, 1 + it); draw(p); src = T.b2.t; } }
    // 3) 최종 합성
    const p = P.fin; gl.useProgram(p); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    bind(p, 'sc', 0, scene); bind(p, 'li', 1, L.t); bind(p, 'bl', 2, T.b2.t); bind(p, 'fg', 3, fogT);
    gl.uniform2f(p.U('res'), W, H); gl.uniform2f(p.U('map'), o.map[0], o.map[1]); gl.uniform2f(p.U('shk'), o.shake[0], o.shake[1]);
    gl.uniform3f(p.U('cam'), o.cam.x, o.cam.y, o.cam.z); gl.uniform3f(p.U('tint'), o.tint[0], o.tint[1], o.tint[2]);
    gl.uniform1f(p.U('tm'), o.time); gl.uniform1f(p.U('fogOn'), o.fog ? 1 : 0); gl.uniform1f(p.U('bloomOn'), bloom ? 1 : 0); gl.uniform1f(p.U('cloud'), F.low ? 0 : o.clouds);
    const S = o.shocks.slice(0, 6), arr = new Float32Array(24); S.forEach((s, i) => arr.set(s, i * 4)); gl.uniform4fv(p.U('sh'), arr); gl.uniform1f(p.U('ns'), S.length);
    draw(p); return true;
  };
  F.show = on => { cv.style.display = on && F.ok ? 'block' : 'none'; };
  F.destroy = () => { const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); cv.remove(); };
  return F;
};

// 처음 실행 때 한 번: 느린 기기인지 추정한다. 램 2GB 이하, 하급 GPU 이름, 짧은 계산 시간 측정 중 하나라도 걸리면 저사양.
RTS.lowSpecGuess = function () {
  try { const mem = navigator.deviceMemory; if (mem && mem <= 2) return true; } catch (e) {}
  let r = ''; try { const g = document.createElement('canvas').getContext('webgl'); if (!g) return true; const x = g.getExtension('WEBGL_debug_renderer_info'); r = x ? String(g.getParameter(x.UNMASKED_RENDERER_WEBGL)) : ''; const l = g.getExtension('WEBGL_lose_context'); if (l) l.loseContext(); } catch (e) {}
  RTS.gpuName = r; if (/PowerVR|Mali-(400|450|T6|T7|T8|G31|G51|G52)|Adreno \(TM\) (3\d\d|4\d\d|50\d|51\d)/i.test(r)) return true;
  const t0 = performance.now(); let s = 0; for (let i = 0; i < 2e6; i++) s += Math.sqrt(i + s % 7); RTS.cpuBench = performance.now() - t0; return RTS.cpuBench > 80 && s > 0;
};
