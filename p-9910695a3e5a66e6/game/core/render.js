// renderer, scene, camera, paper fog and resize
import * as THREE from '../../shared/vendor/three.module.js';
import { PAL } from '../../artkit/palette.js';
import { qs, MOBILE } from './util.js';

export function createRender(){
  /* m-perf: preserveDrawingBuffer forces a full-frame copy each frame (costly on phone tilers). It is kept for automation
     (navigator.webdriver: QA shots / toDataURL) and on ?pdb; a real browser gets the normal swap. Same pixels either way.
     DPR cap unchanged (1.5 desktop, 2 phone); ?dpr=<k> overrides it for testing on real hardware. */
  const PDB = navigator.webdriver === true || qs.has('pdb') || qs.has('shot');
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: PDB, stencil: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(qs.has('dpr') ? +qs.get('dpr') : Math.min(devicePixelRatio, MOBILE ? 2 : 1.5)); renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; /* r9 #3: PCF with radius blur (VSM streaked) = softer sheep-shadow edges */
  { /* r11 eyes-fix (master 05a3e0a, ported): stock r170 PCF = 17 hard depth compares spread over +-radius -> the cat's shadow edge breaks into stair steps.
       Same footprint (+-radius) but an NxN grid of bilinearly interpolated compares, so the penumbra is a smooth ramp. d-cat: N 5 desktop (to_designer_09: radius 6-8 / N=5), 3 mobile; ?pcfn= */
    const N = +(qs.get('pcfn') || (MOBILE ? 3 : 5)), src = THREE.ShaderChunk.shadowmap_pars_fragment, re = /#if defined\( SHADOWMAP_TYPE_PCF \)\s*\n[\s\S]*?(?=#elif defined\( SHADOWMAP_TYPE_PCF_SOFT \))/;
    const pcf = `#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize; float sAcc = 0.0;
			for ( int i = 0; i < ${N}; i ++ ) for ( int j = 0; j < ${N}; j ++ ) {
				vec2 p = shadowCoord.xy * shadowMapSize + ( vec2( float( i ), float( j ) ) * ${(2 / (N - 1)).toFixed(4)} - 1.0 ) * shadowRadius * 0.8 - 0.5;
				vec2 f = fract( p ), b = ( floor( p ) + 0.5 ) * texelSize;
				sAcc += mix( mix( texture2DCompare( shadowMap, b, shadowCoord.z ), texture2DCompare( shadowMap, b + vec2( texelSize.x, 0.0 ), shadowCoord.z ), f.x ),
					mix( texture2DCompare( shadowMap, b + vec2( 0.0, texelSize.y ), shadowCoord.z ), texture2DCompare( shadowMap, b + texelSize, shadowCoord.z ), f.x ), f.y );
			}
			shadow = sAcc * ${(1 / (N * N)).toFixed(6)};
		`;
    if (re.test(src)) THREE.ShaderChunk.shadowmap_pars_fragment = src.replace(re, pcf); else console.warn('pcf patch: chunk not found'); }
  document.body.prepend(renderer.domElement);
  const PAPER = new THREE.Color(PAL.paper);
  const scene = new THREE.Scene(); scene.background = PAPER.clone();
  const FADE = [+(qs.get('fog0') ?? 26), +(qs.get('fog1') ?? 38)];
  scene.fog = new THREE.Fog(PAPER, FADE[0] - 4, FADE[1] - 6);
  const camera = new THREE.PerspectiveCamera(17.3, innerWidth / innerHeight, qs.has('close') ? 0.03 : 0.3, 600);
  addEventListener('resize', () => renderer.setSize(innerWidth, innerHeight));
  { const g = document.getElementById('grain'), c = g.getContext('2d'); const img = new Image(); img.src = '../artkit/tex/paper.png';
    img.onload = () => { g.width = img.width; g.height = img.height; c.drawImage(img, 0, 0); g.style.width = g.style.height = '100%'; };
      g.style.backgroundSize = '384px'; }
  return { renderer, scene, camera, FADE };
}
