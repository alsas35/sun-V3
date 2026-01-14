// index.js - Realistic Sun with improved Corona
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Basic Setup ───────────────────────────────────────────────────────
const w = window.innerWidth;
const h = window.innerHeight;

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true
});
renderer.setSize(w, h);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 2000);
camera.position.set(0, 0, 5); // a bit farther to appreciate corona

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x00040f); // deeper space

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;

// ── Starfield ─────────────────────────────────────────────────────────
function createStarfield() {
  const vertices = [];
  for (let i = 0; i < 8000; i++) {
    vertices.push(
      THREE.MathUtils.randFloatSpread(400),
      THREE.MathUtils.randFloatSpread(400),
      THREE.MathUtils.randFloatSpread(400)
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const material = new THREE.PointsMaterial({ 
    color: 0xffffff, 
    size: 0.07,
    sizeAttenuation: true 
  });
  return new THREE.Points(geometry, material);
}
scene.add(createStarfield());

// ── Sun with improved shader ──────────────────────────────────────────
const sunGroup = new THREE.Group();
scene.add(sunGroup);

const geometry = new THREE.IcosahedronGeometry(1.0, 16);

const vertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float time;
  varying vec3 vNormal;
  varying vec3 vPosition;

  vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
  vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
  vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}

  float snoise(vec3 v){
    const vec2 C = vec2(1./6.,1./3.);
    const vec4 D = vec4(0.,.5,1.,2.);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 =   v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute( permute( permute( 
               i.z + vec4(0., i1.z, i2.z, 1. ))
             + i.y + vec4(0., i1.y, i2.y, 1. )) 
             + i.x + vec4(0., i1.x, i2.x, 1. ));
    float n_ = 0.142857142857;
    vec3  ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49. * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7. * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1. - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy,y.xy);
    vec4 b1 = vec4(x.zw,y.zw);
    vec4 s0 = floor(b0)*2.+1.;
    vec4 s1 = floor(b1)*2.+1.;
    vec4 sh = -step(h,vec4(0.));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.);
    m = m * m;
    return 42. * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    float n = snoise(vPosition * 2.8 + time * 0.12);
    n += snoise(vPosition * 5.5 - time * 0.07) * 0.45;
    
    vec3 color1 = vec3(0.98, 0.55, 0.18);   // more realistic base
    vec3 color2 = vec3(1.00, 0.78, 0.38);
    vec3 color3 = vec3(1.00, 0.95, 0.68);   // bright faculae

    vec3 color = mix(color1, color2, smoothstep(0.0, 0.65, n));
    color = mix(color, color3, smoothstep(0.55, 1.0, n));
    color *= 1.0 + pow(max(0.0, n), 5.0) * 0.7;

    float fresnel = pow(1.0 - dot(vNormal, vec3(0.,0.,1.)), 2.8);
    color += fresnel * 0.35;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const uniforms = { time: { value: 0 } };
const material = new THREE.ShaderMaterial({
  uniforms,
  vertexShader,
  fragmentShader
});

const sunMesh = new THREE.Mesh(geometry, material);
sunGroup.add(sunMesh);

// ── Realistic Corona Layers ───────────────────────────────────────────
for (let i = 1; i <= 32; i++) {           // many layers = smooth fade
  const radius = 1.0 + Math.pow(i, 1.7) * 0.11; // long natural extension
  
  const corona = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 48),
    new THREE.MeshBasicMaterial({
      color: 0xfefeff,                   // almost pure white
      transparent: true,
      opacity: 0.085 / (i * 1.5 + 3.0), // very subtle & realistic
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false
    })
  );
  
  // Break symmetry - important for realism!
  corona.rotation.set(
    (Math.random() - 0.5) * 0.18,
    Math.random() * Math.PI * 2,
    (Math.random() - 0.5) * 0.12
  );
  
  // Slight oval shape variation
  corona.scale.set(
    1 + (Math.random() - 0.5) * 0.14,
    1 + (Math.random() - 0.5) * 0.14,
    1.0
  );
  
  sunGroup.add(corona);
}

// ── Coronal Mass Ejections (CME) Simulation ───────────────────────────
const cmeCount = 3; // Number of simultaneous CMEs (keep low for performance)
const particlesPerCme = 800; // More = denser cloud
const cmes = [];

function createCme() {
  const positions = new Float32Array(particlesPerCme * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xffeecc,          // Bright plasma white-yellow
    size: 0.02,               // Small points for cloud effect
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const particles = new THREE.Points(geometry, material);
  particles.visible = false; // Start hidden

  return {
    particles,
    life: 0,                  // 0 = inactive
    maxLife: 8 + Math.random() * 4, // Duration in seconds
    origin: new THREE.Vector3(), // Starting point on surface
    speed: 0.08 + Math.random() * 0.04 // Expansion speed
  };
}

for (let i = 0; i < cmeCount; i++) {
  const cme = createCme();
  sunGroup.add(cme.particles);
  cmes.push(cme);
}

// ── Animation ─────────────────────────────────────────────────────────
function animate(time = 0) {
  requestAnimationFrame(animate);

  uniforms.time.value = time * 0.0005;

  // Very gentle pulse
  const pulse = 1 + Math.sin(time * 0.0012) * 0.012;
  sunGroup.scale.setScalar(pulse);

  sunGroup.rotation.y = time * 0.00006;

  cmes.forEach(cme => {
  if (cme.life > 0) {
    cme.life += 0.016; // ~60 FPS delta

    const fade = 1 - (cme.life / cme.maxLife); // Fade out
    cme.particles.material.opacity = fade * 0.8;

    const positions = cme.particles.geometry.attributes.position.array;

    for (let j = 0; j < particlesPerCme; j++) {
      const idx = j * 3;
      // Initial random offset in cloud
      if (cme.life < 0.1) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 1.05 + Math.random() * 0.2; // Start near surface
        positions[idx] = r * Math.sin(phi) * Math.cos(theta);
        positions[idx + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[idx + 2] = r * Math.cos(phi);
      }

      // Expand outward radially
      positions[idx] += positions[idx] * cme.speed;
      positions[idx + 1] += positions[idx + 1] * cme.speed;
      positions[idx + 2] += positions[idx + 2] * cme.speed;
    }

    cme.particles.geometry.attributes.position.needsUpdate = true;

    if (cme.life > cme.maxLife) {
      cme.life = 0;
      cme.particles.visible = false;
    }
  } else if (Math.random() < 0.005) { // Random trigger (~every 3-10 sec)
    cme.life = 0.01; // Start
    cme.particles.visible = true;
    cme.maxLife = 8 + Math.random() * 4;
    cme.speed = 0.08 + Math.random() * 0.04;

    // Random origin direction
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    cme.origin.set(
      Math.sin(phi) * Math.cos(theta),
      Math.sin(phi) * Math.sin(theta),
      Math.cos(phi)
    );

    // Orient particles toward origin (optional for alignment)
    cme.particles.lookAt(cme.origin);
  }
});

  controls.update();
  renderer.render(scene, camera);
}

animate();

// Resize handler
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});