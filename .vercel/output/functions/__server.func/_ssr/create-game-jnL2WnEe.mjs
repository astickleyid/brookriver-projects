import { a as hustlesAt, c as scoreSpend, i as hustleById, l as spendBlurb, n as SPENDS, o as resolveHustle, r as blurb, s as scoreHustle, u as spendById } from "./routes-CcMOAUef.mjs";
import { A as Points, B as TorusGeometry, C as Mesh, D as PerspectiveCamera, E as OctahedronGeometry, F as SRGBColorSpace, H as Vector3, I as Scene, L as SphereGeometry, M as Quaternion, N as RepeatWrapping, O as PlaneGeometry, P as RingGeometry, R as SpotLight, S as Matrix4, T as MeshStandardMaterial, V as Vector2, _ as Group, a as WebGLRenderer, b as LineBasicMaterial, c as BufferGeometry, d as ClampToEdgeWrapping, f as Color, g as Fog, h as DirectionalLight, i as EffectComposer, j as PointsMaterial, k as PointLight, l as CanvasTexture, m as CylinderGeometry, n as UnrealBloomPass, o as BoxGeometry, p as ConeGeometry, r as RenderPass, s as BufferAttribute, t as OutputPass, u as CircleGeometry, v as HemisphereLight, w as MeshBasicMaterial, x as LineSegments, y as InstancedMesh, z as Timer } from "../_libs/three.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/create-game-jnL2WnEe.js
var CELL = 50;
var ROAD = 16;
var GRID = 5;
var WORLD = 250;
var HALF = WORLD / 2;
var LANE = 2.75;
var MAX_SHOTS = 48;
var PAINTS = [
	12862774,
	15127459,
	2060138,
	16052714,
	2764344,
	13934615,
	7027293,
	8888501,
	11883034,
	2372166
];
var RIDES = {
	sport: {
		maxHp: 150,
		vmax: 42,
		cruise: 18,
		accel: 36,
		turn: 2.55,
		mass: .75,
		scale: [
			.9,
			.7,
			.88
		]
	},
	sedan: {
		maxHp: 210,
		vmax: 32,
		cruise: 14,
		accel: 24,
		turn: 2.15,
		mass: 1,
		scale: [
			1,
			.96,
			1.05
		]
	},
	van: {
		maxHp: 360,
		vmax: 24,
		cruise: 12,
		accel: 15,
		turn: 1.45,
		mass: 1.8,
		scale: [
			1.28,
			1.5,
			1.4
		]
	},
	cruiser: {
		maxHp: 280,
		vmax: 36,
		cruise: 16,
		accel: 26,
		turn: 2.05,
		mass: 1.3,
		scale: [
			1.08,
			1.02,
			1.18
		]
	}
};
var GUNS = {
	pistol: {
		cd: .22,
		reload: 1.05,
		spread: .016,
		dmg: 34,
		pellets: 1,
		range: 70,
		mag: 12
	},
	shotgun: {
		cd: .64,
		reload: 1.55,
		spread: .15,
		dmg: 15,
		pellets: 5,
		range: 16,
		mag: 6
	},
	smg: {
		cd: .08,
		reload: 1.2,
		spread: .055,
		dmg: 13,
		pellets: 1,
		range: 44,
		mag: 30
	}
};
var RADIO = [
	"NIGHTLINE",
	"LOW KING",
	"TEAL WAVE",
	"SIREN FM"
];
function carRadius(ride) {
	const s = RIDES[ride].scale;
	return 1.22 * ((s[0] + s[2]) * .5);
}
function clamp(v, a, b) {
	return v < a ? a : v > b ? b : v;
}
function wrap(a) {
	while (a > Math.PI) a -= Math.PI * 2;
	while (a < -Math.PI) a += Math.PI * 2;
	return a;
}
function yawTo(x, z, tx, tz) {
	return Math.atan2(-(tx - x), -(tz - z));
}
function mulberry32(seed) {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = a + 1831565813 | 0;
		let t = Math.imul(a ^ a >>> 15, 1 | a);
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
function roadLines() {
	const xs = [];
	const zs = [];
	for (let i = 0; i <= GRID; i++) {
		xs.push(-125 + i * CELL);
		zs.push(-125 + i * CELL);
	}
	return {
		xs,
		zs
	};
}
function circleHitsAABB(x, z, r, b) {
	const cx = clamp(x, b.minX, b.maxX);
	const cz = clamp(z, b.minZ, b.maxZ);
	const dx = x - cx;
	const dz = z - cz;
	return dx * dx + dz * dz < r * r;
}
function pushCircle(x, z, r, b) {
	const cx = clamp(x, b.minX, b.maxX);
	const cz = clamp(z, b.minZ, b.maxZ);
	let dx = x - cx;
	let dz = z - cz;
	const d2 = dx * dx + dz * dz;
	if (d2 >= r * r) return {
		x,
		z,
		hit: false
	};
	if (d2 < 1e-8) {
		const left = x - b.minX;
		const right = b.maxX - x;
		const down = z - b.minZ;
		const up = b.maxZ - z;
		const m = Math.min(left, right, down, up);
		if (m === left) return {
			x: b.minX - r - .01,
			z,
			hit: true
		};
		if (m === right) return {
			x: b.maxX + r + .01,
			z,
			hit: true
		};
		if (m === down) return {
			x,
			z: b.minZ - r - .01,
			hit: true
		};
		return {
			x,
			z: b.maxZ + r + .01,
			hit: true
		};
	}
	const d = Math.sqrt(d2);
	const k = (r - d) / d;
	return {
		x: x + dx * k,
		z: z + dz * k,
		hit: true
	};
}
function rayAABB(ox, oy, oz, dx, dy, dz, b, maxT) {
	let tmin = 0;
	let tmax = maxT;
	const min = [
		b.minX,
		0,
		b.minZ
	];
	const max = [
		b.maxX,
		b.h,
		b.maxZ
	];
	const o = [
		ox,
		oy,
		oz
	];
	const d = [
		dx,
		dy,
		dz
	];
	for (let i = 0; i < 3; i++) if (Math.abs(d[i]) < 1e-8) {
		if (o[i] < min[i] || o[i] > max[i]) return null;
	} else {
		let t1 = (min[i] - o[i]) / d[i];
		let t2 = (max[i] - o[i]) / d[i];
		if (t1 > t2) {
			const s = t1;
			t1 = t2;
			t2 = s;
		}
		tmin = Math.max(tmin, t1);
		tmax = Math.min(tmax, t2);
		if (tmin > tmax) return null;
	}
	return tmin >= 0 ? tmin : tmax >= 0 ? tmax : null;
}
function rayCylinder(ox, oy, oz, dx, dy, dz, cx, cz, r, y0, y1, maxT) {
	const lx = ox - cx;
	const lz = oz - cz;
	const a = dx * dx + dz * dz;
	const b = 2 * (lx * dx + lz * dz);
	const c = lx * lx + lz * lz - r * r;
	if (a < 1e-8) return null;
	const disc = b * b - 4 * a * c;
	if (disc < 0) return null;
	const s = Math.sqrt(disc);
	let t = (-b - s) / (2 * a);
	if (t < 0 || t > maxT) t = (-b + s) / (2 * a);
	if (t < 0 || t > maxT) return null;
	const y = oy + dy * t;
	if (y < y0 || y > y1) return null;
	return t;
}
function blockLoop(xs, zs, i, j) {
	const x0 = xs[i];
	const x1 = xs[i + 1];
	const z0 = zs[j];
	const z1 = zs[j + 1];
	const L = LANE;
	const pts = [];
	const steps = 3;
	const zA = z0 + 12;
	const zB = z1 - 12;
	const xA = x0 + 12;
	const xB = x1 - 12;
	for (let s = 0; s <= steps; s++) pts.push({
		x: x0 + L,
		z: zA + (zB - zA) * s / steps
	});
	for (let s = 1; s <= steps; s++) pts.push({
		x: xA + (xB - xA) * s / steps,
		z: z1 + L
	});
	for (let s = 1; s <= steps; s++) pts.push({
		x: x1 - L,
		z: zB + (zA - zB) * s / steps
	});
	for (let s = 1; s <= steps; s++) pts.push({
		x: xB + (xA - xB) * s / steps,
		z: z0 - L
	});
	return pts;
}
function makeWindowTexture() {
	const c = document.createElement("canvas");
	c.width = 256;
	c.height = 384;
	const g = c.getContext("2d");
	g.fillStyle = "#17191f";
	g.fillRect(0, 0, 256, 384);
	for (let i = 0; i < 1600; i++) {
		const v = 16 + i * 17 % 18;
		g.fillStyle = `rgb(${v},${v + 1},${v + 4})`;
		g.fillRect(i * 47 % 256, i * 91 % 384, i % 5 === 0 ? 3 : 1, i % 7 === 0 ? 3 : 1);
	}
	g.fillStyle = "#0c0e14";
	for (let col = 0; col < 4; col++) {
		g.fillRect(col * 64, 0, 7, 384);
		g.fillRect(col * 64 + 57, 0, 7, 384);
	}
	for (let row = 0; row < 6; row++) g.fillRect(0, row * 64, 256, 8);
	const warms = [
		"#ffb14a",
		"#e39a3a",
		"#f4e7cf",
		"#c9842a",
		"#8a6238"
	];
	const cools = [
		"#b7d4e4",
		"#3ecfc0",
		"#7f9cb4",
		"#d5e2ea"
	];
	const paint = (x, y, lit, on) => {
		g.fillStyle = "#07080c";
		g.fillRect(x, y, 46, 48);
		g.fillStyle = on ? lit : "#12151c";
		g.fillRect(x + 3, y + 3, 40, 42);
		if (!on) return;
		g.fillStyle = "rgba(7,8,12,0.5)";
		g.fillRect(x + 21, y + 3, 2, 42);
		g.fillRect(x + 3, y + 22, 40, 2);
		g.fillStyle = "rgba(7,8,12,0.22)";
		g.fillRect(x + 3, y + 3, 12, 42);
	};
	let n = 0;
	for (let row = 0; row < 6; row++) for (let col = 0; col < 4; col++) {
		const roll = (row * 13 + col * 7) % 10;
		const on = roll > 2 && roll !== 4;
		const lit = roll > 7 ? cools[n % cools.length] : warms[n % warms.length];
		paint(9 + col * 64, 12 + row * 64, lit, on);
		n++;
	}
	const tex = new CanvasTexture(c);
	tex.colorSpace = SRGBColorSpace;
	tex.wrapS = RepeatWrapping;
	tex.wrapT = RepeatWrapping;
	tex.anisotropy = 8;
	return tex;
}
function makeGroundTexture(xs, zs) {
	const TEX = 1024;
	const c = document.createElement("canvas");
	c.width = TEX;
	c.height = TEX;
	const g = c.getContext("2d");
	const px = (v) => (v + HALF) / WORLD * TEX;
	g.fillStyle = "#101114";
	g.fillRect(0, 0, TEX, TEX);
	for (let i = 0; i < 900; i++) {
		g.fillStyle = i % 3 ? "#16181e" : "#0c0d11";
		g.fillRect(Math.random() * TEX, Math.random() * TEX, 2, 2);
	}
	const band = (draw, lines) => {
		for (const line of lines) draw(line);
	};
	g.fillStyle = "#2c2a26";
	band((x) => {
		const a = px(x - ROAD / 2 - 4.2);
		const b = px(x + ROAD / 2 + 4.2);
		g.fillRect(a, 0, b - a, TEX);
	}, xs);
	band((z) => {
		const a = px(z - ROAD / 2 - 4.2);
		const b = px(z + ROAD / 2 + 4.2);
		g.fillRect(0, a, TEX, b - a);
	}, zs);
	g.fillStyle = "#6a6458";
	band((x) => {
		const a = px(x - ROAD / 2 - .35);
		const b = px(x + ROAD / 2 + .35);
		g.fillRect(a, 0, Math.max(1, px(x - ROAD / 2) - a), TEX);
		g.fillRect(px(x + ROAD / 2), 0, Math.max(1, b - px(x + ROAD / 2)), TEX);
	}, xs);
	band((z) => {
		const a = px(z - ROAD / 2 - .35);
		const b = px(z + ROAD / 2 + .35);
		g.fillRect(0, a, TEX, Math.max(1, px(z - ROAD / 2) - a));
		g.fillRect(0, px(z + ROAD / 2), TEX, Math.max(1, b - px(z + ROAD / 2)));
	}, zs);
	g.fillStyle = "#1a1c22";
	band((x) => {
		const a = px(x - ROAD / 2);
		const b = px(x + ROAD / 2);
		g.fillRect(a, 0, b - a, TEX);
	}, xs);
	band((z) => {
		const a = px(z - ROAD / 2);
		const b = px(z + ROAD / 2);
		g.fillRect(0, a, TEX, b - a);
	}, zs);
	g.fillStyle = "rgba(255, 236, 210, 0.045)";
	band((x) => {
		const a = px(x - .35);
		g.fillRect(a, 0, Math.max(1, px(x + .35) - a), TEX);
	}, xs);
	band((z) => {
		const a = px(z - .35);
		g.fillRect(0, a, TEX, Math.max(1, px(z + .35) - a));
	}, zs);
	g.strokeStyle = "rgba(20, 18, 16, 0.45)";
	g.lineWidth = 1;
	for (const x of xs) {
		const left = px(x - ROAD / 2 - 4.1);
		const right = px(x + ROAD / 2 + .4);
		for (let y = 0; y < TEX; y += 18) {
			g.strokeRect(left, y, px(3.6) - px(0), 14);
			g.strokeRect(right, y, px(3.6) - px(0), 14);
		}
	}
	g.fillStyle = "#cbb98a";
	for (const x of xs) for (let z = -119; z < HALF; z += 8) {
		let near = false;
		for (const hz of zs) if (Math.abs(z - hz) < 9) near = true;
		if (near) continue;
		g.fillRect(px(x - .12), px(z), Math.max(1, px(x + .12) - px(x - .12)), px(z + 3.2) - px(z));
	}
	for (const z of zs) for (let x = -119; x < HALF; x += 8) {
		let near = false;
		for (const vx of xs) if (Math.abs(x - vx) < 9) near = true;
		if (near) continue;
		g.fillRect(px(x), px(z - .12), px(x + 3.2) - px(x), Math.max(1, px(z + .12) - px(z - .12)));
	}
	g.fillStyle = "#d9d3c6";
	for (const x of xs) for (const z of zs) {
		g.fillRect(px(x - ROAD / 2), px(z - .35), px(ROAD) - px(0), px(.7) - px(0));
		g.fillRect(px(x - .35), px(z - ROAD / 2), px(.7) - px(0), px(ROAD) - px(0));
		const stripe = (ox, oz, w, h) => g.fillRect(px(ox), px(oz), px(w) - px(0), px(h) - px(0));
		for (let i = -2; i <= 2; i++) {
			stripe(x + i * 1.15 - .22, z + ROAD / 2 - 3.4, .42, 2.2);
			stripe(x + i * 1.15 - .22, z - ROAD / 2 + 1.2, .42, 2.2);
			stripe(x + ROAD / 2 - 3.4, z + i * 1.15 - .22, 2.2, .42);
			stripe(x - ROAD / 2 + 1.2, z + i * 1.15 - .22, 2.2, .42);
		}
	}
	g.fillStyle = "#2a3330";
	g.beginPath();
	g.arc(px(0), px(0), px(16) - px(0), 0, Math.PI * 2);
	g.fill();
	g.fillStyle = "rgba(255, 176, 32, 0.08)";
	g.fillRect(0, 0, px(-28), TEX);
	g.fillStyle = "rgba(62, 224, 197, 0.07)";
	g.fillRect(px(28), 0, TEX - px(28), TEX);
	g.fillStyle = "rgba(6, 7, 10, 0.35)";
	g.fillRect(0, 0, px(-82), TEX);
	g.fillRect(px(82), 0, TEX - px(82), TEX);
	g.fillRect(0, 0, TEX, px(-82));
	g.fillRect(0, px(82), TEX, TEX - px(82));
	const tex = new CanvasTexture(c);
	tex.colorSpace = SRGBColorSpace;
	tex.anisotropy = 8;
	return tex;
}
function makeSign(text, fg, bg) {
	const c = document.createElement("canvas");
	c.width = 256;
	c.height = 96;
	const g = c.getContext("2d");
	g.fillStyle = bg;
	g.fillRect(0, 0, 256, 96);
	g.strokeStyle = fg;
	g.lineWidth = 6;
	g.strokeRect(6, 6, 244, 84);
	g.fillStyle = fg;
	g.font = "700 62px Impact, Arial Narrow, sans-serif";
	g.textAlign = "center";
	g.textBaseline = "middle";
	g.fillText(text, 128, 50);
	const tex = new CanvasTexture(c);
	tex.colorSpace = SRGBColorSpace;
	return tex;
}
function buildBlocks(rand) {
	const buildings = [];
	for (let gx = 0; gx < GRID; gx++) for (let gz = 0; gz < GRID; gz++) {
		if (gx === 2 && gz === 2) continue;
		const ox = -125 + gx * CELL;
		const oz = -125 + gz * CELL;
		const in0 = 10.4;
		const in1 = CELL - ROAD / 2 - 2.4;
		const span = 29.200000000000003;
		const tall = () => {
			const r = rand();
			if (r < .18) return 6 + rand() * 5;
			if (r < .72) return 12 + rand() * 16;
			return 30 + rand() * 28;
		};
		if (rand() < .22) {
			buildings.push({
				minX: ox + in0 + 1,
				maxX: ox + in1 - 1,
				minZ: oz + in0 + 1,
				maxZ: oz + in1 - 1,
				h: tall()
			});
			continue;
		}
		const gap = 2.2;
		const mid = in0 + span * (.42 + rand() * .16);
		const zInsetA = rand() * span * .18;
		const zInsetB = rand() * span * .22;
		buildings.push({
			minX: ox + in0,
			maxX: ox + mid - gap / 2,
			minZ: oz + in0 + zInsetA,
			maxZ: oz + in1 - rand() * 2,
			h: tall()
		});
		buildings.push({
			minX: ox + mid + gap / 2,
			maxX: ox + in1,
			minZ: oz + in0 + rand() * 2,
			maxZ: oz + in1 - zInsetB,
			h: tall()
		});
	}
	buildings.push({
		minX: -3.3,
		maxX: 3.3,
		minZ: -3.3,
		maxZ: 3.3,
		h: 1.5
	});
	buildings.push({
		minX: -10,
		maxX: -7.4,
		minZ: -2,
		maxZ: .8,
		h: 1.15
	});
	buildings.push({
		minX: 6,
		maxX: 9.1,
		minZ: 3,
		maxZ: 5.6,
		h: 1.15
	});
	buildings.push({
		minX: -2,
		maxX: 1.4,
		minZ: -12.2,
		maxZ: -9.1,
		h: 1.05
	});
	return buildings;
}
function blockStyle(cx, cz, h) {
	if (Math.abs(cx) < 30 && Math.abs(cz) < 30) return "civic";
	if (Math.abs(cx) > 82 || Math.abs(cz) > 82) return "brutal";
	if (cx < -28) return "brick";
	if (cx > 28) return "glass";
	return h > 18 ? "deco" : "brutal";
}
function massing(b) {
	const fullW = b.maxX - b.minX;
	const fullD = b.maxZ - b.minZ;
	const cx = (b.minX + b.maxX) / 2;
	const cz = (b.minZ + b.maxZ) / 2;
	const style = blockStyle(cx, cz, b.h);
	const roomy = b.h > 11 && fullW > 6 && fullD > 6;
	let podiumH = 0;
	let midH = 0;
	let inset = 0;
	let midInset = 0;
	if (style === "glass" && roomy) {
		podiumH = 3.3;
		inset = Math.min(2.6, Math.min(fullW, fullD) * .18);
	} else if (style === "deco" && roomy) {
		podiumH = Math.min(5, b.h * .15);
		midH = (b.h - podiumH) * .46;
		midInset = Math.min(1.35, Math.min(fullW, fullD) * .08);
		inset = Math.min(3.4, Math.min(fullW, fullD) * .22);
	} else if (style === "civic" && b.h > 8) {
		podiumH = Math.min(4.4, b.h * .24);
		inset = Math.min(1.15, Math.min(fullW, fullD) * .07);
	}
	return {
		fullW,
		fullD,
		cx,
		cz,
		style,
		podiumH,
		midH,
		inset,
		midInset
	};
}
function createGame(canvas, minimap, touch, onHud) {
	const rand = mulberry32(20928);
	const { xs: roadXs, zs: roadZs } = roadLines();
	const blocks = buildBlocks(rand);
	const staticBlocks = blocks.filter((b) => b.h > 2);
	const LOT = {
		x: 12,
		z: -8
	};
	blocks.push({
		minX: LOT.x - .8,
		maxX: LOT.x + .8,
		minZ: LOT.z - .5,
		maxZ: LOT.z + .5,
		h: 1.5
	});
	const spots = [
		{
			id: "teller",
			place: "teller",
			x: -69,
			z: -75,
			name: "CIVIC BANK",
			cool: 0,
			pick: 0
		},
		{
			id: "vault",
			place: "vault",
			x: -75,
			z: -69,
			name: "VAULT",
			cool: 0,
			pick: 0
		},
		{
			id: "home1",
			place: "home",
			x: 31,
			z: -75,
			name: "ROW HOUSE",
			cool: 0,
			pick: 0
		},
		{
			id: "home2",
			place: "home",
			x: 69,
			z: 25,
			name: "WALK-UP",
			cool: 0,
			pick: 0
		},
		{
			id: "home3",
			place: "home",
			x: -25,
			z: 69,
			name: "DUPLEX",
			cool: 0,
			pick: 0
		},
		{
			id: "store1",
			place: "store",
			x: -19,
			z: 25,
			name: "CORNER MART",
			cool: 0,
			pick: 0
		},
		{
			id: "store2",
			place: "store",
			x: 75,
			z: -31,
			name: "LATE SHOP",
			cool: 0,
			pick: 0
		},
		{
			id: "roller",
			place: "roller",
			x: 69,
			z: 75,
			name: "THE SUITE",
			cool: 0,
			pick: 0
		},
		{
			id: "corner1",
			place: "corner",
			x: -75,
			z: 31,
			name: "WEST CORNER",
			cool: 0,
			pick: 0
		},
		{
			id: "corner2",
			place: "corner",
			x: 25,
			z: 69,
			name: "EAST CORNER",
			cool: 0,
			pick: 0
		},
		{
			id: "pawn",
			place: "pawn",
			x: -31,
			z: -25,
			name: "PAWN",
			cool: 0,
			pick: 0
		},
		{
			id: "casino",
			place: "casino",
			x: 31,
			z: -25,
			name: "DICE HALL",
			cool: 0,
			pick: 0
		},
		{
			id: "fixer",
			place: "fixer",
			x: -6,
			z: 4,
			name: "FIXER",
			cool: 0,
			pick: 0
		}
	];
	for (const s of spots) for (const b of blocks) if (s.x > b.minX - 1.4 && s.x < b.maxX + 1.4 && s.z > b.minZ - 1.4 && s.z < b.maxZ + 1.4) {
		const road = nearestRoad(s.x, s.z);
		s.x = road.x;
		s.z = road.z;
		break;
	}
	const keys = /* @__PURE__ */ new Set();
	const injected = /* @__PURE__ */ new Set();
	let steerOverride = null;
	let mouseFire = false;
	let started = false;
	let alive = true;
	let phase = "menu";
	let driving = true;
	let playerCar = 0;
	let px = -22.25;
	let pz = 12;
	let vx = 0;
	let vz = 0;
	let camYaw = 0;
	let camPitch = -.08;
	let lookOffset = 0;
	let lookPitch = -.08;
	let health = 100;
	let armor = 30;
	let wanted = 0;
	let cash = 40;
	let bankBal = 0;
	let loot = 0;
	let best = 0;
	try {
		best = Number(localStorage.getItem("viceroy-best") ?? "0") || 0;
		bankBal = Math.max(0, Math.floor(Number(localStorage.getItem("viceroy-bank") ?? "0") || 0));
		loot = Math.max(0, Math.floor(Number(localStorage.getItem("viceroy-loot") ?? "0") || 0));
	} catch {
		best = 0;
	}
	const hold = {
		tunes: 0,
		house: false,
		lux: 0,
		biz: false,
		packs: 0,
		invite: false,
		crewT: 0,
		hitT: 0,
		bizTick: 0,
		marketCost: 0,
		marketBasis: 1,
		index: 1,
		pick: 0
	};
	try {
		const raw = localStorage.getItem("viceroy-hold");
		if (raw) {
			const saved = JSON.parse(raw);
			hold.tunes = Math.max(0, Math.min(3, Math.floor(saved.tunes ?? 0)));
			hold.house = !!saved.house;
			hold.lux = Math.max(0, Math.min(5, Math.floor(saved.lux ?? 0)));
			hold.biz = !!saved.biz;
			hold.packs = Math.max(0, Math.floor(saved.packs ?? 0));
			hold.invite = !!saved.invite;
			hold.marketCost = Math.max(0, Math.floor(saved.marketCost ?? 0));
			hold.marketBasis = saved.marketBasis && saved.marketBasis > 0 ? saved.marketBasis : 1;
			hold.index = saved.index && saved.index > 0 ? saved.index : 1;
		}
	} catch {}
	let toast = "";
	let toastT = 0;
	let lostCash = 0;
	let invuln = 0;
	let shootCd = 0;
	let starLock = 0;
	let sinceCrime = 99;
	let sinceShot = 99;
	let clearT = 0;
	let lastHurt = 99;
	let regenT = 0;
	let deathLeft = 0;
	let shake = 0;
	let prevF = false;
	let sirenFlip = 0;
	let error = "";
	let raf = 0;
	let disposed = false;
	let hudAcc = 0;
	let crunchCd = 0;
	let drifting = false;
	let flashT = 0;
	let flashX = 0;
	let flashY = 1.4;
	let flashZ = 0;
	let gun = "pistol";
	const owned = {
		pistol: true,
		shotgun: false,
		smg: false
	};
	const ammo = {
		pistol: {
			mag: 12,
			reserve: 72
		},
		shotgun: {
			mag: 6,
			reserve: 24
		},
		smg: {
			mag: 30,
			reserve: 90
		}
	};
	let reloadT = 0;
	let radioTrack = 0;
	const radioOn = true;
	let lit = false;
	let seenX = 0;
	let seenZ = 0;
	let heliX = 0;
	let heliZ = 40;
	let coverNow = false;
	let coverSaid = false;
	let blockLive = false;
	const job = {
		active: false,
		kind: "deliver",
		t: 0,
		cool: 3,
		next: 0,
		x: 0,
		z: 0,
		car: -1,
		tail: -1,
		faction: "teal",
		flag: false,
		hold: 0,
		bx: 0,
		bz: 0,
		show: false,
		prevColor: 16777215,
		prevRide: "sedan",
		prevSpeed: 14
	};
	let channel = null;
	const edge = {
		r: false,
		n: false,
		b: false,
		v: false,
		g: false,
		h: false,
		d1: false,
		d2: false,
		d3: false,
		j: false,
		k: false
	};
	const held = (code) => keys.has(code) || injected.has(code);
	const cars = [];
	const peds = [];
	const pickups = [];
	const shots = [];
	const playerStart = {
		x: roadXs[2] + LANE,
		z: 58
	};
	function nearestRoad(x, z) {
		let bestD = 1e9;
		let bx = x;
		let bz = z;
		let by = 0;
		for (const rx of roadXs) {
			const laneX = rx + LANE;
			const cz = clamp(z, -117, 117);
			const d = (x - laneX) ** 2 + (z - cz) ** 2;
			if (d < bestD) {
				bestD = d;
				bx = laneX;
				bz = cz;
				by = 0;
			}
		}
		for (const rz of roadZs) {
			const laneZ = rz + LANE;
			const cx = clamp(x, -117, 117);
			const d = (x - cx) ** 2 + (z - laneZ) ** 2;
			if (d < bestD) {
				bestD = d;
				bx = cx;
				bz = laneZ;
				by = -Math.PI / 2;
			}
		}
		return {
			x: bx,
			z: bz,
			yaw: by
		};
	}
	function separated(x, z, min) {
		for (const c of cars) {
			const dx = c.x - x;
			const dz = c.z - z;
			if (dx * dx + dz * dz < min * min) return false;
		}
		return true;
	}
	function makeCar(x, z, yaw, mode, color, wps, opts) {
		const ride = opts?.ride ?? (opts?.police ? "cruiser" : "sedan");
		const stats = RIDES[ride];
		const maxHp = opts?.hp ?? stats.maxHp;
		return {
			x,
			z,
			yaw,
			speed: mode === "traffic" ? stats.cruise : 0,
			hp: maxHp,
			maxHp,
			mode,
			color,
			wps,
			wp: 0,
			alarm: !!opts?.alarm,
			hadDriver: !!opts?.driver,
			maxSpeed: opts?.maxSpeed ?? (mode === "traffic" ? stats.cruise : stats.vmax),
			stuckT: 0,
			spin: 0,
			shootCd: 1,
			police: !!opts?.police,
			ride,
			lat: 0,
			block: false,
			forSale: !!opts?.forSale
		};
	}
	cars.push(makeCar(playerStart.x, playerStart.z, 0, "locked", 14131546, [], {
		ride: "sport",
		driver: false,
		alarm: false
	}));
	const loops = [];
	for (let i = 1; i <= 3; i++) for (let j = 1; j <= 3; j++) loops.push(blockLoop(roadXs, roadZs, i, j));
	let spawnedTraffic = 0;
	for (let n = 0; n < 14 && spawnedTraffic < 14; n++) {
		const wps = loops[n % loops.length];
		let guard = 0;
		let idx = n * 5 % wps.length;
		let spot = wps[idx];
		while (guard < wps.length && (Math.hypot(spot.x - playerStart.x, spot.z - playerStart.z) < 26 || !separated(spot.x, spot.z, 8))) {
			idx = (idx + 1) % wps.length;
			spot = wps[idx];
			guard++;
		}
		if (Math.hypot(spot.x - playerStart.x, spot.z - playerStart.z) < 20 || !separated(spot.x, spot.z, 7)) continue;
		const next = wps[(idx + 1) % wps.length];
		const ride = n % 6 === 0 ? "van" : n % 6 === 1 ? "sport" : "sedan";
		const car = makeCar(spot.x, spot.z, yawTo(spot.x, spot.z, next.x, next.z), "traffic", PAINTS[n % PAINTS.length], wps, {
			driver: true,
			ride,
			hp: RIDES[ride].maxHp
		});
		car.wp = (idx + 1) % wps.length;
		cars.push(car);
		spawnedTraffic++;
	}
	let parked = 0;
	for (let i = 0; i < GRID && parked < 10; i++) for (let j = 0; j < GRID && parked < 10; j++) {
		if ((i + j) % 2 !== 0) continue;
		const rx = roadXs[i + 1];
		const z = -125 + j * CELL + CELL * .5;
		const x = rx - ROAD / 2 + 1.7;
		if (Math.hypot(x - playerStart.x, z - playerStart.z) < 18) continue;
		let cross = false;
		for (const rz of roadZs) if (Math.abs(z - rz) < 12) cross = true;
		if (cross) continue;
		if (!separated(x, z, 7)) continue;
		if (staticBlocks.some((b) => circleHitsAABB(x, z, 1.5, b))) continue;
		cars.push(makeCar(x, z, Math.PI, "idle", PAINTS[(i * 3 + j) % PAINTS.length], [], {
			alarm: parked % 2 === 0,
			driver: false,
			ride: parked % 4 === 0 ? "van" : parked % 4 === 1 ? "sport" : "sedan"
		}));
		parked++;
	}
	for (let n = 0; n < 4; n++) {
		const wps = loops[(n + 2) % loops.length];
		const spot = wps[n * 3 % wps.length];
		const next = wps[(n * 3 + 1) % wps.length];
		const shifted = nearestRoad(spot.x + (n - 1.5) * 6, spot.z + 20);
		const car = makeCar(shifted.x, shifted.z, yawTo(spot.x, spot.z, next.x, next.z), "traffic", 14014687, wps, {
			police: true,
			driver: true,
			ride: "cruiser"
		});
		car.speed = 12;
		cars.push(car);
	}
	cars.push(makeCar(16, -8, Math.PI, "locked", 16052714, [], {
		ride: "sport",
		forSale: true,
		driver: false
	}));
	const civColors = [
		7244974,
		12872522,
		14272417,
		5073746,
		9068656,
		12165466
	];
	function addPed(x, z, faction, color, goals) {
		peds.push({
			x,
			z,
			yaw: rand() * Math.PI * 2,
			hp: faction === "cop" ? 120 : faction === "civ" ? 70 : 100,
			faction,
			state: "walk",
			active: faction !== "cop",
			cd: rand() * .8,
			goal: 0,
			goals,
			color,
			bob: rand() * 10,
			respawn: 0,
			dive: 0,
			mark: 0,
			ally: false
		});
	}
	for (let i = 0; i < 12; i++) {
		const gx = i % GRID;
		const gz = Math.floor(i / GRID) % GRID;
		if (gx === 2 && gz === 2) {
			addPed(-8 + rand() * 6, -14, "civ", civColors[i % civColors.length], [{
				x: -12,
				z: -14
			}, {
				x: 12,
				z: -14
			}]);
			continue;
		}
		const ox = -125 + gx * CELL;
		const oz = -125 + gz * CELL;
		const x = ox + ROAD / 2 + 1.3;
		addPed(x, oz + 16 + rand() * 22, "civ", civColors[i % civColors.length], [{
			x,
			z: oz + 14
		}, {
			x,
			z: oz + CELL - 14
		}]);
	}
	addPed(-14, -6, "amber", 14721088, [{
		x: -18,
		z: -8
	}, {
		x: -6,
		z: 4
	}]);
	addPed(-16, 8, "amber", 13206570, [{
		x: -20,
		z: 10
	}, {
		x: -4,
		z: -2
	}]);
	addPed(-10, -12, "amber", 15778122, [{
		x: -8,
		z: -16
	}, {
		x: -2,
		z: 6
	}]);
	addPed(-20, 2, "amber", 12093024, [{
		x: -22,
		z: 0
	}, {
		x: -6,
		z: 8
	}]);
	addPed(-8, 14, "amber", 14131546, [{
		x: -12,
		z: 12
	}, {
		x: -2,
		z: 2
	}]);
	addPed(14, 6, "teal", 4116408, [{
		x: 18,
		z: 8
	}, {
		x: 6,
		z: -4
	}]);
	addPed(16, -8, "teal", 2068358, [{
		x: 20,
		z: -10
	}, {
		x: 4,
		z: 2
	}]);
	addPed(10, 12, "teal", 8315088, [{
		x: 8,
		z: 16
	}, {
		x: 2,
		z: -6
	}]);
	addPed(20, -2, "teal", 4831400, [{
		x: 22,
		z: 0
	}, {
		x: 6,
		z: -8
	}]);
	addPed(8, -14, "teal", 2792847, [{
		x: 12,
		z: -12
	}, {
		x: 2,
		z: 2
	}]);
	addPed(-66, -8, "amber", 14721088, [{
		x: -66,
		z: -16
	}, {
		x: -66,
		z: 18
	}]);
	addPed(-66, 14, "amber", 13206570, [{
		x: -66,
		z: 6
	}, {
		x: -66,
		z: 28
	}]);
	addPed(-66, 42, "amber", 15778122, [{
		x: -66,
		z: 34
	}, {
		x: -66,
		z: 52
	}]);
	addPed(66, -8, "teal", 4116408, [{
		x: 66,
		z: -16
	}, {
		x: 66,
		z: 18
	}]);
	addPed(66, 14, "teal", 2068358, [{
		x: 66,
		z: 6
	}, {
		x: 66,
		z: 28
	}]);
	addPed(66, 42, "teal", 8315088, [{
		x: 66,
		z: 34
	}, {
		x: 66,
		z: 52
	}]);
	for (let i = 0; i < 6; i++) {
		const rx = roadXs[i % 4 + 1];
		const rz = roadZs[i % 3 + 1];
		const x = rx + 9;
		addPed(x, rz + 18, "civ", civColors[i % civColors.length], [{
			x,
			z: rz + 14
		}, {
			x,
			z: rz + 32
		}]);
	}
	for (let i = 0; i < 4; i++) addPed(80, 80, "cop", 2372166, [{
		x: 0,
		z: 0
	}, {
		x: 0,
		z: 0
	}]);
	for (const [x, z, kind] of [
		[
			-14,
			-14,
			"med"
		],
		[
			14,
			14,
			"med"
		],
		[
			-14,
			14,
			"armor"
		],
		[
			14,
			-14,
			"armor"
		],
		[
			0,
			16,
			"med"
		],
		[
			-40,
			20,
			"med"
		],
		[
			40,
			-30,
			"armor"
		]
	]) pickups.push({
		x,
		z,
		kind,
		wait: 0
	});
	let renderer;
	try {
		renderer = new WebGLRenderer({
			canvas,
			antialias: true,
			alpha: false,
			powerPreference: "high-performance"
		});
	} catch (err) {
		error = err instanceof Error ? err.message : "WebGL failed";
		const deadHandle = {
			start() {},
			respawn() {},
			dispose() {},
			touch
		};
		onHud(snapshot());
		return deadHandle;
	}
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
	renderer.outputColorSpace = SRGBColorSpace;
	renderer.toneMapping = 4;
	renderer.toneMappingExposure = 1.08;
	renderer.setClearColor(460814, 1);
	const scene = new Scene();
	scene.background = new Color(460814);
	scene.fog = new Fog(1052180, 70, 250);
	const camera = new PerspectiveCamera(68, 1, .1, 480);
	const hemi = new HemisphereLight(9347272, 2759700, .72);
	scene.add(hemi);
	const moon = new DirectionalLight(14148351, 1.35);
	moon.position.set(-80, 120, 40);
	scene.add(moon);
	const plazaLight = new PointLight(16756768, 8, 36, 1.5);
	plazaLight.position.set(0, 5.2, 0);
	scene.add(plazaLight);
	const amberLight = new PointLight(16756768, 7, 56, 1.55);
	amberLight.position.set(-62, 8, 10);
	scene.add(amberLight);
	const tealLight = new PointLight(4120773, 7, 56, 1.55);
	tealLight.position.set(62, 8, 10);
	scene.add(tealLight);
	const fillWest = new PointLight(16738874, 4.2, 40, 1.8);
	fillWest.position.set(-28, 6, -40);
	scene.add(fillWest);
	const fillEast = new PointLight(10406143, 3.4, 36, 1.8);
	fillEast.position.set(28, 9, 42);
	scene.add(fillEast);
	const head = new SpotLight(16769712, 0, 48, .55, .42, 1.15);
	head.position.set(0, 2, 0);
	scene.add(head);
	scene.add(head.target);
	const skyCanvas = document.createElement("canvas");
	skyCanvas.width = 64;
	skyCanvas.height = 1024;
	const sg = skyCanvas.getContext("2d");
	const grad = sg.createLinearGradient(0, 0, 0, 1024);
	grad.addColorStop(0, "#04060c");
	grad.addColorStop(.22, "#0c1018");
	grad.addColorStop(.48, "#16141e");
	grad.addColorStop(.66, "#2a1a14");
	grad.addColorStop(.78, "#6a341c");
	grad.addColorStop(.88, "#1c120e");
	grad.addColorStop(1, "#07080c");
	sg.fillStyle = grad;
	sg.fillRect(0, 0, 64, 1024);
	sg.globalAlpha = .16;
	for (let i = 0; i < 9; i++) {
		sg.fillStyle = i % 2 ? "#9eb0c8" : "#d2c2a8";
		const y = 140 + i * 62;
		sg.beginPath();
		sg.ellipse(32, y, 40, 10 + i % 3 * 4, 0, 0, Math.PI * 2);
		sg.fill();
	}
	sg.globalAlpha = 1;
	const skyTex = new CanvasTexture(skyCanvas);
	skyTex.colorSpace = SRGBColorSpace;
	const sky = new Mesh(new SphereGeometry(380, 32, 24), new MeshBasicMaterial({
		map: skyTex,
		side: 1,
		depthWrite: false,
		fog: false
	}));
	scene.add(sky);
	const moonDisc = new Mesh(new SphereGeometry(9, 24, 18), new MeshBasicMaterial({
		color: 16183782,
		fog: false
	}));
	moonDisc.position.set(-130, 168, -190);
	scene.add(moonDisc);
	const moonHalo = new Mesh(new SphereGeometry(26, 18, 14), new MeshBasicMaterial({
		color: 15986660,
		transparent: true,
		opacity: .09,
		fog: false,
		depthWrite: false
	}));
	moonHalo.position.copy(moonDisc.position);
	scene.add(moonHalo);
	const starCount = 180;
	const starArr = /* @__PURE__ */ new Float32Array(540);
	for (let i = 0; i < starCount; i++) {
		const ang = rand() * Math.PI * 2;
		const rad = 220 + rand() * 90;
		starArr[i * 3] = Math.cos(ang) * rad;
		starArr[i * 3 + 1] = 50 + rand() * 160;
		starArr[i * 3 + 2] = Math.sin(ang) * rad;
	}
	const starGeo = new BufferGeometry();
	starGeo.setAttribute("position", new BufferAttribute(starArr, 3));
	const stars = new Points(starGeo, new PointsMaterial({
		color: 15986660,
		size: 1.35,
		sizeAttenuation: true,
		fog: false
	}));
	scene.add(stars);
	const groundTex = makeGroundTexture(roadXs, roadZs);
	const ground = new Mesh(new PlaneGeometry(330, 330), new MeshStandardMaterial({
		map: groundTex,
		roughness: .58,
		metalness: .22,
		color: 16777215
	}));
	ground.rotation.x = -Math.PI / 2;
	scene.add(ground);
	const winTex = makeWindowTexture();
	const bMat = new MeshStandardMaterial({
		map: winTex,
		emissive: new Color(16761466),
		emissiveMap: winTex,
		emissiveIntensity: 1.45,
		roughness: .84,
		metalness: .06
	});
	bMat.onBeforeCompile = (shader) => {
		shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
         varying vec3 vWorldPos;
         varying vec3 vObjN;`).replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>
         vObjN = objectNormal;`).replace("#include <project_vertex>", `#include <project_vertex>
         vWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;`);
		shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
         varying vec3 vWorldPos;
         varying vec3 vObjN;`).replace("#include <map_fragment>", `{
           vec3 an = abs(vObjN);
           vec4 sampledDiffuseColor;
           if (an.y > 0.65) sampledDiffuseColor = vec4(0.045, 0.048, 0.058, 1.0);
           else {
             vec2 tile = an.x > an.z ? vWorldPos.zy : vWorldPos.xy;
             tile *= vec2(0.28, 0.16);
             sampledDiffuseColor = texture2D(map, tile);
             float cell = floor(tile.x * 3.1) + floor(tile.y * 2.2) * 19.0;
             float flick = fract(sin(cell * 12.9898 + floor(vWorldPos.x * 0.17) + floor(vWorldPos.z * 0.13) * 4.2) * 43758.5453);
             float keep = smoothstep(0.42, 0.58, flick);
             vec3 concrete = vec3(0.045, 0.048, 0.055);
             sampledDiffuseColor.rgb = mix(concrete, sampledDiffuseColor.rgb, keep);
             float sx = vWorldPos.x;
             float sz = vWorldPos.z;
             float kind = 3.0;
             if (abs(sx) < 30.0 && abs(sz) < 30.0) kind = 4.0;
             else if (abs(sx) > 82.0 || abs(sz) > 82.0) kind = 0.0;
             else if (sx < -28.0) kind = 1.0;
             else if (sx > 28.0) kind = 2.0;
             if (kind < 0.5) {
               float band = smoothstep(0.78, 0.96, fract(vWorldPos.y * 0.085));
               sampledDiffuseColor.rgb = mix(vec3(0.20, 0.20, 0.18), vec3(0.07, 0.07, 0.07), band);
               sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, vec3(0.62, 0.46, 0.24), step(0.78, flick) * 0.45);
             } else if (kind < 1.5) {
               float course = smoothstep(0.86, 0.98, fract(vWorldPos.y * 1.7));
               vec3 brick = mix(vec3(0.46, 0.20, 0.13), vec3(0.30, 0.13, 0.09), flick);
               sampledDiffuseColor.rgb = mix(brick, vec3(0.10, 0.06, 0.05), course);
               sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, vec3(1.0, 0.62, 0.26), step(0.58, flick) * step(3.4, vWorldPos.y) * 0.8);
             } else if (kind < 2.5) {
               float mull = smoothstep(0.0, 0.12, fract(tile.x * 1.6)) * smoothstep(0.0, 0.12, 1.0 - fract(tile.x * 1.6));
               vec3 glass = mix(vec3(0.04, 0.10, 0.12), vec3(0.20, 0.72, 0.66), keep);
               sampledDiffuseColor.rgb = mix(vec3(0.015, 0.03, 0.035), glass, mull);
             } else if (kind < 3.5) {
               float gold = smoothstep(0.93, 0.995, fract(vWorldPos.y * 0.105));
               sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, vec3(0.78, 0.62, 0.30), gold);
             } else {
               float joint = smoothstep(0.9, 0.99, fract(vWorldPos.y * 0.2));
               sampledDiffuseColor.rgb = mix(vec3(0.58, 0.54, 0.46), vec3(0.34, 0.32, 0.28), joint);
               sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, vec3(0.95, 0.78, 0.48), step(0.82, flick) * 0.4);
             }
             float floorBand = smoothstep(0.92, 0.99, fract(vWorldPos.y * 0.21));
             sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, vec3(0.05, 0.052, 0.06), floorBand);
             if (vWorldPos.y < 3.15 && kind > 1.5) {
               float span = an.x > an.z ? vWorldPos.z : vWorldPos.x;
               float wx = fract(span * 0.22);
               float wy = clamp(vWorldPos.y / 3.15, 0.0, 1.0);
               float pane = step(0.06, wx) * step(wx, 0.94) * step(0.18, wy) * step(wy, 0.92);
               float seed = fract(sin(floor(span * 0.22) * 91.7 + floor(vWorldPos.x + vWorldPos.z) * 12.3) * 43758.5);
               vec3 frame = vec3(0.035, 0.037, 0.045);
               vec3 glass = vec3(0.07, 0.08, 0.09);
               vec3 warm = vec3(1.0, 0.58, 0.2);
               vec3 cool = vec3(0.22, 0.72, 0.66);
               vec3 glow = mix(warm, cool, step(18.0, abs(vWorldPos.x)));
               float lit = step(0.62, seed);
               vec3 shop = mix(frame, mix(glass, glow * 0.72, lit), pane);
               sampledDiffuseColor.rgb = shop;
             }
           }
           diffuseColor *= sampledDiffuseColor;
         }`).replace("#include <emissivemap_fragment>", `{
           vec3 anE = abs(vObjN);
           if (anE.y > 0.65 || vWorldPos.y < 3.15) totalEmissiveRadiance = vec3(0.0);
           else {
             vec2 tileE = anE.x > anE.z ? vWorldPos.zy : vWorldPos.xy;
             tileE *= vec2(0.28, 0.16);
             totalEmissiveRadiance *= texture2D(emissiveMap, tileE).rgb * 1.55;
             float cellE = floor(tileE.x * 3.1) + floor(tileE.y * 2.2) * 19.0;
             float flickE = fract(sin(cellE * 12.9898 + floor(vWorldPos.x * 0.17) + floor(vWorldPos.z * 0.13) * 4.2) * 43758.5453);
             totalEmissiveRadiance *= smoothstep(0.42, 0.62, flickE);
             float kindE = 3.0;
             if (abs(vWorldPos.x) < 30.0 && abs(vWorldPos.z) < 30.0) kindE = 4.0;
             else if (abs(vWorldPos.x) > 82.0 || abs(vWorldPos.z) > 82.0) kindE = 0.0;
             else if (vWorldPos.x < -28.0) kindE = 1.0;
             else if (vWorldPos.x > 28.0) kindE = 2.0;
             if (kindE < 0.5) totalEmissiveRadiance *= 0.12;
             else if (kindE < 1.5) totalEmissiveRadiance = mix(totalEmissiveRadiance, vec3(1.0, 0.42, 0.12), 0.62);
             else if (kindE < 2.5) totalEmissiveRadiance = mix(totalEmissiveRadiance, vec3(0.12, 0.75, 0.68), 0.7) * 1.25;
             else if (kindE > 3.5) totalEmissiveRadiance *= 0.22;
           }
           if (anE.y < 0.65 && vWorldPos.y < 3.15 && vWorldPos.x > -28.0 && !(abs(vWorldPos.x) > 82.0 || abs(vWorldPos.z) > 82.0)) {
             float spanE = anE.x > anE.z ? vWorldPos.z : vWorldPos.x;
             float wxE = fract(spanE * 0.22);
             float wyE = clamp(vWorldPos.y / 3.15, 0.0, 1.0);
             float paneE = step(0.06, wxE) * step(wxE, 0.94) * step(0.18, wyE) * step(wyE, 0.92);
             float seedE = fract(sin(floor(spanE * 0.22) * 91.7 + floor(vWorldPos.x + vWorldPos.z) * 12.3) * 43758.5);
             vec3 warmE = vec3(1.0, 0.55, 0.18);
             vec3 coolE = vec3(0.2, 0.85, 0.75);
             vec3 glowE = mix(warmE, coolE, step(18.0, abs(vWorldPos.x)));
             totalEmissiveRadiance += glowE * paneE * step(0.62, seedE) * 0.85;
           }
         }`);
	};
	const bGeo = new BoxGeometry(1, 1, 1);
	const buildingMesh = new InstancedMesh(bGeo, bMat, staticBlocks.length);
	buildingMesh.frustumCulled = false;
	const shopCanvas = document.createElement("canvas");
	shopCanvas.width = 128;
	shopCanvas.height = 64;
	const shopG = shopCanvas.getContext("2d");
	shopG.fillStyle = "#14120e";
	shopG.fillRect(0, 0, 128, 64);
	shopG.fillStyle = "#0a0908";
	shopG.fillRect(0, 0, 128, 8);
	const shopLits = [
		"#ffb020",
		"#1a140c",
		"#f3efe4",
		"#1a140c",
		"#3a6a66",
		"#1a140c"
	];
	for (let i = 0; i < 4; i++) {
		shopG.fillStyle = "#07080c";
		shopG.fillRect(8 + i * 30, 14, 24, 40);
		shopG.fillStyle = shopLits[i % shopLits.length];
		shopG.fillRect(10 + i * 30, 16, 20, 36);
	}
	const shopTex = new CanvasTexture(shopCanvas);
	shopTex.colorSpace = SRGBColorSpace;
	shopTex.wrapS = RepeatWrapping;
	shopTex.wrapT = ClampToEdgeWrapping;
	const podiumMat = new MeshStandardMaterial({
		map: shopTex,
		emissive: new Color(16756768),
		emissiveMap: shopTex,
		emissiveIntensity: .85,
		roughness: .72,
		metalness: .12,
		color: 3814444
	});
	const podiumMesh = new InstancedMesh(bGeo, podiumMat, staticBlocks.length);
	podiumMesh.frustumCulled = false;
	const midMat = new MeshStandardMaterial({
		color: 12891290,
		roughness: .62,
		metalness: .18
	});
	const midMesh = new InstancedMesh(bGeo, midMat, staticBlocks.length);
	midMesh.frustumCulled = false;
	const finMat = new MeshStandardMaterial({
		color: 9363668,
		emissive: 1333328,
		emissiveIntensity: .6,
		roughness: .25,
		metalness: .72
	});
	const finMesh = new InstancedMesh(bGeo, finMat, staticBlocks.length);
	finMesh.frustumCulled = false;
	const beltMat = new MeshStandardMaterial({
		color: 2763816,
		roughness: .9,
		metalness: .05
	});
	const beltMesh = new InstancedMesh(bGeo, beltMat, staticBlocks.length);
	beltMesh.frustumCulled = false;
	const tint = new Color();
	const m = new Matrix4();
	const qid = new Quaternion();
	const hide = () => m.compose(new Vector3(0, -40, 0), qid, new Vector3(.001, .001, .001));
	staticBlocks.forEach((b, i) => {
		const g = massing(b);
		const crownH = Math.max(.4, b.h - g.podiumH - g.midH);
		const towerW = Math.max(1.4, g.fullW - g.inset * 2);
		const towerD = Math.max(1.4, g.fullD - g.inset * 2);
		m.compose(new Vector3(g.cx, g.podiumH + g.midH + crownH / 2, g.cz), qid, new Vector3(towerW, crownH, towerD));
		buildingMesh.setMatrixAt(i, m);
		if (g.podiumH > .2) m.compose(new Vector3(g.cx, g.podiumH / 2, g.cz), qid, new Vector3(g.fullW, g.podiumH, g.fullD));
		else hide();
		podiumMesh.setMatrixAt(i, m);
		if (g.midH > .4) {
			const mw = Math.max(1.6, g.fullW - g.midInset * 2);
			const md = Math.max(1.6, g.fullD - g.midInset * 2);
			m.compose(new Vector3(g.cx, g.podiumH + g.midH / 2, g.cz), qid, new Vector3(mw, g.midH, md));
			midMesh.setMatrixAt(i, m);
			midMesh.setColorAt(i, tint.setHex(14206116));
		} else hide();
		if (g.midH <= .4) midMesh.setMatrixAt(i, m);
		if (g.style === "glass" && b.h > 10) m.compose(new Vector3(g.cx, g.podiumH + crownH * .55, g.cz + towerD / 2 + .12), qid, new Vector3(Math.max(.8, towerW * .72), crownH * .72, .22));
		else hide();
		finMesh.setMatrixAt(i, m);
		if (g.style === "brutal" && b.h > 8) m.compose(new Vector3(g.cx, b.h * .46, g.cz), qid, new Vector3(g.fullW + .7, .85, g.fullD + .7));
		else if (g.style === "brick" && b.h > 7) m.compose(new Vector3(g.cx, b.h + .7, g.cz), qid, new Vector3(Math.min(4.2, g.fullW * .35), 1.3, Math.min(3.2, g.fullD * .28)));
		else hide();
		beltMesh.setMatrixAt(i, m);
		const styleHex = g.style === "brick" ? 16777215 : g.style === "glass" ? 14221304 : g.style === "civic" ? 16052196 : g.style === "deco" ? 16774884 : 13684936;
		buildingMesh.setColorAt(i, tint.setHex(styleHex));
	});
	buildingMesh.instanceMatrix.needsUpdate = true;
	podiumMesh.instanceMatrix.needsUpdate = true;
	midMesh.instanceMatrix.needsUpdate = true;
	finMesh.instanceMatrix.needsUpdate = true;
	beltMesh.instanceMatrix.needsUpdate = true;
	if (buildingMesh.instanceColor) buildingMesh.instanceColor.needsUpdate = true;
	if (midMesh.instanceColor) midMesh.instanceColor.needsUpdate = true;
	scene.add(podiumMesh);
	scene.add(midMesh);
	scene.add(buildingMesh);
	scene.add(finMesh);
	scene.add(beltMesh);
	const roofMesh = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({
		color: 1053208,
		roughness: .9,
		metalness: .05
	}), staticBlocks.length);
	roofMesh.frustumCulled = false;
	staticBlocks.forEach((b, i) => {
		if (b.h < 4) hide();
		else {
			const g = massing(b);
			const w = Math.max(1.5, g.fullW - g.inset * 2) + (g.style === "brick" ? .9 : .35);
			const d = Math.max(1.5, g.fullD - g.inset * 2) + (g.style === "brick" ? .9 : .35);
			const lip = g.style === "deco" ? .7 : g.style === "civic" ? .55 : .38;
			m.compose(new Vector3(g.cx, b.h + .2, g.cz), qid, new Vector3(w, lip, d));
		}
		roofMesh.setMatrixAt(i, m);
	});
	roofMesh.instanceMatrix.needsUpdate = true;
	scene.add(roofMesh);
	const corniceMat = new MeshStandardMaterial({
		color: 2303534,
		roughness: .48,
		metalness: .42
	});
	const corniceMesh = new InstancedMesh(new BoxGeometry(1, 1, 1), corniceMat, staticBlocks.length);
	corniceMesh.frustumCulled = false;
	staticBlocks.forEach((b, i) => {
		if (b.h < 6) {
			hide();
			corniceMesh.setMatrixAt(i, m);
			corniceMesh.setColorAt(i, tint.setHex(2303534));
			return;
		}
		const g = massing(b);
		const w = Math.max(1.6, g.fullW - g.inset * 2) + (g.style === "brick" || g.style === "deco" ? 1.15 : .55);
		const d = Math.max(1.6, g.fullD - g.inset * 2) + (g.style === "brick" || g.style === "deco" ? 1.15 : .55);
		const thick = g.style === "deco" ? .7 : g.style === "civic" ? .62 : g.style === "brick" ? .5 : .32;
		m.compose(new Vector3(g.cx, b.h - .12, g.cz), qid, new Vector3(w, thick, d));
		corniceMesh.setMatrixAt(i, m);
		const hex = g.style === "deco" ? 13351306 : g.style === "brick" ? 6963252 : g.style === "glass" ? 10475986 : g.style === "civic" ? 14998728 : 3816504;
		corniceMesh.setColorAt(i, tint.setHex(hex));
	});
	corniceMesh.instanceMatrix.needsUpdate = true;
	if (corniceMesh.instanceColor) corniceMesh.instanceColor.needsUpdate = true;
	scene.add(corniceMesh);
	const tallBlocks = staticBlocks.filter((b) => b.h > 16 && blockStyle((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, b.h) !== "brick");
	const mechMat = new MeshStandardMaterial({
		color: 2764342,
		roughness: .62,
		metalness: .28
	});
	const mechMesh = new InstancedMesh(new BoxGeometry(1, 1, 1), mechMat, Math.max(1, tallBlocks.length));
	mechMesh.frustumCulled = false;
	tallBlocks.forEach((b, i) => {
		const w = Math.min(4.2, (b.maxX - b.minX) * .28);
		const d = Math.min(3.2, (b.maxZ - b.minZ) * .24);
		m.compose(new Vector3(b.minX + w * .7 + .6, b.h + 1.15, b.minZ + d * .7 + .6), qid, new Vector3(w, 1.7, d));
		mechMesh.setMatrixAt(i, m);
	});
	if (tallBlocks.length === 0) mechMesh.setMatrixAt(0, m.compose(new Vector3(0, -30, 0), qid, new Vector3(.001, .001, .001)));
	mechMesh.instanceMatrix.needsUpdate = true;
	scene.add(mechMesh);
	const spires = staticBlocks.filter((b) => b.h > 24 && blockStyle((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, b.h) === "deco");
	const spireMesh = new InstancedMesh(new CylinderGeometry(.06, .08, 1, 5), new MeshStandardMaterial({
		color: 13351306,
		roughness: .4,
		metalness: .6
	}), Math.max(1, spires.length));
	spireMesh.frustumCulled = false;
	spires.forEach((b, i) => {
		m.compose(new Vector3((b.minX + b.maxX) / 2, b.h + 3.4, (b.minZ + b.maxZ) / 2), qid, new Vector3(1, 6.2, 1));
		spireMesh.setMatrixAt(i, m);
	});
	if (spires.length === 0) spireMesh.setMatrixAt(0, m.compose(new Vector3(0, -30, 0), qid, new Vector3(.001, .001, .001)));
	spireMesh.instanceMatrix.needsUpdate = true;
	scene.add(spireMesh);
	const treeSpots = [];
	for (let gx = 0; gx < GRID; gx++) for (let gz = 0; gz < GRID; gz++) {
		if (gx === 2 && gz === 2) continue;
		const ox = -125 + gx * CELL;
		const oz = -125 + gz * CELL;
		const candidates = [
			[ox + ROAD / 2 + 2.6, oz + 11],
			[ox + CELL - ROAD / 2 - 2.6, oz + CELL * .62],
			[ox + CELL * .42, oz + ROAD / 2 + 2.6],
			[ox + CELL * .7, oz + CELL - ROAD / 2 - 2.8]
		];
		for (const [x, z] of candidates) {
			if (staticBlocks.some((b) => x > b.minX - 1.1 && x < b.maxX + 1.1 && z > b.minZ - 1.1 && z < b.maxZ + 1.1)) continue;
			if (roadXs.some((rx) => Math.abs(x - rx) < 8.6)) continue;
			if (roadZs.some((rz) => Math.abs(z - rz) < 8.6)) continue;
			treeSpots.push({
				x,
				z,
				s: .75 + rand() * .55
			});
		}
	}
	const trunkMesh = new InstancedMesh(new CylinderGeometry(.12, .16, 1, 6), new MeshStandardMaterial({
		color: 3811874,
		roughness: .9
	}), Math.max(1, treeSpots.length));
	const canopyGeo = new ConeGeometry(1.15, 2.1, 7);
	const canopyMesh = new InstancedMesh(canopyGeo, new MeshStandardMaterial({
		color: 1848104,
		roughness: .86
	}), Math.max(1, treeSpots.length));
	const canopy2 = new InstancedMesh(new ConeGeometry(.72, 1.35, 6), new MeshStandardMaterial({
		color: 2373676,
		roughness: .84
	}), Math.max(1, treeSpots.length));
	trunkMesh.frustumCulled = false;
	canopyMesh.frustumCulled = false;
	canopy2.frustumCulled = false;
	treeSpots.forEach((t, i) => {
		m.compose(new Vector3(t.x, 1.05, t.z), qid, new Vector3(1, 2.1, 1));
		trunkMesh.setMatrixAt(i, m);
		m.compose(new Vector3(t.x, 2.55, t.z), qid, new Vector3(t.s, t.s, t.s));
		canopyMesh.setMatrixAt(i, m);
		m.compose(new Vector3(t.x + .15, 3.35, t.z - .1), qid, new Vector3(t.s * .85, t.s * .9, t.s * .85));
		canopy2.setMatrixAt(i, m);
		canopyMesh.setColorAt(i, tint.setHex(i % 3 === 0 ? 1980972 : i % 3 === 1 ? 1454120 : 2373160));
	});
	if (treeSpots.length === 0) {
		m.compose(new Vector3(0, -30, 0), qid, new Vector3(.001, .001, .001));
		trunkMesh.setMatrixAt(0, m);
		canopyMesh.setMatrixAt(0, m);
		canopy2.setMatrixAt(0, m);
	}
	trunkMesh.instanceMatrix.needsUpdate = true;
	canopyMesh.instanceMatrix.needsUpdate = true;
	canopy2.instanceMatrix.needsUpdate = true;
	if (canopyMesh.instanceColor) canopyMesh.instanceColor.needsUpdate = true;
	scene.add(trunkMesh);
	scene.add(canopyMesh);
	scene.add(canopy2);
	const curbList = [];
	for (let i = 0; i < roadXs.length; i++) {
		const x = roadXs[i];
		for (let j = 0; j < roadZs.length - 1; j++) {
			const z0 = roadZs[j] + ROAD / 2 + .55;
			const z1 = roadZs[j + 1] - ROAD / 2 - .55;
			const len = z1 - z0;
			if (len < 3) continue;
			const mid = (z0 + z1) / 2;
			curbList.push([
				x - ROAD / 2,
				mid,
				.32,
				len
			]);
			curbList.push([
				x + ROAD / 2,
				mid,
				.32,
				len
			]);
		}
	}
	for (let j = 0; j < roadZs.length; j++) {
		const z = roadZs[j];
		for (let i = 0; i < roadXs.length - 1; i++) {
			const x0 = roadXs[i] + ROAD / 2 + .55;
			const x1 = roadXs[i + 1] - ROAD / 2 - .55;
			const len = x1 - x0;
			if (len < 3) continue;
			const mid = (x0 + x1) / 2;
			curbList.push([
				mid,
				z - ROAD / 2,
				len,
				.32
			]);
			curbList.push([
				mid,
				z + ROAD / 2,
				len,
				.32
			]);
		}
	}
	const curbMesh = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({
		color: 3815476,
		roughness: .86,
		metalness: .04
	}), Math.max(1, curbList.length));
	curbMesh.frustumCulled = false;
	curbList.forEach(([x, z, sx, sz], i) => {
		m.compose(new Vector3(x, .11, z), qid, new Vector3(sx, .22, sz));
		curbMesh.setMatrixAt(i, m);
	});
	if (curbList.length === 0) curbMesh.setMatrixAt(0, m.compose(new Vector3(0, -20, 0), qid, new Vector3(.001, .001, .001)));
	curbMesh.instanceMatrix.needsUpdate = true;
	scene.add(curbMesh);
	const lampCount = roadXs.length * roadZs.length;
	const poleGeo = new CylinderGeometry(.08, .11, 7.4, 6);
	const poleMesh = new InstancedMesh(poleGeo, new MeshStandardMaterial({
		color: 1842724,
		roughness: .45,
		metalness: .55
	}), lampCount);
	const lampArmGeo = new BoxGeometry(1.15, .08, .08);
	const armMesh = new InstancedMesh(lampArmGeo, new MeshStandardMaterial({
		color: 2763826,
		roughness: .4,
		metalness: .6
	}), lampCount);
	const bulbGeo = new SphereGeometry(.28, 10, 8);
	const bulbMesh = new InstancedMesh(bulbGeo, new MeshStandardMaterial({
		color: 16773580,
		emissive: 16756768,
		emissiveIntensity: 2.4,
		roughness: .25
	}), lampCount);
	poleMesh.frustumCulled = false;
	armMesh.frustumCulled = false;
	bulbMesh.frustumCulled = false;
	let li = 0;
	for (const x of roadXs) for (const z of roadZs) {
		const lx = x + ROAD / 2 + .55;
		const lz = z + ROAD / 2 + .55;
		m.compose(new Vector3(lx, 3.7, lz), qid, new Vector3(1, 1, 1));
		poleMesh.setMatrixAt(li, m);
		m.compose(new Vector3(lx - .45, 7.2, lz), qid, new Vector3(1, 1, 1));
		armMesh.setMatrixAt(li, m);
		m.compose(new Vector3(lx - .95, 7.05, lz), qid, new Vector3(1, 1, 1));
		bulbMesh.setMatrixAt(li, m);
		li++;
	}
	poleMesh.instanceMatrix.needsUpdate = true;
	armMesh.instanceMatrix.needsUpdate = true;
	bulbMesh.instanceMatrix.needsUpdate = true;
	scene.add(poleMesh);
	scene.add(armMesh);
	scene.add(bulbMesh);
	const poolGeo = new CircleGeometry(3.4, 14);
	poolGeo.rotateX(-Math.PI / 2);
	const poolMesh = new InstancedMesh(poolGeo, new MeshBasicMaterial({
		color: 16756768,
		transparent: true,
		opacity: .16,
		depthWrite: false
	}), lampCount);
	poolMesh.frustumCulled = false;
	for (let i = 0; i < lampCount; i++) {
		const xi = Math.floor(i / roadZs.length);
		const zi = i % roadZs.length;
		const x = roadXs[xi];
		const z = roadZs[zi];
		m.compose(new Vector3(x + ROAD / 2 - .4, .05, z + ROAD / 2 + .55), qid, new Vector3(1.35, 1, 1.35));
		poolMesh.setMatrixAt(i, m);
	}
	poolMesh.instanceMatrix.needsUpdate = true;
	scene.add(poolMesh);
	const stone = new MeshStandardMaterial({
		color: 10130310,
		roughness: .72,
		metalness: .08
	});
	const fountain = new Mesh(new CylinderGeometry(3.2, 3.8, .85, 24), stone);
	fountain.position.set(0, .42, 0);
	scene.add(fountain);
	const lip = new Mesh(new TorusGeometry(2.35, .16, 8, 24), new MeshStandardMaterial({
		color: 13351306,
		roughness: .35,
		metalness: .45
	}));
	lip.rotation.x = Math.PI / 2;
	lip.position.set(0, .86, 0);
	scene.add(lip);
	const water = new Mesh(new CircleGeometry(2.15, 28), new MeshStandardMaterial({
		color: 1325118,
		emissive: 798776,
		emissiveIntensity: .7,
		roughness: .12,
		metalness: .35
	}));
	water.rotation.x = -Math.PI / 2;
	water.position.set(0, .9, 0);
	scene.add(water);
	const jet = new Mesh(new CylinderGeometry(.08, .16, 1.6, 8), new MeshStandardMaterial({
		color: 14151410,
		emissive: 10474720,
		emissiveIntensity: .4,
		transparent: true,
		opacity: .55,
		roughness: .1
	}));
	jet.position.set(0, 1.7, 0);
	scene.add(jet);
	const crateGeo = new BoxGeometry(1, 1, 1);
	const crateMat = new MeshStandardMaterial({
		color: 6968900,
		roughness: .85
	});
	const crateMesh = new InstancedMesh(crateGeo, crateMat, 3);
	blocks.slice(-3).forEach((b, i) => {
		m.compose(new Vector3((b.minX + b.maxX) / 2, b.h / 2, (b.minZ + b.maxZ) / 2), qid, new Vector3(b.maxX - b.minX, b.h, b.maxZ - b.minZ));
		crateMesh.setMatrixAt(i, m);
	});
	scene.add(crateMesh);
	const signs = [
		"LIQUOR",
		"MOTEL",
		"GUNS",
		"DINER",
		"BAIL",
		"CASH",
		"VICE",
		"24 HR"
	];
	const signColors = [
		["#ffb020", "#1a1208"],
		["#f3efe4", "#5a1a1a"],
		["#ffb020", "#14171f"],
		["#e23b3b", "#140c0c"],
		["#f3efe4", "#14221f"],
		["#ffb020", "#20160c"],
		["#3ee0c5", "#071412"],
		["#f3efe4", "#1a1208"]
	];
	const signMeshes = [];
	staticBlocks.filter((b) => b.h > 10).slice(0, signs.length).forEach((b, i) => {
		const tex = makeSign(signs[i], signColors[i][0], signColors[i][1]);
		const mesh = new Mesh(new BoxGeometry(6.2, 2.3, .32), new MeshBasicMaterial({ map: tex }));
		mesh.position.set(b.maxX + .08, Math.min(b.h * .45, 14), (b.minZ + b.maxZ) / 2);
		mesh.rotation.y = Math.PI / 2;
		scene.add(mesh);
		signMeshes.push(mesh);
	});
	const amberSign = new Mesh(new BoxGeometry(7.2, 2.4, .32), new MeshBasicMaterial({ map: makeSign("AMBER", "#ffb020", "#1a1208") }));
	amberSign.position.set(-60, 7.2, 12);
	amberSign.rotation.y = -Math.PI / 2;
	scene.add(amberSign);
	const tealSign = new Mesh(new BoxGeometry(7.2, 2.4, .32), new MeshBasicMaterial({ map: makeSign("TEAL", "#3ee0c5", "#071412") }));
	tealSign.position.set(60, 7.2, 12);
	tealSign.rotation.y = Math.PI / 2;
	scene.add(tealSign);
	const lotSign = new Mesh(new PlaneGeometry(3.4, 1.3), new MeshBasicMaterial({ map: makeSign("LOT", "#ffb020", "#14120c") }));
	lotSign.position.set(LOT.x, 3.1, LOT.z + .7);
	scene.add(lotSign);
	const postMat = new MeshStandardMaterial({
		color: 16777215,
		roughness: .45,
		metalness: .15,
		emissive: 2758664,
		emissiveIntensity: .45
	});
	const postMesh = new InstancedMesh(new CylinderGeometry(.16, .28, 2.6, 6), postMat, spots.length);
	const signFor = (place) => {
		if (place === "teller") return "BANK";
		if (place === "vault") return "VAULT";
		if (place === "pawn") return "PAWN";
		if (place === "casino") return "DICE";
		if (place === "store") return "MART";
		if (place === "roller") return "SUITE";
		if (place === "corner") return "CORNER";
		if (place === "home") return "HOUSE";
		if (place === "fixer") return "FIXER";
		return "";
	};
	spots.forEach((s, i) => {
		m.compose(new Vector3(s.x, 1.3, s.z), qid, new Vector3(1, 1, 1));
		postMesh.setMatrixAt(i, m);
		const hex = s.place === "teller" || s.place === "vault" ? 15986660 : s.place === "corner" ? 14826299 : 16756768;
		postMesh.setColorAt(i, tint.setHex(hex));
		const label = signFor(s.place);
		if (!label || s.id === "home2" || s.id === "home3" || s.id === "store2" || s.id === "corner2") return;
		const board = new Mesh(new BoxGeometry(3.2, 1.15, .18), new MeshBasicMaterial({ map: makeSign(label, "#ffb020", "#14120c") }));
		board.position.set(s.x, 3.15, s.z);
		board.rotation.y = Math.atan2(s.x, s.z);
		scene.add(board);
	});
	postMesh.instanceMatrix.needsUpdate = true;
	if (postMesh.instanceColor) postMesh.instanceColor.needsUpdate = true;
	scene.add(postMesh);
	const kiosk = new Mesh(new BoxGeometry(1.4, 1.5, .9), new MeshStandardMaterial({
		color: 1709070,
		roughness: .72
	}));
	kiosk.position.set(LOT.x, .75, LOT.z);
	scene.add(kiosk);
	const beacon = new Mesh(new CylinderGeometry(.22, .22, 9, 8), new MeshBasicMaterial({
		color: 16756768,
		transparent: true,
		opacity: .8
	}));
	beacon.visible = false;
	scene.add(beacon);
	const ring = new Mesh(new RingGeometry(3.3, 4.15, 28), new MeshBasicMaterial({
		color: 16756768,
		side: 2,
		transparent: true,
		opacity: .8
	}));
	ring.rotation.x = -Math.PI / 2;
	ring.visible = false;
	scene.add(ring);
	const beam = new Mesh(new CylinderGeometry(1.8, 6.5, 26, 16, 1, true), new MeshBasicMaterial({
		color: 16773580,
		transparent: true,
		opacity: .14,
		depthWrite: false,
		side: 2
	}));
	beam.visible = false;
	scene.add(beam);
	const heliSpot = new SpotLight(16774354, 0, 92, .42, .55, 1.15);
	heliSpot.position.set(0, 34, 0);
	scene.add(heliSpot);
	scene.add(heliSpot.target);
	const flash = new Mesh(new SphereGeometry(.16, 8, 8), new MeshBasicMaterial({ color: 16769704 }));
	flash.visible = false;
	scene.add(flash);
	const smokeGeo = new SphereGeometry(.35, 6, 6);
	const smokeMat = new MeshBasicMaterial({
		color: 2764344,
		transparent: true,
		opacity: .45,
		depthWrite: false
	});
	const smokeMesh = new InstancedMesh(smokeGeo, smokeMat, 24);
	smokeMesh.frustumCulled = false;
	scene.add(smokeMesh);
	const carCap = cars.length;
	const bodyGeo = new BoxGeometry(1.72, .42, 4.05);
	const cabinGeo = new BoxGeometry(1.42, .38, 1.7);
	const hoodGeo = new BoxGeometry(1.62, .22, 1.35);
	const wheelGeo = new CylinderGeometry(.36, .36, .26, 12);
	wheelGeo.rotateZ(Math.PI / 2);
	const rimGeo = new CylinderGeometry(.18, .18, .28, 8);
	rimGeo.rotateZ(Math.PI / 2);
	const bodyMat = new MeshStandardMaterial({
		color: 16777215,
		roughness: .28,
		metalness: .62
	});
	const cabinMat = new MeshStandardMaterial({
		color: 659478,
		roughness: .06,
		metalness: .82,
		emissive: 1054752,
		emissiveIntensity: .4
	});
	const glassMat = new MeshStandardMaterial({
		color: 1454138,
		roughness: .04,
		metalness: .92,
		emissive: 926764,
		emissiveIntensity: .55
	});
	const wheelMat = new MeshStandardMaterial({
		color: 1052948,
		roughness: .85
	});
	const rimMat = new MeshStandardMaterial({
		color: 15194032,
		roughness: .28,
		metalness: .82
	});
	const bodyMesh = new InstancedMesh(bodyGeo, bodyMat, carCap);
	const cabinMesh = new InstancedMesh(cabinGeo, cabinMat, carCap);
	const glassMesh = new InstancedMesh(new BoxGeometry(1.18, .3, 1.48), glassMat, carCap);
	const hoodMesh = new InstancedMesh(hoodGeo, bodyMat, carCap);
	const wheelMesh = new InstancedMesh(wheelGeo, wheelMat, carCap * 4);
	const rimMesh = new InstancedMesh(rimGeo, rimMat, carCap * 4);
	const lampLGeo = new BoxGeometry(.28, .14, .1);
	const headMat = new MeshStandardMaterial({
		color: 16774877,
		emissive: 16770992,
		emissiveIntensity: 2.2
	});
	const tailMat = new MeshStandardMaterial({
		color: 16726843,
		emissive: 16722474,
		emissiveIntensity: 1.6
	});
	const headMesh = new InstancedMesh(lampLGeo, headMat, carCap * 2);
	const tailMesh = new InstancedMesh(lampLGeo, tailMat, carCap * 2);
	const barGeo = new BoxGeometry(.22, .12, .22);
	const barMat = new MeshStandardMaterial({
		color: 16777215,
		emissive: 16722474,
		emissiveIntensity: 2.6
	});
	const barMesh = new InstancedMesh(barGeo, barMat, carCap * 2);
	const shadowGeo = new CircleGeometry(1.7, 14);
	shadowGeo.rotateX(-Math.PI / 2);
	const shadowMesh = new InstancedMesh(shadowGeo, new MeshBasicMaterial({
		color: 0,
		transparent: true,
		opacity: .38,
		depthWrite: false
	}), carCap);
	for (const mesh of [
		bodyMesh,
		cabinMesh,
		glassMesh,
		hoodMesh,
		wheelMesh,
		rimMesh,
		headMesh,
		tailMesh,
		barMesh,
		shadowMesh
	]) {
		mesh.frustumCulled = false;
		scene.add(mesh);
	}
	cars.forEach((car, i) => {
		tint.setHex(car.color);
		bodyMesh.setColorAt(i, tint);
		hoodMesh.setColorAt(i, tint);
	});
	if (bodyMesh.instanceColor) bodyMesh.instanceColor.needsUpdate = true;
	if (hoodMesh.instanceColor) hoodMesh.instanceColor.needsUpdate = true;
	const pedCap = peds.length;
	const pedBodyGeo = new BoxGeometry(.42, .62, .26);
	const pedHeadGeo = new SphereGeometry(.15, 10, 8);
	const pedLegGeo = new BoxGeometry(.12, .4, .12);
	const pedArmGeo = new BoxGeometry(.1, .38, .1);
	const pedBodyMat = new MeshStandardMaterial({
		color: 16777215,
		roughness: .62
	});
	const pedHeadMat = new MeshStandardMaterial({
		color: 14136730,
		roughness: .58
	});
	const pedLimbMat = new MeshStandardMaterial({
		color: 1316380,
		roughness: .8
	});
	const pedHairMat = new MeshStandardMaterial({
		color: 1708558,
		roughness: .75
	});
	const pedBody = new InstancedMesh(pedBodyGeo, pedBodyMat, pedCap);
	const pedHead = new InstancedMesh(pedHeadGeo, pedHeadMat, pedCap);
	const pedHair = new InstancedMesh(new SphereGeometry(.155, 8, 6), pedHairMat, pedCap);
	const pedLeg = new InstancedMesh(pedLegGeo, pedLimbMat, pedCap * 2);
	const pedArm = new InstancedMesh(pedArmGeo, pedLimbMat, pedCap * 2);
	pedBody.frustumCulled = false;
	pedHead.frustumCulled = false;
	pedHair.frustumCulled = false;
	pedLeg.frustumCulled = false;
	pedArm.frustumCulled = false;
	scene.add(pedBody);
	scene.add(pedHead);
	scene.add(pedHair);
	scene.add(pedLeg);
	scene.add(pedArm);
	peds.forEach((p, i) => {
		tint.setHex(p.color);
		pedBody.setColorAt(i, tint);
	});
	if (pedBody.instanceColor) pedBody.instanceColor.needsUpdate = true;
	const playerGroup = new Group();
	const jacket = new Mesh(new BoxGeometry(.52, .64, .3), new MeshStandardMaterial({
		color: 1316380,
		roughness: .55,
		metalness: .08
	}));
	jacket.position.y = 1.16;
	const stripe = new Mesh(new BoxGeometry(.54, .07, .32), new MeshStandardMaterial({
		color: 16756768,
		emissive: 16756768,
		emissiveIntensity: .55
	}));
	stripe.position.y = 1.32;
	const headP = new Mesh(new SphereGeometry(.16, 12, 10), pedHeadMat);
	headP.position.y = 1.64;
	const hairP = new Mesh(new SphereGeometry(.17, 10, 8), new MeshStandardMaterial({
		color: 1708558,
		roughness: .7
	}));
	hairP.position.set(0, 1.74, -.02);
	hairP.scale.set(1, .62, 1);
	const legs = new Mesh(new BoxGeometry(.38, .58, .26), new MeshStandardMaterial({
		color: 921620,
		roughness: .8
	}));
	legs.position.y = .46;
	const armGeo = new BoxGeometry(.12, .46, .12);
	const armMat = new MeshStandardMaterial({
		color: 1842724,
		roughness: .7
	});
	const leftPivot = new Group();
	leftPivot.position.set(-.34, 1.32, 0);
	const leftArm = new Mesh(armGeo, armMat);
	leftArm.position.y = -.2;
	leftPivot.add(leftArm);
	const rightPivot = new Group();
	rightPivot.position.set(.34, 1.32, 0);
	const rightArm = new Mesh(armGeo, armMat);
	rightArm.position.y = -.2;
	rightPivot.add(rightArm);
	playerGroup.add(legs, jacket, stripe, headP, hairP, leftPivot, rightPivot);
	scene.add(playerGroup);
	const pickupMesh = new InstancedMesh(new OctahedronGeometry(.38, 0), new MeshStandardMaterial({
		color: 16756768,
		emissive: 16756768,
		emissiveIntensity: .8,
		roughness: .35
	}), pickups.length);
	pickupMesh.frustumCulled = false;
	scene.add(pickupMesh);
	pickups.forEach((p, i) => {
		tint.setHex(p.kind === "med" ? 16756768 : 15986660);
		pickupMesh.setColorAt(i, tint);
	});
	if (pickupMesh.instanceColor) pickupMesh.instanceColor.needsUpdate = true;
	const shotPos = /* @__PURE__ */ new Float32Array(288);
	const shotGeo = new BufferGeometry();
	shotGeo.setAttribute("position", new BufferAttribute(shotPos, 3));
	shotGeo.setDrawRange(0, 0);
	const shotLines = new LineSegments(shotGeo, new LineBasicMaterial({
		color: 16769704,
		transparent: true,
		opacity: .9
	}));
	scene.add(shotLines);
	const timer = new Timer();
	timer.connect(document);
	const v = new Vector3();
	const v2 = new Vector3();
	const q = new Quaternion();
	const q2 = new Quaternion();
	const up = new Vector3(0, 1, 0);
	const axle = new Vector3(1, 0, 0);
	const scale1 = new Vector3(1, 1, 1);
	const scale0 = new Vector3(1e-4, 1e-4, 1e-4);
	const scaleBody = new Vector3(1, 1, 1);
	const scaleWheel = new Vector3(1, 1, 1);
	const qw = new Quaternion();
	const audio = {
		ctx: null,
		engine: null,
		engineGain: null,
		sirenA: null,
		sirenB: null,
		sirenGain: null,
		tire: null,
		tireGain: null,
		radioA: null,
		radioB: null,
		radioGain: null,
		noise: null,
		ensure() {
			if (!this.ctx) {
				const Ctx = window.AudioContext || window.webkitAudioContext;
				this.ctx = new Ctx();
				this.engine = this.ctx.createOscillator();
				this.engine.type = "sawtooth";
				this.engine.frequency.value = 48;
				this.engineGain = this.ctx.createGain();
				this.engineGain.gain.value = 0;
				this.engine.connect(this.engineGain);
				this.engineGain.connect(this.ctx.destination);
				this.engine.start();
				this.sirenA = this.ctx.createOscillator();
				this.sirenB = this.ctx.createOscillator();
				this.sirenA.type = "square";
				this.sirenB.type = "square";
				this.sirenA.frequency.value = 680;
				this.sirenB.frequency.value = 520;
				this.sirenGain = this.ctx.createGain();
				this.sirenGain.gain.value = 0;
				this.sirenA.connect(this.sirenGain);
				this.sirenB.connect(this.sirenGain);
				this.sirenGain.connect(this.ctx.destination);
				this.sirenA.start();
				this.sirenB.start();
				const len = this.ctx.sampleRate;
				const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
				const data = buf.getChannelData(0);
				for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
				this.noise = buf;
				this.tire = this.ctx.createBufferSource();
				this.tire.buffer = buf;
				this.tire.loop = true;
				const bp = this.ctx.createBiquadFilter();
				bp.type = "bandpass";
				bp.frequency.value = 780;
				bp.Q.value = .65;
				this.tireGain = this.ctx.createGain();
				this.tireGain.gain.value = 0;
				this.tire.connect(bp);
				bp.connect(this.tireGain);
				this.tireGain.connect(this.ctx.destination);
				this.tire.start();
				this.radioA = this.ctx.createOscillator();
				this.radioB = this.ctx.createOscillator();
				this.radioA.type = "triangle";
				this.radioB.type = "sine";
				this.radioGain = this.ctx.createGain();
				this.radioGain.gain.value = 0;
				this.radioA.connect(this.radioGain);
				this.radioB.connect(this.radioGain);
				this.radioGain.connect(this.ctx.destination);
				this.radioA.start();
				this.radioB.start();
			}
			if (this.ctx.state === "suspended") this.ctx.resume();
		},
		blip(freq, dur, type, gain) {
			if (!this.ctx) return;
			const o = this.ctx.createOscillator();
			const g = this.ctx.createGain();
			o.type = type;
			o.frequency.value = freq;
			g.gain.setValueAtTime(gain, this.ctx.currentTime);
			g.gain.exponentialRampToValueAtTime(1e-4, this.ctx.currentTime + dur);
			o.connect(g);
			g.connect(this.ctx.destination);
			o.start();
			o.stop(this.ctx.currentTime + dur + .02);
		},
		shot(kind = "pistol") {
			if (!this.ctx || !this.noise) {
				this.blip(180, .07, "square", .04);
				this.blip(90, .09, "sawtooth", .03);
				return;
			}
			const t = this.ctx.currentTime;
			const spec = kind === "shotgun" ? {
				hp: 280,
				peak: .11,
				dur: .16
			} : kind === "smg" ? {
				hp: 1400,
				peak: .045,
				dur: .05
			} : {
				hp: 900,
				peak: .075,
				dur: .08
			};
			const src = this.ctx.createBufferSource();
			src.buffer = this.noise;
			const filter = this.ctx.createBiquadFilter();
			filter.type = "highpass";
			filter.frequency.value = spec.hp;
			const g = this.ctx.createGain();
			g.gain.setValueAtTime(spec.peak, t);
			g.gain.exponentialRampToValueAtTime(1e-4, t + spec.dur);
			src.connect(filter);
			filter.connect(g);
			g.connect(this.ctx.destination);
			src.start(t);
			src.stop(t + spec.dur + .02);
			const slap = this.ctx.createBufferSource();
			slap.buffer = this.noise;
			const lp = this.ctx.createBiquadFilter();
			lp.type = "lowpass";
			lp.frequency.value = 620;
			const sg = this.ctx.createGain();
			sg.gain.setValueAtTime(1e-4, t);
			sg.gain.setValueAtTime(spec.peak * .32, t + .08);
			sg.gain.exponentialRampToValueAtTime(1e-4, t + .2);
			slap.connect(lp);
			lp.connect(sg);
			sg.connect(this.ctx.destination);
			slap.start(t);
			slap.stop(t + .22);
		},
		crunch() {
			if (!this.ctx || !this.noise) return;
			const t = this.ctx.currentTime;
			const src = this.ctx.createBufferSource();
			src.buffer = this.noise;
			const lp = this.ctx.createBiquadFilter();
			lp.type = "lowpass";
			lp.frequency.value = 220;
			const g = this.ctx.createGain();
			g.gain.setValueAtTime(.09, t);
			g.gain.exponentialRampToValueAtTime(1e-4, t + .16);
			src.connect(lp);
			lp.connect(g);
			g.connect(this.ctx.destination);
			src.start(t);
			src.stop(t + .18);
		}
	};
	function snapshot() {
		const car = cars[playerCar];
		const speed = driving && car ? Math.abs(car.speed) : Math.hypot(vx, vz);
		return {
			phase,
			health: Math.max(0, health),
			armor: Math.max(0, armor),
			wanted,
			cash: Math.floor(cash),
			bank: Math.floor(bankBal),
			loot: Math.floor(loot),
			best,
			speedMph: Math.round(speed * 2.237),
			driving,
			toast: toastT > 0 ? toast : "",
			cooling: clearT > .4 && wanted > 0,
			looking: document.pointerLockElement === canvas,
			lostCash,
			error,
			gun: gun === "smg" ? "SMG" : gun === "shotgun" ? "SHOTGUN" : "PISTOL",
			ammo: reloadT > 0 ? "REL" : `${ammo[gun].mag}/${ammo[gun].reserve}`,
			job: jobLine(),
			radio: RADIO[radioTrack] ?? "NIGHTLINE",
			shop: nearLot() && started && phase === "play" ? lotLine() : "",
			nearShop: nearLot() && started && phase === "play",
			drifting,
			cover: coverNow && wanted >= 5,
			...hustleHud(),
			assets: assetLine()
		};
	}
	function pushHud() {
		onHud(snapshot());
	}
	function say(text, time = 2.2) {
		toast = text;
		toastT = time;
	}
	const REACH = 6.4;
	function nearestSpot() {
		const me = playerPos();
		let best = null;
		let bestD = REACH;
		for (const s of spots) {
			const d = Math.hypot(s.x - me.x, s.z - me.z);
			if (d < bestD) {
				bestD = d;
				best = s;
			}
		}
		return best;
	}
	function nearestMug() {
		if (driving) return -1;
		const me = playerPos();
		let idx = -1;
		let bestD = 2.5;
		for (let i = 0; i < peds.length; i++) {
			const p = peds[i];
			if (!p.active || p.state === "down" || p.mark > 0 || p.faction !== "civ") continue;
			const d = Math.hypot(p.x - me.x, p.z - me.z);
			if (d < bestD) {
				bestD = d;
				idx = i;
			}
		}
		return idx;
	}
	function hustleHud() {
		if (!started || phase !== "play") return {
			hustle: "",
			hustlePct: 0,
			nearWork: false,
			nearTeller: false
		};
		if (channel) {
			const def = hustleById(channel.hustleId);
			const pct = clamp(1 - channel.left / Math.max(.1, channel.need), 0, 1);
			return {
				hustle: `${def?.name ?? "Working"} ${Math.round(pct * 100)}%`,
				hustlePct: pct,
				nearWork: true,
				nearTeller: false
			};
		}
		const spot = nearestSpot();
		if (spot?.place === "fixer") {
			const def = SPENDS[hold.pick % SPENDS.length];
			const owned = def.kind === "tune" ? hold.tunes : 0;
			const price = def.kind === "bribe" ? bribeCost(def) : scoreSpend(def, owned).cost;
			const tag = spendState(def);
			return {
				hustle: `FIXER · J ${def.name} $${price.toLocaleString("en-US")}${tag} · K swap`,
				hustlePct: 0,
				nearWork: true,
				nearTeller: false
			};
		}
		if (spot?.place === "teller") return {
			hustle: `J deposit $${Math.floor(cash)} · K withdraw · bank $${Math.floor(bankBal)}`,
			hustlePct: 0,
			nearWork: true,
			nearTeller: true
		};
		if (spot) {
			const list = offersAt(spot.place);
			const def = list[spot.pick % Math.max(1, list.length)];
			const cool = spot.cool > 0 ? ` · ${Math.ceil(spot.cool)}s` : "";
			const swap = list.length > 1 ? " · K swap" : "";
			return {
				hustle: def ? `${spot.name} · J ${blurb(def)}${swap}${cool}` : spot.name,
				hustlePct: 0,
				nearWork: true,
				nearTeller: false
			};
		}
		if (nearestMug() >= 0) {
			const def = hustleById("mug");
			return {
				hustle: def ? `J ${blurb(def)}` : "J mug",
				hustlePct: 0,
				nearWork: true,
				nearTeller: false
			};
		}
		return {
			hustle: "",
			hustlePct: 0,
			nearWork: false,
			nearTeller: false
		};
	}
	function cancelChannel(msg, refund) {
		if (!channel) return;
		if (refund) cash += channel.stake;
		channel = null;
		say(msg);
	}
	function depositAll() {
		if (cash <= 0) {
			say(bankBal > 0 ? "Wallet's empty. K draws from the bank." : "Nothing to deposit");
			return;
		}
		const moved = Math.floor(cash);
		bankBal += moved;
		cash = 0;
		saveBooks();
		noteWorth();
		say(`Deposited $${moved.toLocaleString("en-US")}`);
	}
	function withdrawChunk() {
		if (wanted >= 4) {
			say("Too hot to draw");
			return;
		}
		if (bankBal <= 0) {
			say("Bank's empty");
			return;
		}
		const n = Math.min(Math.floor(bankBal), 500);
		bankBal -= n;
		cash += n;
		saveBooks();
		say(`Withdrew $${n}`);
	}
	function openChannel(hustleId, spotId, ped, x, z) {
		const def = hustleById(hustleId);
		if (!def) return;
		const s = scoreHustle(def);
		let stakePay = s.stakeCash;
		if (def.id === "deal" && hold.packs > 0) {
			hold.packs -= 1;
			stakePay = 0;
			saveBooks();
		}
		if (stakePay > cash) {
			if (def.id === "deal") hold.packs += 1;
			say(`Need $${s.stakeCash} in the wallet`);
			return;
		}
		if (def.kind === "fence" && loot <= 0) {
			say("Nothing to pawn");
			return;
		}
		cash -= stakePay;
		channel = {
			hustleId,
			spotId,
			ped,
			left: s.seconds,
			need: s.seconds,
			stake: stakePay,
			x,
			z
		};
		say(stakePay === 0 && def.id === "deal" ? "Using a pack" : def.name);
	}
	function offersAt(place) {
		const open = hold.invite || hold.house || hold.lux > 0;
		return hustlesAt(place).filter((h) => h.id !== "private" || open);
	}
	function bribeCost(def) {
		return Math.round(scoreSpend(def).cost * (1 + wanted * .45));
	}
	function tapeValue() {
		if (hold.marketCost <= 0 || hold.marketBasis <= 0) return 0;
		return Math.max(0, Math.round(hold.marketCost * hold.index / hold.marketBasis));
	}
	function spendState(def) {
		if (def.kind === "tune") return hold.tunes > 0 ? ` · ${hold.tunes}/3` : "";
		if (def.kind === "house" && hold.house) return " · owned";
		if (def.kind === "luxury" && hold.lux > 0) return " · owned";
		if (def.kind === "business" && hold.biz) return " · open";
		if (def.kind === "invite" && hold.invite) return " · in";
		if (def.kind === "market" && hold.marketCost > 0) return ` · worth $${tapeValue().toLocaleString("en-US")}`;
		if (def.kind === "drug" && hold.packs > 0) return ` · ${hold.packs} packs`;
		if (def.id === "shotgun" && owned.shotgun) return " · owned";
		if (def.id === "smg" && owned.smg) return " · owned";
		if (def.kind === "crew" && hold.crewT > 0) return ` · ${Math.ceil(hold.crewT)}s`;
		return "";
	}
	function assetLine() {
		const bits = [];
		if (hold.tunes > 0) bits.push(`Tune ${hold.tunes}`);
		if (hold.house) bits.push("House");
		if (hold.lux > 0) bits.push("Watch");
		if (hold.biz) bits.push("Shop");
		if (hold.invite) bits.push("List");
		if (hold.packs > 0) bits.push(`Packs ${hold.packs}`);
		if (hold.crewT > 0) bits.push(`Crew ${Math.ceil(hold.crewT)}s`);
		if (hold.marketCost > 0) bits.push(`Tape $${tapeValue().toLocaleString("en-US")}`);
		return bits.join(" · ");
	}
	function lotLine() {
		const bribe = spendById("bribe");
		const vest = spendById("vest");
		const shot = spendById("shotgun");
		const sport = spendById("sport");
		return `B bribe $${bribeCost(bribe).toLocaleString("en-US")} · V vest $${scoreSpend(vest).cost} · G shot $${scoreSpend(shot).cost} · H sport $${scoreSpend(sport).cost}`;
	}
	function fitRide(ride) {
		let car = driving ? cars[playerCar] : null;
		if (!car || car.hp <= 0 || car.police) {
			car = null;
			let best = 12;
			const me = playerPos();
			for (const c of cars) {
				if (c.police || c.hp <= 0) continue;
				const d = Math.hypot(c.x - me.x, c.z - me.z);
				if (d < best) {
					best = d;
					car = c;
				}
			}
		}
		if (!car) {
			say("No ride in reach");
			return false;
		}
		car.ride = ride;
		car.maxHp = RIDES[ride].maxHp;
		car.hp = car.maxHp;
		car.maxSpeed = RIDES[ride].vmax;
		car.forSale = false;
		return true;
	}
	function hireCrew(seconds, power) {
		hold.crewT = Math.max(hold.crewT, seconds);
		let p = peds.find((ped) => ped.ally && ped.state !== "down");
		if (!p) p = peds.find((ped) => ped.faction === "civ" && ped.active && ped.state !== "down");
		if (!p) return;
		const me = playerPos();
		p.ally = true;
		p.active = true;
		p.hp = 90 + power * 12;
		p.state = "fight";
		p.color = 15986660;
		p.x = me.x + 1.6;
		p.z = me.z + 1.2;
	}
	function landHit() {
		const me = playerPos();
		let best = null;
		let bd = 90;
		for (const p of peds) {
			if (!p.active || p.state === "down" || p.ally) continue;
			if (p.faction !== "amber" && p.faction !== "teal") continue;
			const d = Math.hypot(p.x - me.x, p.z - me.z);
			if (d < bd) {
				bd = d;
				best = p;
			}
		}
		if (!best) {
			say("Hit missed. Block was empty.");
			return;
		}
		dropPed(best, false);
		say("Contract closed");
	}
	function buySpend(id) {
		if (!started || !alive || phase !== "play") return false;
		const def = spendById(id);
		if (!def) return false;
		if (def.kind === "market" && hold.marketCost > 0) {
			const value = tapeValue();
			hold.marketCost = 0;
			hold.marketBasis = hold.index;
			cash += value;
			noteWorth();
			saveBooks();
			say(value > 0 ? `Sold the tape $${value.toLocaleString("en-US")}` : "Tape was worthless");
			return true;
		}
		if (def.kind === "house" && hold.house) {
			say("You have the deed");
			return false;
		}
		if (def.kind === "luxury" && hold.lux > 0) {
			say("You already wear it");
			return false;
		}
		if (def.kind === "business" && hold.biz) {
			say("The shop is open");
			return false;
		}
		if (def.kind === "invite" && hold.invite) {
			say("You're already on the list");
			return false;
		}
		if (def.kind === "tune" && hold.tunes >= 3) {
			say("Nothing left to tune");
			return false;
		}
		if (def.id === "shotgun" && owned.shotgun) {
			say("You have the shotgun");
			return false;
		}
		if (def.id === "smg" && owned.smg) {
			say("You have the SMG");
			return false;
		}
		if (def.kind === "bribe" && wanted <= 0) {
			say("Nobody's looking");
			return false;
		}
		const ownedCount = def.kind === "tune" ? hold.tunes : 0;
		const scored = scoreSpend(def, ownedCount);
		const cost = def.kind === "bribe" ? bribeCost(def) : scored.cost;
		if (cash < cost) {
			say(`Need $${cost.toLocaleString("en-US")} in the wallet`);
			return false;
		}
		if (def.kind === "bribe" && def.heat > 0 && rand() < .08 * def.heat) {
			cash -= cost;
			addStars(1);
			saveBooks();
			say("They kept it and called it in");
			return true;
		}
		if (def.kind === "ride") {
			const ride = def.id === "van" ? "van" : "sport";
			const lot = def.id === "sport" ? cars.find((c) => c.forSale && c.hp > 0) : void 0;
			if (lot && !(driving && cars[playerCar] === lot)) {
				cash -= cost;
				if (driving) cars[playerCar].mode = "coast";
				lot.forSale = false;
				lot.mode = "player";
				lot.hp = lot.maxHp;
				lot.ride = "sport";
				playerCar = cars.indexOf(lot);
				driving = true;
				lookOffset = 0;
				saveBooks();
				say("She's yours");
				return true;
			}
			if (!fitRide(ride)) return false;
		}
		cash -= cost;
		if (def.kind === "tune") {
			hold.tunes += 1;
			if (driving) {
				const car = cars[playerCar];
				car.hp = Math.min(car.maxHp, car.hp + 35);
			}
			say(`Tuned ${hold.tunes}/3`);
		} else if (def.kind === "bribe") {
			const cut = 1 + Math.floor(scored.power / 2);
			wanted = Math.max(0, wanted - cut);
			clearT = 0;
			if (wanted < 4) {
				blockLive = false;
				for (const c of cars) c.block = false;
			}
			say(wanted <= 0 ? "Paid off" : `Bought off ${cut}`);
		} else if (def.kind === "crew") {
			hireCrew(scored.seconds, scored.power);
			say(`Gun's with you ${Math.ceil(hold.crewT)}s`);
		} else if (def.kind === "gun") {
			if (def.id === "smg") {
				owned.smg = true;
				gun = "smg";
				say("SMG's yours");
			} else {
				owned.shotgun = true;
				gun = "shotgun";
				say("Shotgun's yours");
			}
		} else if (def.kind === "ammo") {
			const spec = GUNS[gun];
			ammo[gun].reserve += spec.mag * (1 + Math.round(scored.power / 2));
			say("Ammo on the belt");
		} else if (def.kind === "armor") {
			armor = Math.min(100, armor + 28 + scored.power * 12);
			say("Vest on");
		} else if (def.kind === "house") {
			hold.house = true;
			say("Deed's yours. The row house is cover.");
		} else if (def.kind === "market") {
			hold.marketCost = cost;
			hold.marketBasis = hold.index || 1;
			say("You're in the tape");
		} else if (def.kind === "drug") {
			hold.packs += Math.max(1, Math.round(scored.power));
			say(`${hold.packs} packs in the coat`);
		} else if (def.kind === "luxury") {
			hold.lux = scored.power;
			armor = Math.min(100, armor + 15);
			say("They know the watch");
		} else if (def.kind === "business") {
			hold.biz = true;
			hold.bizTick = 0;
			say("Shop's open. It pays the bank.");
		} else if (def.kind === "hit") {
			hold.hitT = Math.max(5, scored.seconds / 5);
			say("Contract's out");
		} else if (def.kind === "invite") {
			hold.invite = true;
			say("You're on the list. Suite has private work.");
		} else if (def.kind === "ride") say(def.id === "van" ? "Van's yours" : "Sport's yours");
		if (scored.stars && def.kind !== "bribe") addStars(scored.stars);
		saveBooks();
		return true;
	}
	function updateHoldings(dt) {
		hold.crewT = Math.max(0, hold.crewT - dt);
		if (hold.crewT <= 0) for (const p of peds) {
			if (p.ally && p.state !== "down") p.state = "walk";
			if (p.ally) p.ally = false;
		}
		const shop = spendById("business");
		if (hold.biz && shop) {
			hold.bizTick += dt;
			if (hold.bizTick >= 8) {
				hold.bizTick = 0;
				if (wanted < 4) {
					const s = scoreSpend(shop);
					const pay = Math.max(0, s.income - s.upkeepCash);
					if (pay > 0) {
						bankBal += pay;
						noteWorth();
						saveBooks();
					}
				}
			}
		}
		const tape = spendById("market");
		if (tape) {
			const bias = (scoreSpend(tape).power - 3) * .004;
			hold.index += hold.index * ((rand() - .5) * .55 + bias) * dt;
			hold.index = clamp(hold.index, .4, 2.5);
		}
		if (hold.hitT > 0) {
			hold.hitT -= dt;
			if (hold.hitT <= 0) {
				hold.hitT = 0;
				landHit();
			}
		}
		if (hold.house) {
			const home = spots.find((s) => s.id === "home1");
			if (home) {
				const me = playerPos();
				if (Math.hypot(me.x - home.x, me.z - home.z) < 8) {
					health = Math.min(100, health + 18 * dt);
					armor = Math.min(100, armor + 6 * dt);
				}
			}
		}
	}
	function beginHustle() {
		if (!started || !alive || phase !== "play" || channel) return;
		const spot = nearestSpot();
		if (spot?.place === "teller") {
			depositAll();
			return;
		}
		if (spot?.place === "fixer") {
			buySpend(SPENDS[hold.pick % SPENDS.length].id);
			return;
		}
		if (driving) {
			say("On foot for this");
			return;
		}
		if (spot) {
			if (spot.cool > 0) {
				say(`Hot for ${Math.ceil(spot.cool)}s`);
				return;
			}
			const list = offersAt(spot.place);
			const def = list[spot.pick % Math.max(1, list.length)];
			if (!def) return;
			openChannel(def.id, spot.id, -1, spot.x, spot.z);
			return;
		}
		const ped = nearestMug();
		if (ped < 0) {
			say("Nothing in reach");
			return;
		}
		const p = peds[ped];
		openChannel("mug", "civ", ped, p.x, p.z);
	}
	function cycleSpot() {
		if (!started || !alive || phase !== "play" || channel) return;
		const spot = nearestSpot();
		if (!spot) return;
		if (spot.place === "teller") {
			withdrawChunk();
			return;
		}
		if (spot.place === "fixer") {
			hold.pick = (hold.pick + 1) % SPENDS.length;
			const def = SPENDS[hold.pick];
			say(spendBlurb(def, def.kind === "tune" ? hold.tunes : 0));
			return;
		}
		const list = offersAt(spot.place);
		if (list.length < 2) return;
		spot.pick = (spot.pick + 1) % list.length;
		const def = list[spot.pick];
		if (def) say(blurb(def));
	}
	function finishChannel() {
		if (!channel) return;
		const current = channel;
		const def = hustleById(current.hustleId);
		channel = null;
		if (!def) return;
		const ped = current.ped >= 0 ? peds[current.ped] : void 0;
		const hostile = !!ped && ped.faction !== "civ";
		const result = resolveHustle(def, rand, loot, hostile);
		const spot = spots.find((s) => s.id === current.spotId);
		if (spot) spot.cool = scoreHustle(def).cooldown;
		if (ped) {
			ped.mark = 28;
			ped.state = "flee";
		}
		if (result.clearLoot) loot = 0;
		else loot += result.loot;
		if (result.wallet) bankCash(result.wallet);
		saveBooks();
		if (result.stars) addStars(result.stars);
		if (result.hurt) hurtPlayer(result.hurt);
		say(result.line, 2.8);
	}
	function updateChannel(dt) {
		if (!channel) return;
		sinceCrime = 0;
		if (!alive || driving) {
			cancelChannel(driving ? "On foot for this" : "Dropped it", true);
			return;
		}
		const me = playerPos();
		let ax = channel.x;
		let az = channel.z;
		if (channel.ped >= 0) {
			const p = peds[channel.ped];
			if (!p || !p.active || p.state === "down") {
				cancelChannel("They got away", true);
				return;
			}
			ax = p.x;
			az = p.z;
			channel.x = ax;
			channel.z = az;
		}
		const limit = channel.ped >= 0 ? 3.3 : 8;
		if (Math.hypot(me.x - ax, me.z - az) > limit) {
			cancelChannel("Too far", true);
			return;
		}
		channel.left -= dt;
		if (channel.left <= 0) finishChannel();
	}
	function noteWorth() {
		const worth = Math.floor(cash + bankBal + tapeValue());
		if (worth > best) {
			best = worth;
			try {
				localStorage.setItem("viceroy-best", String(best));
			} catch {}
		}
	}
	function saveBooks() {
		try {
			localStorage.setItem("viceroy-bank", String(Math.floor(bankBal)));
			localStorage.setItem("viceroy-loot", String(Math.floor(loot)));
			localStorage.setItem("viceroy-hold", JSON.stringify({
				tunes: hold.tunes,
				house: hold.house,
				lux: hold.lux,
				biz: hold.biz,
				packs: hold.packs,
				invite: hold.invite,
				marketCost: hold.marketCost,
				marketBasis: hold.marketBasis,
				index: hold.index
			}));
		} catch {}
	}
	function bankCash(n) {
		cash += n;
		if (cash < 0) cash = 0;
		noteWorth();
	}
	function addStars(n) {
		sinceCrime = 0;
		clearT = 0;
		if (starLock > 0) {
			wanted = Math.max(wanted, 1);
			return;
		}
		const prev = wanted;
		wanted = clamp(wanted + n, 0, 5);
		starLock = 1.35;
		if (wanted !== prev) say(wanted >= 5 ? "Five stars. Get off the street." : `Wanted — ${wanted}`);
	}
	function eye() {
		if (driving) {
			const car = cars[playerCar];
			const yaw = car.yaw + lookOffset;
			const pitch = lookPitch;
			const fx = -Math.sin(yaw) * Math.cos(pitch);
			const fy = Math.sin(pitch);
			const fz = -Math.cos(yaw) * Math.cos(pitch);
			return {
				x: car.x + fx * .6,
				y: 1.35,
				z: car.z + fz * .6,
				dx: fx,
				dy: fy,
				dz: fz,
				yaw
			};
		}
		const pitch = camPitch;
		const fx = -Math.sin(camYaw) * Math.cos(pitch);
		const fy = Math.sin(pitch);
		const fz = -Math.cos(camYaw) * Math.cos(pitch);
		return {
			x: px,
			y: 1.55,
			z: pz,
			dx: fx,
			dy: fy,
			dz: fz,
			yaw: camYaw
		};
	}
	function playerPos() {
		if (driving) {
			const c = cars[playerCar];
			return {
				x: c.x,
				z: c.z,
				yaw: c.yaw,
				speed: c.speed
			};
		}
		return {
			x: px,
			z: pz,
			yaw: camYaw,
			speed: Math.hypot(vx, vz)
		};
	}
	function trace(ox, oy, oz, dx, dy, dz, maxT, ignoreCar, ignorePed, hitPlayer) {
		let best = null;
		const take = (t, kind, index) => {
			if (t === null || t < 0 || t > maxT) return;
			if (!best || t < best.t) best = {
				t,
				kind,
				index
			};
		};
		for (let i = 0; i < blocks.length; i++) take(rayAABB(ox, oy, oz, dx, dy, dz, blocks[i], maxT), "world", i);
		for (let i = 0; i < peds.length; i++) {
			const p = peds[i];
			if (!p.active || p.state === "down" || i === ignorePed) continue;
			take(rayCylinder(ox, oy, oz, dx, dy, dz, p.x, p.z, .42, .2, 1.75, maxT), "ped", i);
		}
		for (let i = 0; i < cars.length; i++) {
			if (i === ignoreCar || cars[i].hp <= 0) continue;
			take(rayCylinder(ox, oy, oz, dx, dy, dz, cars[i].x, cars[i].z, 1.15, .25, 1.55, maxT), "car", i);
		}
		if (hitPlayer && alive && !driving) take(rayCylinder(ox, oy, oz, dx, dy, dz, px, pz, .42, .2, 1.8, maxT), "player", 0);
		return best;
	}
	function los(x, z, tx, tz) {
		const dx = tx - x;
		const dz = tz - z;
		const len = Math.hypot(dx, dz) || 1;
		const hit = trace(x, 1.2, z, dx / len, 0, dz / len, len, -1, -1, false);
		return !hit || hit.kind !== "world" || hit.t > len - .4;
	}
	function hurtPlayer(amount) {
		if (!started || !alive || invuln > 0 || phase !== "play") return;
		lastHurt = 0;
		regenT = 0;
		let dmg = amount;
		if (armor > 0) {
			const absorb = Math.min(armor, dmg * .7);
			armor -= absorb;
			dmg -= absorb;
		}
		health -= dmg;
		shake = Math.max(shake, .18);
		if (health <= 0) {
			health = 0;
			die();
		}
	}
	function die() {
		if (!alive) return;
		alive = false;
		phase = "dead";
		lostCash = Math.min(cash, Math.floor(cash * .3) + (cash > 40 ? 50 : 0));
		if (hold.house) lostCash = Math.floor(lostCash * .5);
		cash -= lostCash;
		wanted = 0;
		clearT = 0;
		if (channel) channel = null;
		saveBooks();
		deathLeft = 3.1;
		if (driving) {
			const car = cars[playerCar];
			car.mode = "coast";
			driving = false;
		}
		say("Wasted", 3);
		pushHud();
	}
	function resolveCircle(x, z, r) {
		let hit = false;
		for (let n = 0; n < 2; n++) for (const b of blocks) {
			const p = pushCircle(x, z, r, b);
			x = p.x;
			z = p.z;
			hit = hit || p.hit;
		}
		if (x < -121) {
			x = -121;
			hit = true;
		}
		if (x > 121) {
			x = 121;
			hit = true;
		}
		if (z < -121) {
			z = -121;
			hit = true;
		}
		if (z > 121) {
			z = 121;
			hit = true;
		}
		return {
			x,
			z,
			hit
		};
	}
	function dropPed(p, killerPlayer) {
		if (p.state === "down") return;
		p.state = "down";
		p.hp = 0;
		if (p.faction !== "cop") p.respawn = 12;
		if (!killerPlayer || !started) return;
		if (job.active && job.kind === "hit" && p.faction === job.faction) {
			if (job.faction === "teal" ? p.x > 30 : p.x < -30) {
				job.flag = true;
				say(job.faction === "teal" ? "Teal down. Leave their block." : "King down. Leave their block.");
			}
		}
		if (p.faction === "cop") {
			bankCash(80);
			addStars(2);
			if (!owned.smg) {
				owned.smg = true;
				gun = "smg";
				say("Cop down. Took his SMG");
			} else say("Cop down");
		} else if (p.faction === "civ") {
			bankCash(40);
			addStars(1);
			say("Civilian down");
		} else {
			bankCash(120);
			addStars(1);
			say(p.faction === "amber" ? "Amber King down +$120" : "Teal crew down +$120");
		}
	}
	function damageCar(index, amount, fromPlayer) {
		const car = cars[index];
		if (car.hp <= 0 || car.mode === "locked") return;
		if (!started && !fromPlayer) return;
		car.hp -= amount;
		if (fromPlayer && car.police) addStars(1);
		if (car.hp <= 0) {
			car.hp = 0;
			car.speed = 0;
			car.mode = car.mode === "player" ? "player" : "idle";
			if (car.mode === "player") {
				say("Ride's dead");
				driving = false;
				car.mode = "idle";
				px = car.x + Math.cos(car.yaw) * 2.6;
				pz = car.z - Math.sin(car.yaw) * 2.6;
				const safe = resolveCircle(px, pz, .45);
				px = safe.x;
				pz = safe.z;
			}
		}
	}
	function spawnShot(x, y, z, dx, dy, dz, dist) {
		shots.push({
			x,
			y,
			z,
			x2: x + dx * dist,
			y2: y + dy * dist,
			z2: z + dz * dist,
			life: .09
		});
		if (shots.length > MAX_SHOTS) shots.shift();
	}
	function playerShoot(force) {
		if (!started || !alive || phase !== "play") return;
		if (!force && (shootCd > 0 || reloadT > 0)) return;
		const spec = GUNS[gun];
		const a = ammo[gun];
		if (!force && a.mag <= 0) {
			if (a.reserve <= 0) say("Empty");
			else startReload();
			return;
		}
		if (!force) a.mag -= 1;
		shootCd = spec.cd;
		const e = eye();
		const pellets = force ? 1 : spec.pellets;
		let said = false;
		for (let n = 0; n < pellets; n++) {
			const spread = force ? 0 : (rand() - .5) * spec.spread * 2;
			const yaw = Math.atan2(-e.dx, -e.dz) + spread;
			const pitch = Math.asin(clamp(e.dy, -1, 1)) + (force ? 0 : (rand() - .5) * spec.spread * .35);
			const dx = -Math.sin(yaw) * Math.cos(pitch);
			const dy = Math.sin(pitch);
			const dz = -Math.cos(yaw) * Math.cos(pitch);
			const maxT = spec.range;
			const ignoreCar = driving ? playerCar : -1;
			const hit = trace(e.x, e.y, e.z, dx, dy, dz, maxT, ignoreCar, -1, false);
			const dist = hit ? hit.t : Math.min(18, maxT);
			spawnShot(e.x, e.y, e.z, dx, dy, dz, dist);
			if (n === 0) {
				flashT = .08;
				flashX = e.x + dx * .9;
				flashY = e.y + dy * .9;
				flashZ = e.z + dz * .9;
			}
			if (!hit) continue;
			if (hit.kind === "ped") {
				const p = peds[hit.index];
				p.hp -= spec.dmg;
				if (p.hp <= 0) dropPed(p, true);
				else {
					p.state = "fight";
					if (!said) {
						said = true;
						say("Hit");
					}
				}
			} else if (hit.kind === "car") damageCar(hit.index, spec.dmg * .65, true);
		}
		audio.shot(gun);
		if (wanted === 0) addStars(1);
		else sinceCrime = 0;
		sinceShot = 0;
		if (!force && a.mag <= 0 && a.reserve > 0) startReload();
	}
	function npcShoot(x, z, tx, ty, tz, spread, dmg, ignoreCar) {
		const dx0 = tx - x;
		const dy0 = ty - 1.2;
		const dz0 = tz - z;
		const len = Math.hypot(dx0, dy0, dz0) || 1;
		let dx = dx0 / len;
		let dy = dy0 / len;
		let dz = dz0 / len;
		const j = (rand() - .5) * spread;
		const yaw = Math.atan2(-dx, -dz) + j;
		const pitch = Math.asin(clamp(dy, -1, 1));
		dx = -Math.sin(yaw) * Math.cos(pitch);
		dy = Math.sin(pitch);
		dz = -Math.cos(yaw) * Math.cos(pitch);
		const hit = trace(x, 1.2, z, dx, dy, dz, 40, ignoreCar, -1, true);
		const dist = hit ? Math.min(hit.t, 24) : 12;
		spawnShot(x, 1.2, z, dx, dy, dz, dist);
		if (Math.hypot(x - px, z - pz) < 34 || driving && Math.hypot(x - cars[playerCar].x, z - cars[playerCar].z) < 34) audio.shot("pistol");
		if (hit?.kind === "player") hurtPlayer(dmg);
		else if (hit?.kind === "ped") {
			const p = peds[hit.index];
			p.hp -= dmg * 2.2;
			if (p.hp <= 0) dropPed(p, false);
		} else if (hit?.kind === "car" && hit.index === playerCar && driving) {
			damageCar(hit.index, dmg, false);
			hurtPlayer(dmg * .35);
		}
	}
	function tryUse() {
		if (!started || !alive || phase !== "play") return;
		if (driving) {
			const car = cars[playerCar];
			const rx = Math.cos(car.yaw);
			const rz = -Math.sin(car.yaw);
			let sx = car.x + rx * 2.4;
			let sz = car.z + rz * 2.4;
			if (blocks.some((b) => circleHitsAABB(sx, sz, .45, b))) {
				sx = car.x - rx * 2.4;
				sz = car.z - rz * 2.4;
			}
			const safe = resolveCircle(sx, sz, .45);
			px = safe.x;
			pz = safe.z;
			vx = rx * 1.5;
			vz = rz * 1.5;
			camYaw = car.yaw;
			car.mode = "coast";
			driving = false;
			say("On foot");
			return;
		}
		let bestI = -1;
		let bestD = 4.6;
		for (let i = 0; i < cars.length; i++) {
			const c = cars[i];
			if (c.hp <= 0) continue;
			const d = Math.hypot(c.x - px, c.z - pz);
			if (d < bestD) {
				bestD = d;
				bestI = i;
			}
		}
		if (bestI < 0) {
			say("No car in reach", 1.2);
			return;
		}
		const car = cars[bestI];
		if (car.forSale) {
			const sport = spendById("sport");
			const price = sport ? scoreSpend(sport).cost : 0;
			say(price ? `Lot car. H buys it — $${price.toLocaleString("en-US")}` : "Lot car. H buys it.");
			return;
		}
		if (driving) cars[playerCar].mode = "coast";
		playerCar = bestI;
		driving = true;
		car.mode = "player";
		lookOffset = 0;
		if (car.police) {
			addStars(2);
			say("Stolen cruiser");
		} else if (car.hadDriver) {
			car.hadDriver = false;
			addStars(1);
			say("He called it in");
			let nearest = null;
			let nd = 18;
			for (const p of peds) {
				if (p.faction !== "civ" || !p.active || p.state === "down") continue;
				const d = Math.hypot(p.x - car.x, p.z - car.z);
				if (d < nd) {
					nd = d;
					nearest = p;
				}
			}
			if (nearest) {
				nearest.state = "flee";
				nearest.dive = .55;
			}
		} else if (car.alarm) {
			car.alarm = false;
			addStars(1);
			say("Alarm tripped");
		} else say("In the seat");
		audio.blip(140, .08, "square", .03);
	}
	function updatePlayer(dt) {
		drifting = false;
		const throttle = clamp((held("KeyW") || held("ArrowUp") ? 1 : 0) - (held("KeyS") || held("ArrowDown") ? 1 : 0) + touch.y, -1, 1);
		if (driving) {
			const car = cars[playerCar];
			if (car.hp <= 0) {
				driving = false;
				return;
			}
			let steer = 0;
			if (held("KeyA") || held("ArrowLeft")) steer += 1;
			if (held("KeyD") || held("ArrowRight")) steer -= 1;
			steer = clamp(steer - touch.x, -1, 1);
			if (steerOverride !== null) steer = clamp(steerOverride, -1, 1);
			const ride = RIDES[car.ride];
			const hk = clamp(car.hp / car.maxHp, .28, 1);
			drifting = (held("ShiftLeft") || held("ShiftRight") || touch.sprint) && Math.abs(car.speed) > 5;
			const speedFactor = clamp(Math.abs(car.speed) / 7, .22, 1);
			const reverse = car.speed >= 0 ? 1 : -1;
			const turn = ride.turn * (drifting ? 1.9 : 1) * speedFactor * reverse;
			car.yaw += steer * turn * dt;
			const accel = ride.accel * (.45 + .55 * hk) * (1 + hold.tunes * .12);
			const brake = 46;
			const vmax = ride.vmax * (.55 + .45 * hk) * (1 + hold.tunes * .1);
			if (throttle > .05) car.speed += accel * throttle * dt;
			else if (throttle < -.05) {
				if (car.speed > .6) car.speed -= brake * dt;
				else car.speed -= 16 * dt;
			} else {
				const drag = 2.1 + Math.abs(car.speed) * .08;
				car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), drag * dt);
			}
			if (drifting) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6.5 * dt);
			car.speed = clamp(car.speed, -11, vmax);
			car.lat *= Math.exp(-(drifting ? 1.35 : 8) * dt);
			if (drifting) car.lat += -steer * Math.abs(car.speed) * 2.5 * dt;
			car.lat = clamp(car.lat, -16, 16);
			const fx = -Math.sin(car.yaw);
			const fz = -Math.cos(car.yaw);
			const rx = Math.cos(car.yaw);
			const rz = -Math.sin(car.yaw);
			const ox = car.x;
			const oz = car.z;
			car.x += (fx * car.speed + rx * car.lat) * dt;
			car.z += (fz * car.speed + rz * car.lat) * dt;
			const resolved = resolveCircle(car.x, car.z, carRadius(car.ride));
			const corrected = Math.hypot(resolved.x - car.x, resolved.z - car.z);
			car.x = resolved.x;
			car.z = resolved.z;
			if (corrected > .02 && Math.abs(car.speed) > 12) {
				car.speed *= .42;
				car.lat *= .4;
				if (lastHurt > .45) hurtPlayer((Math.abs(car.speed) > 8 ? 8 : 4) + corrected * 6);
				shake = Math.max(shake, .12);
			}
			if (Math.hypot(car.x - ox, car.z - oz) < .02 && Math.abs(car.speed) > 2 && corrected > 0) car.speed *= .8;
			car.spin += car.speed * dt;
			if (drifting && Math.abs(car.lat) > 4) shake = Math.max(shake, .05);
			if (held("KeyQ")) lookOffset += 1.5 * dt;
			if (held("KeyE")) lookOffset -= 1.5 * dt;
			lookOffset = clamp(lookOffset, -1.15, 1.15);
			return;
		}
		drifting = false;
		if (channel) {
			vx = 0;
			vz = 0;
			if (held("KeyQ")) camYaw += 1.7 * dt;
			if (held("KeyE")) camYaw -= 1.7 * dt;
			return;
		}
		let strafe = 0;
		if (held("KeyA") || held("ArrowLeft")) strafe -= 1;
		if (held("KeyD") || held("ArrowRight")) strafe += 1;
		strafe = clamp(strafe + touch.x, -1, 1);
		const speed = held("ShiftLeft") || held("ShiftRight") || touch.sprint ? 9.2 : 5.6;
		const fx = -Math.sin(camYaw);
		const fz = -Math.cos(camYaw);
		const rx = Math.cos(camYaw);
		const rz = -Math.sin(camYaw);
		vx = (fx * throttle + rx * strafe) * speed;
		vz = (fz * throttle + rz * strafe) * speed;
		if (Math.hypot(throttle, strafe) > 1) {
			const k = 1 / Math.hypot(throttle, strafe);
			vx *= k;
			vz *= k;
		}
		px += vx * dt;
		pz += vz * dt;
		const resolved = resolveCircle(px, pz, .42);
		px = resolved.x;
		pz = resolved.z;
		for (const c of cars) {
			if (c.hp <= 0) continue;
			const dx = px - c.x;
			const dz = pz - c.z;
			const min = 1.7;
			const d = Math.hypot(dx, dz);
			if (d < min && d > .001) {
				px = c.x + dx / d * min;
				pz = c.z + dz / d * min;
				if (Math.abs(c.speed) > 8) hurtPlayer((Math.abs(c.speed) - 8) * 1.4);
			}
		}
		if (held("KeyQ")) camYaw += 1.7 * dt;
		if (held("KeyE")) camYaw -= 1.7 * dt;
		if (Math.hypot(vx, vz) > .4 && document.pointerLockElement !== canvas && Math.abs(touch.lookX) + Math.abs(touch.lookY) < .2 && !held("KeyQ") && !held("KeyE")) {
			const face = Math.atan2(-vx, -vz);
			camYaw += wrap(face - camYaw) * Math.min(1, dt * 6);
		}
	}
	function autoDrive(car, tx, tz, dt, turn, targetSpeed) {
		const diff = wrap(yawTo(car.x, car.z, tx, tz) - car.yaw);
		const steer = clamp(diff / .5, -1, 1);
		const sf = clamp(Math.abs(car.speed) / 5, .45, 1);
		car.yaw += steer * turn * sf * dt;
		if (car.speed < targetSpeed) car.speed += 18 * dt;
		else car.speed -= 22 * dt;
		const ox = car.x;
		const oz = car.z;
		car.x += -Math.sin(car.yaw) * car.speed * dt;
		car.z += -Math.cos(car.yaw) * car.speed * dt;
		car.lat *= Math.exp(-4 * dt);
		car.x += Math.cos(car.yaw) * car.lat * dt;
		car.z += -Math.sin(car.yaw) * car.lat * dt;
		const resolved = resolveCircle(car.x, car.z, carRadius(car.ride));
		if (resolved.hit && car.speed > 8) car.speed *= .7;
		car.x = resolved.x;
		car.z = resolved.z;
		car.spin += car.speed * dt;
		if (Math.hypot(car.x - ox, car.z - oz) < .05 && targetSpeed > 3) car.stuckT += dt;
		else car.stuckT = Math.max(0, car.stuckT - dt);
		if (car.stuckT > 2.2) {
			const spot = nearestRoad(car.x + (rand() - .5) * 10, car.z + (rand() - .5) * 10);
			car.x = spot.x;
			car.z = spot.z;
			car.yaw = spot.yaw;
			car.speed = 8;
			car.stuckT = 0;
		}
		return Math.abs(diff);
	}
	function velOf(c) {
		const fx = -Math.sin(c.yaw);
		const fz = -Math.cos(c.yaw);
		const rx = Math.cos(c.yaw);
		const rz = -Math.sin(c.yaw);
		return {
			x: fx * c.speed + rx * c.lat,
			z: fz * c.speed + rz * c.lat
		};
	}
	function kick(c, ix, iz) {
		if (c.mode === "locked" || c.hp <= 0) return;
		const fx = -Math.sin(c.yaw);
		const fz = -Math.cos(c.yaw);
		const rx = Math.cos(c.yaw);
		const rz = -Math.sin(c.yaw);
		const m = RIDES[c.ride].mass;
		c.speed = clamp(c.speed + (ix * fx + iz * fz) / m, -14, RIDES[c.ride].vmax);
		c.lat = clamp(c.lat + (ix * rx + iz * rz) / m, -12, 12);
	}
	function updateCars(dt) {
		const me = playerPos();
		const police = cars.filter((c) => c.police && c.mode !== "player" && c.hp > 0);
		police.sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z));
		for (const c of police) if (c.block && wanted >= 4) c.mode = "block";
		else c.block = false;
		const free = police.filter((c) => !c.block);
		let searchN = 0;
		let chaseN = 0;
		if (started && wanted === 1) searchN = 1;
		else if (started && wanted === 2) chaseN = 2;
		else if (started && wanted === 3) chaseN = Math.min(3, free.length);
		else if (started && wanted >= 4) chaseN = Math.min(2, free.length);
		free.forEach((c, i) => {
			if (i < searchN) c.mode = "search";
			else if (i < searchN + chaseN) c.mode = "chase";
			else c.mode = c.wps.length ? "traffic" : "idle";
		});
		for (let i = 0; i < cars.length; i++) {
			const car = cars[i];
			if (car.mode === "player" || car.mode === "locked" || car.hp <= 0) continue;
			if (car.mode === "coast" || car.mode === "idle") {
				car.speed *= Math.exp(-1.4 * dt);
				car.lat *= Math.exp(-3 * dt);
				if (Math.abs(car.speed) < .3) car.speed = 0;
				car.x += -Math.sin(car.yaw) * car.speed * dt + Math.cos(car.yaw) * car.lat * dt;
				car.z += -Math.cos(car.yaw) * car.speed * dt - Math.sin(car.yaw) * car.lat * dt;
				const resolved = resolveCircle(car.x, car.z, carRadius(car.ride));
				car.x = resolved.x;
				car.z = resolved.z;
				continue;
			}
			if (car.mode === "block") {
				car.speed *= Math.exp(-3 * dt);
				car.lat *= Math.exp(-3 * dt);
				if (Math.hypot(car.x - me.x, car.z - me.z) < 16 || wanted < 4) {
					car.block = false;
					car.mode = "chase";
				}
				continue;
			}
			if (car.mode === "search") {
				const orbit = Math.hypot(car.x - me.x, car.z - me.z) < 18;
				autoDrive(car, orbit ? me.x + Math.cos(sirenFlip) * 16 : me.x, orbit ? me.z + Math.sin(sirenFlip) * 16 : me.z, dt, 2.1, orbit ? 8 : 16);
				continue;
			}
			if (car.mode === "tail") {
				const fy = -Math.sin(me.yaw);
				const fz = -Math.cos(me.yaw);
				autoDrive(car, me.x - fy * 7, me.z - fz * 7, dt, 2.7, 34);
				continue;
			}
			if (car.mode === "chase") {
				const lead = driving ? clamp(cars[playerCar].speed, 0, 20) * .45 : 0;
				const fy = -Math.sin(me.yaw);
				const fz = -Math.cos(me.yaw);
				autoDrive(car, me.x + fy * lead, me.z + fz * lead, dt, 2.55, angSpeed(car, me));
				car.shootCd -= dt;
				const dist = Math.hypot(car.x - me.x, car.z - me.z);
				if (wanted >= 3 && car.shootCd <= 0 && dist < 26 && los(car.x, car.z, me.x, me.z)) {
					car.shootCd = .95;
					const aimY = driving ? 1.1 : 1.3;
					npcShoot(car.x, car.z, me.x, aimY, me.z, wanted >= 5 ? .1 : .16, wanted >= 4 ? 8 : 6, i);
				}
				continue;
			}
			if (car.wps.length === 0) continue;
			const wp = car.wps[car.wp % car.wps.length];
			const dxp = me.x - car.x;
			const dzp = me.z - car.z;
			const distP = Math.hypot(dxp, dzp);
			const fx = -Math.sin(car.yaw);
			const fz = -Math.cos(car.yaw);
			const ahead = dxp * fx + dzp * fz;
			let tx = wp.x;
			let tz = wp.z;
			let spd = car.maxSpeed;
			if (distP < 15 && ahead > 0 && ahead < 14) {
				const rx = Math.cos(car.yaw);
				const rz = -Math.sin(car.yaw);
				const away = dxp * rx + dzp * rz >= 0 ? -1 : 1;
				tx = car.x + fx * 8 + rx * away * 6;
				tz = car.z + fz * 8 + rz * away * 6;
				spd = Math.min(spd, 6);
			}
			const ang = autoDrive(car, tx, tz, dt, 2.1, spd);
			if (Math.hypot(car.x - wp.x, car.z - wp.z) < 7 || ang > 2.4) car.wp = (car.wp + 1) % car.wps.length;
		}
		for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
			const a = cars[i];
			const b = cars[j];
			if (a.hp <= 0 || b.hp <= 0) continue;
			const dx = b.x - a.x;
			const dz = b.z - a.z;
			const d = Math.hypot(dx, dz) || .001;
			const min = carRadius(a.ride) + carRadius(b.ride);
			if (d >= min) continue;
			const push = (min - d) * .5;
			const nx = dx / d;
			const nz = dz / d;
			if (a.mode !== "locked") {
				a.x -= nx * push;
				a.z -= nz * push;
			}
			if (b.mode !== "locked") {
				b.x += nx * push;
				b.z += nz * push;
			}
			const va = velOf(a);
			const vb = velOf(b);
			const relN = (va.x - vb.x) * nx + (va.z - vb.z) * nz;
			if (relN > 1) {
				const j = clamp(relN / (1 / RIDES[a.ride].mass + 1 / RIDES[b.ride].mass), 0, 18);
				kick(a, -nx * j, -nz * j);
				kick(b, nx * j, nz * j);
				const sideA = nx * Math.cos(a.yaw) - nz * Math.sin(a.yaw);
				a.yaw += sideA * clamp(relN, 0, 20) * .012;
				const sideB = nx * Math.cos(b.yaw) - nz * Math.sin(b.yaw);
				b.yaw -= sideB * clamp(relN, 0, 20) * .012;
			}
			if (relN > 6) {
				damageCar(i, relN * 2.4, b.mode === "player");
				damageCar(j, relN * 2.4, a.mode === "player");
				if ((a.mode === "player" || b.mode === "player") && started) {
					hurtPlayer(Math.min(28, relN * .28));
					shake = Math.max(shake, .16);
					if (crunchCd <= 0) {
						audio.crunch();
						crunchCd = .2;
					}
				}
			}
		}
		for (const c of cars) {
			if (c.mode === "locked" || c.hp <= 0) continue;
			const pushed = resolveCircle(c.x, c.z, carRadius(c.ride) * .92);
			c.x = pushed.x;
			c.z = pushed.z;
		}
		const driver = driving ? cars[playerCar] : null;
		if (driver && Math.abs(driver.speed) > 8) for (const p of peds) {
			if (!p.active || p.state === "down") continue;
			if (Math.hypot(p.x - driver.x, p.z - driver.z) < 2.15) {
				dropPed(p, true);
				driver.speed *= .92;
				say("Hit someone");
			}
		}
	}
	function angSpeed(car, me) {
		return Math.abs(wrap(yawTo(car.x, car.z, me.x, me.z) - car.yaw)) > 1 ? 14 : 33;
	}
	function enemiesOf(p) {
		const list = [];
		if (p.ally) {
			for (const o of peds) {
				if (o === p || !o.active || o.state === "down" || o.ally) continue;
				if (o.faction === "civ") continue;
				const copHeat = o.faction === "cop" && wanted >= 2;
				const gang = o.faction === "amber" || o.faction === "teal";
				if (copHeat || gang) list.push({
					x: o.x,
					z: o.z,
					ped: o
				});
			}
			return list;
		}
		for (const o of peds) {
			if (o === p || !o.active || o.state === "down") continue;
			if (p.faction === "amber" && o.faction === "teal" || p.faction === "teal" && o.faction === "amber" || p.faction === "cop" && o.faction !== "cop" || (p.faction === "amber" || p.faction === "teal") && o.faction === "cop") list.push({
				x: o.x,
				z: o.z,
				ped: o
			});
		}
		if (started && alive && p.faction !== "civ") {
			const me = playerPos();
			const zone = me.x < -30 ? "amber" : me.x > 30 ? "teal" : "mid";
			if (p.faction === "cop" && wanted >= 3 || (p.faction === "amber" || p.faction === "teal") && sinceShot < 7 || p.faction === "amber" && zone === "amber" || p.faction === "teal" && zone === "teal") list.push({
				x: me.x,
				z: me.z
			});
		}
		return list;
	}
	function updatePeds(dt) {
		const needCops = started && wanted >= 3 ? Math.min(4, wanted) : 0;
		let cops = 0;
		for (const p of peds) if (p.faction === "cop" && p.active && p.state !== "down") cops++;
		if (cops < needCops) for (const p of peds) {
			if (p.faction !== "cop" || p.active && p.state !== "down") continue;
			if (p.respawn > 0) continue;
			if (cops >= needCops) break;
			const me = playerPos();
			const spot = nearestRoad(me.x + (rand() - .5) * 36, me.z + (rand() - .5) * 36);
			if (Math.hypot(spot.x - me.x, spot.z - me.z) < 14) continue;
			p.x = spot.x;
			p.z = spot.z;
			p.hp = 120;
			p.state = "fight";
			p.active = true;
			p.cd = .4;
			cops++;
		}
		if (needCops === 0) {
			for (const p of peds) if (p.faction === "cop") p.active = false;
		}
		const gunNear = shots.length > 0;
		for (const p of peds) {
			if (!p.active) continue;
			p.bob += dt * (p.state === "fight" ? 0 : 6);
			p.cd -= dt;
			p.dive = Math.max(0, p.dive - dt);
			p.respawn = Math.max(0, p.respawn - dt);
			p.mark = Math.max(0, p.mark - dt);
			if (p.state === "down") {
				if (p.faction !== "cop" && p.respawn <= 0) {
					const me = playerPos();
					if (Math.hypot(p.x - me.x, p.z - me.z) > 26) {
						const home = p.goals[0] ?? {
							x: p.x,
							z: p.z
						};
						p.x = home.x;
						p.z = home.z;
						p.hp = p.faction === "civ" ? 70 : 100;
						p.state = "walk";
						p.active = true;
						p.dive = 0;
					}
				}
				continue;
			}
			if (p.hp <= 0) {
				p.ally = false;
				dropPed(p, false);
				if (p.faction === "cop") p.respawn = 8;
				continue;
			}
			if (channel && channel.ped >= 0 && peds[channel.ped] === p) continue;
			if (p.ally) {
				if (hold.crewT <= 0) {
					p.ally = false;
					p.state = "walk";
					continue;
				}
				const me = playerPos();
				const near = Math.hypot(p.x - me.x, p.z - me.z);
				let target = null;
				let best = 28;
				for (const e of enemiesOf(p)) {
					if (e.ped?.ally) continue;
					const d = Math.hypot(e.x - p.x, e.z - p.z);
					if (d < best && los(p.x, p.z, e.x, e.z)) {
						best = d;
						target = e;
					}
				}
				if (target && best < 22) {
					p.state = "fight";
					p.yaw = yawTo(p.x, p.z, target.x, target.z);
					if (p.cd <= 0) {
						p.cd = .42;
						npcShoot(p.x, p.z, target.x, 1.25, target.z, .05, 8, -1);
					}
					continue;
				}
				p.state = "walk";
				if (near > 3.2) {
					p.yaw = yawTo(p.x, p.z, me.x, me.z);
					const nx = p.x + -Math.sin(p.yaw) * 5.4 * dt;
					const nz = p.z + -Math.cos(p.yaw) * 5.4 * dt;
					if (!blocks.some((b) => circleHitsAABB(nx, nz, .34, b))) {
						p.x = nx;
						p.z = nz;
					}
				}
				continue;
			}
			const me = playerPos();
			const near = Math.hypot(p.x - me.x, p.z - me.z);
			const hotCar = driving && Math.abs(cars[playerCar].speed) > 12 && near < 8;
			if (p.faction === "civ" && (gunNear || hotCar || near < 8 && sinceCrime < 3)) {
				p.state = "flee";
				if (near < 7 || hotCar) p.dive = Math.max(p.dive, .62);
			}
			if (p.state === "flee") {
				p.yaw = Math.atan2(-(p.x - me.x), -(p.z - me.z)) + Math.PI;
				const nx = p.x + -Math.sin(p.yaw) * 6.2 * dt;
				const nz = p.z + -Math.cos(p.yaw) * 6.2 * dt;
				if (!blocks.some((b) => circleHitsAABB(nx, nz, .35, b))) {
					p.x = nx;
					p.z = nz;
				} else p.yaw += 1.4;
				continue;
			}
			let target = null;
			let best = p.faction === "cop" ? 36 : 22;
			for (const e of enemiesOf(p)) {
				const d = Math.hypot(e.x - p.x, e.z - p.z);
				if (d < best && los(p.x, p.z, e.x, e.z)) {
					best = d;
					target = e;
				}
			}
			if (target) {
				p.state = "fight";
				p.yaw = yawTo(p.x, p.z, target.x, target.z);
				if (p.cd <= 0) {
					p.cd = p.faction === "cop" ? .48 : .72;
					const isPlayer = Math.hypot(target.x - me.x, target.z - me.z) < .8;
					npcShoot(p.x, p.z, target.x, isPlayer && driving ? 1.1 : 1.25, target.z, .07, p.faction === "cop" ? 9 : 7, -1);
				}
				continue;
			}
			p.state = "walk";
			const goal = p.goals[p.goal % p.goals.length];
			if (goal && p.faction !== "civ") {
				p.yaw = yawTo(p.x, p.z, goal.x, goal.z);
				if (Math.hypot(goal.x - p.x, goal.z - p.z) < 2) p.goal++;
			}
			const sp = p.faction === "cop" ? 6.4 : 1.7;
			const nx = p.x + -Math.sin(p.yaw) * sp * dt;
			const nz = p.z + -Math.cos(p.yaw) * sp * dt;
			if (blocks.some((b) => circleHitsAABB(nx, nz, .34, b)) || Math.abs(nx) > 119 || Math.abs(nz) > 119) p.yaw += Math.PI / 2;
			else {
				p.x = nx;
				p.z = nz;
			}
		}
	}
	function updatePickups() {
		if (!started || !alive) return;
		const me = playerPos();
		for (const k of pickups) {
			if (k.wait > 0) continue;
			if (Math.hypot(k.x - me.x, k.z - me.z) < 1.7) {
				if (k.kind === "med") {
					health = Math.min(100, health + 45);
					say("Patched up");
				} else {
					armor = Math.min(100, armor + 50);
					say("Vest on");
				}
				k.wait = 22;
				audio.blip(520, .1, "sine", .04);
			}
		}
	}
	function nearLot() {
		const me = playerPos();
		return Math.hypot(me.x - LOT.x, me.z - LOT.z) < 8 || Math.hypot(me.x - 16, me.z + 8) < 6;
	}
	function jobLine() {
		if (!job.active) return "";
		const secs = Math.max(0, Math.ceil(job.t));
		if (job.kind === "deliver") return job.flag ? `Drop the ride · ${secs}s` : `Get in the marked ride · ${secs}s`;
		if (job.kind === "shake") return `Lose the tail · ${secs}s`;
		return job.flag ? `Get off their block · ${secs}s` : job.faction === "teal" ? `Drop a Teal on their block · ${secs}s` : `Drop a King on their block · ${secs}s`;
	}
	function inCover(x, z) {
		if (hold.house) {
			const home = spots.find((s) => s.id === "home1");
			if (home && Math.hypot(x - home.x, z - home.z) < 7) return true;
		}
		for (const rx of roadXs) if (Math.abs(x - rx) < ROAD * .5 - .6) return false;
		for (const rz of roadZs) if (Math.abs(z - rz) < ROAD * .5 - .6) return false;
		for (const b of staticBlocks) {
			if (b.h < 4) continue;
			const dx = x < b.minX ? b.minX - x : x > b.maxX ? x - b.maxX : 0;
			const dz = z < b.minZ ? b.minZ - z : z > b.maxZ ? z - b.maxZ : 0;
			const d2 = dx * dx + dz * dz;
			if (d2 < 9 && d2 > .04) return true;
		}
		return false;
	}
	function placeBlock() {
		const me = playerPos();
		const fx = -Math.sin(me.yaw);
		const fz = -Math.cos(me.yaw);
		const rx = Math.cos(me.yaw);
		const rz = -Math.sin(me.yaw);
		let bestX = 0;
		let bestZ = 0;
		let best = -1e9;
		for (const x of roadXs) for (const z of roadZs) {
			const dx = x - me.x;
			const dz = z - me.z;
			const along = dx * fx + dz * fz;
			if (along < 26 || along > 80) continue;
			const score = along - Math.abs(dx * rx + dz * rz) * 1.5;
			if (score > best) {
				best = score;
				bestX = x;
				bestZ = z;
			}
		}
		if (best < 0) return;
		const cops = cars.map((c, i) => ({
			c,
			i
		})).filter((o) => o.c.police && o.c.mode !== "player" && o.c.hp > 40).sort((a, b) => Math.hypot(b.c.x - me.x, b.c.z - me.z) - Math.hypot(a.c.x - me.x, a.c.z - me.z));
		if (cops.length === 0) return;
		cops.slice(0, 2).forEach((o, n) => {
			const side = n === 0 ? -2.6 : 2.6;
			o.c.x = bestX + rx * side;
			o.c.z = bestZ + rz * side;
			o.c.yaw = yawTo(o.c.x, o.c.z, me.x, me.z);
			o.c.speed = 0;
			o.c.lat = 0;
			o.c.mode = "block";
			o.c.block = true;
			o.c.hp = Math.max(o.c.hp, 160);
		});
		say("Roadblock ahead");
	}
	function startReload() {
		if (reloadT > 0) return;
		const spec = GUNS[gun];
		const a = ammo[gun];
		if (a.mag >= spec.mag || a.reserve <= 0) return;
		reloadT = spec.reload;
		say("Reloading");
	}
	function cycleGun() {
		const have = [
			"pistol",
			"shotgun",
			"smg"
		].filter((id) => owned[id]);
		gun = have[(Math.max(0, have.indexOf(gun)) + 1) % have.length] ?? "pistol";
		say(gun === "smg" ? "SMG" : gun === "shotgun" ? "Shotgun" : "Pistol");
	}
	function selectGun(id) {
		if (!owned[id]) {
			say(id === "smg" ? "Take one off a cop" : "Buy it at the lot");
			return;
		}
		gun = id;
		say(id === "smg" ? "SMG" : id === "shotgun" ? "Shotgun" : "Pistol");
	}
	function cycleRadio() {
		radioTrack = (radioTrack + 1) % RADIO.length;
		say(RADIO[radioTrack] ?? "NIGHTLINE");
	}
	function tryBuy(kind) {
		if (!started || !alive || phase !== "play") return;
		if (!nearLot()) {
			say("The lot is in the plaza");
			return;
		}
		if (kind === "bail") buySpend("bribe");
		else if (kind === "vest") buySpend("vest");
		else if (kind === "shotgun") buySpend("shotgun");
		else buySpend("sport");
	}
	function farDrop(x, z) {
		const corners = [
			{
				x: roadXs[1] + LANE,
				z: roadZs[1] + LANE
			},
			{
				x: roadXs[4] - LANE,
				z: roadZs[1] + LANE
			},
			{
				x: roadXs[1] + LANE,
				z: roadZs[4] - LANE
			},
			{
				x: roadXs[4] - LANE,
				z: roadZs[4] - LANE
			}
		];
		let best = corners[0];
		let bd = -1;
		for (const c of corners) {
			const d = (c.x - x) ** 2 + (c.z - z) ** 2;
			if (d > bd) {
				bd = d;
				best = c;
			}
		}
		return best;
	}
	function releaseTail() {
		if (job.tail < 0) return;
		const c = cars[job.tail];
		if (c && c.mode === "tail") {
			c.mode = "traffic";
			c.color = job.prevColor;
			c.ride = job.prevRide;
			c.maxSpeed = job.prevSpeed;
		}
		job.tail = -1;
	}
	function finishJob(ok, pay, msg) {
		if (!job.active) return;
		job.active = false;
		job.cool = 8;
		job.show = false;
		releaseTail();
		if (ok && pay > 0) bankCash(pay);
		say(msg);
	}
	function startJob() {
		if (!alive || phase !== "play") return;
		const kind = [
			"deliver",
			"shake",
			"hit"
		][job.next % 3];
		job.next += 1;
		job.flag = false;
		job.hold = 0;
		job.kind = kind;
		if (kind === "deliver") {
			let idx = -1;
			for (let i = 0; i < cars.length; i++) {
				const c = cars[i];
				if (c.forSale || c.police || c.hp < 60) continue;
				if (i === playerCar && driving) continue;
				if (c.mode === "idle" || c.mode === "coast") {
					idx = i;
					break;
				}
			}
			if (idx < 0) {
				job.cool = 3;
				job.next -= 1;
				return;
			}
			const c = cars[idx];
			const drop = farDrop(c.x, c.z);
			job.car = idx;
			job.x = drop.x;
			job.z = drop.z;
			job.bx = c.x;
			job.bz = c.z;
			job.active = true;
			job.t = 55;
			job.show = true;
			say("Job: deliver that ride");
			return;
		}
		if (kind === "shake") {
			const me = playerPos();
			let idx = -1;
			let best = 1e9;
			for (let i = 0; i < cars.length; i++) {
				const c = cars[i];
				if (c.police || c.forSale || c.hp < 50 || c.mode === "player" || c.mode === "locked") continue;
				const d = Math.hypot(c.x - me.x, c.z - me.z);
				if (d < 12 || d > 75) continue;
				if (d < best) {
					best = d;
					idx = i;
				}
			}
			if (idx < 0) for (let i = 0; i < cars.length; i++) {
				const c = cars[i];
				if (!c.police && !c.forSale && c.mode !== "player" && c.mode !== "locked" && c.hp > 40) {
					idx = i;
					break;
				}
			}
			if (idx < 0) {
				job.cool = 3;
				job.next -= 1;
				return;
			}
			const c = cars[idx];
			if (Math.hypot(c.x - me.x, c.z - me.z) > 70) {
				const back = nearestRoad(me.x + Math.sin(me.yaw) * 18, me.z + Math.cos(me.yaw) * 18);
				c.x = back.x;
				c.z = back.z;
				c.yaw = back.yaw;
			}
			job.prevColor = c.color;
			job.prevRide = c.ride;
			job.prevSpeed = c.maxSpeed;
			c.mode = "tail";
			c.color = 12862774;
			c.ride = "sport";
			c.maxSpeed = 36;
			c.hp = Math.max(c.hp, 90);
			job.tail = idx;
			job.bx = c.x;
			job.bz = c.z;
			job.active = true;
			job.t = 40;
			job.show = true;
			say("Job: shake the tail");
			return;
		}
		job.faction = job.next % 2 === 0 ? "teal" : "amber";
		job.x = job.faction === "teal" ? 66 : -66;
		job.z = 12;
		job.bx = job.x;
		job.bz = job.z;
		job.active = true;
		job.t = 50;
		job.show = true;
		say(job.faction === "teal" ? "Job: drop a Teal, then get out" : "Job: drop a King, then get out");
	}
	function updateJob(dt) {
		if (!job.active) return;
		job.t -= dt;
		if (job.t <= 0) {
			finishJob(false, 0, "Job blown");
			return;
		}
		const me = playerPos();
		if (job.kind === "deliver") {
			const c = cars[job.car];
			if (!c || c.hp <= 0) {
				finishJob(false, 0, "The ride's dead");
				return;
			}
			const drivingIt = driving && playerCar === job.car;
			job.flag = drivingIt;
			if (drivingIt) {
				job.bx = job.x;
				job.bz = job.z;
				if (Math.hypot(c.x - job.x, c.z - job.z) < 8) finishJob(true, 260, "Delivered +$260");
			} else {
				job.bx = c.x;
				job.bz = c.z;
			}
			return;
		}
		if (job.kind === "shake") {
			const c = cars[job.tail];
			if (!c || c.hp <= 0 || c.mode !== "tail") {
				finishJob(true, 140, "Tail's scrap +$140");
				return;
			}
			job.bx = c.x;
			job.bz = c.z;
			if (Math.hypot(c.x - me.x, c.z - me.z) > 64) job.hold += dt;
			else job.hold = 0;
			if (job.hold > 5) finishJob(true, 200, "Lost them +$200");
			return;
		}
		job.bx = job.x;
		job.bz = job.z;
		if (job.flag) {
			if ((me.x < -30 ? "amber" : me.x > 30 ? "teal" : "mid") !== job.faction) finishJob(true, 220, "Out clean +$220");
		}
	}
	function step(dt) {
		starLock = Math.max(0, starLock - dt);
		sinceCrime += dt;
		sinceShot += dt;
		invuln = Math.max(0, invuln - dt);
		shootCd = Math.max(0, shootCd - dt);
		toastT = Math.max(0, toastT - dt);
		shake *= Math.exp(-4.5 * dt);
		lastHurt += dt;
		for (const k of pickups) k.wait = Math.max(0, k.wait - dt);
		for (let i = shots.length - 1; i >= 0; i--) {
			shots[i].life -= dt;
			if (shots[i].life <= 0) shots.splice(i, 1);
		}
		sirenFlip += dt;
		crunchCd = Math.max(0, crunchCd - dt);
		flashT = Math.max(0, flashT - dt);
		for (const s of spots) s.cool = Math.max(0, s.cool - dt);
		if (reloadT > 0) {
			reloadT -= dt;
			if (reloadT <= 0) {
				reloadT = 0;
				const spec = GUNS[gun];
				const a = ammo[gun];
				const need = spec.mag - a.mag;
				const take = Math.min(need, a.reserve);
				a.mag += take;
				a.reserve -= take;
			}
		}
		if (phase === "dead") {
			if (job.active) {
				job.active = false;
				job.show = false;
				releaseTail();
				job.cool = 6;
			}
			deathLeft -= dt;
			if (deathLeft <= 0) respawn();
			updateCars(dt * .4);
			return;
		}
		if (started && alive) {
			if (touch.useQueued) {
				touch.useQueued = false;
				tryUse();
			}
			if (touch.reloadQueued) {
				touch.reloadQueued = false;
				startReload();
			}
			if (touch.cycleGunQueued) {
				touch.cycleGunQueued = false;
				cycleGun();
			}
			if (touch.radioQueued) {
				touch.radioQueued = false;
				cycleRadio();
			}
			if (touch.hustleQueued) {
				touch.hustleQueued = false;
				beginHustle();
			}
			if (touch.bankQueued) {
				touch.bankQueued = false;
				cycleSpot();
			}
			if (touch.buy) {
				const kind = touch.buy;
				touch.buy = "";
				tryBuy(kind);
			}
			const tap = (code, slot) => {
				const down = held(code);
				const fire = down && !edge[slot];
				edge[slot] = down;
				return fire;
			};
			if (tap("KeyR", "r")) startReload();
			if (tap("KeyN", "n")) cycleRadio();
			if (tap("KeyB", "b")) tryBuy("bail");
			if (tap("KeyV", "v")) tryBuy("vest");
			if (tap("KeyG", "g")) tryBuy("shotgun");
			if (tap("KeyH", "h")) tryBuy("sport");
			if (tap("Digit1", "d1")) selectGun("pistol");
			if (tap("Digit2", "d2")) selectGun("shotgun");
			if (tap("Digit3", "d3")) selectGun("smg");
			if (tap("KeyJ", "j")) beginHustle();
			if (tap("KeyK", "k")) cycleSpot();
			const use = held("KeyF");
			if (use && !prevF) tryUse();
			prevF = use;
			if (touch.lookX || touch.lookY) {
				if (driving) {
					lookOffset -= touch.lookX * .004;
					lookPitch -= touch.lookY * .0035;
					lookPitch = clamp(lookPitch, -.7, .4);
				} else {
					camYaw -= touch.lookX * .0045;
					camPitch -= touch.lookY * .0038;
					camPitch = clamp(camPitch, -.95, 1.05);
				}
				touch.lookX = 0;
				touch.lookY = 0;
			}
			updatePlayer(dt);
			updateChannel(dt);
			updateHoldings(dt);
			if (mouseFire || touch.fire || held("Space")) playerShoot(false);
			if (lastHurt > 6 && health < 100 && health > 0) {
				regenT += dt;
				health = Math.min(100, health + 10 * dt);
			}
			const meNow = playerPos();
			coverNow = inCover(meNow.x, meNow.z);
			if (wanted >= 5 && !coverNow) {
				seenX = meNow.x;
				seenZ = meNow.z;
				lit = true;
				coverSaid = false;
			} else if (wanted >= 5 && coverNow) {
				lit = false;
				if (!coverSaid) {
					coverSaid = true;
					say("Off the light");
				}
			} else {
				lit = false;
				coverSaid = false;
			}
			if (wanted >= 4 && !blockLive) {
				placeBlock();
				blockLive = true;
			}
			if (wanted < 4 && blockLive) {
				blockLive = false;
				for (const c of cars) c.block = false;
			}
			if (job.active) updateJob(dt);
			else if (alive) {
				job.cool -= dt;
				if (job.cool <= 0) startJob();
			}
			if (wanted >= 5 && lit) clearT = 0;
			else if (wanted > 0 && sinceCrime > 8) {
				let nearest = 1e9;
				for (const c of cars) {
					if (!c.police || c.hp <= 0 || c.mode === "player") continue;
					nearest = Math.min(nearest, Math.hypot(c.x - meNow.x, c.z - meNow.z));
				}
				for (const p of peds) {
					if (p.faction !== "cop" || !p.active || p.state === "down") continue;
					nearest = Math.min(nearest, Math.hypot(p.x - meNow.x, p.z - meNow.z));
				}
				if (nearest > (wanted >= 5 ? 50 : 62)) clearT += dt;
				else clearT = 0;
				if (clearT > Math.max(2.5, 5 - hold.lux * .6)) {
					wanted -= 1;
					clearT = 0;
					if (wanted < 4) {
						blockLive = false;
						for (const c of cars) c.block = false;
					}
					say(wanted <= 0 ? "Lost them" : "Heat dropping");
				}
			} else clearT = 0;
		} else prevF = held("KeyF");
		updateCars(dt);
		updatePeds(dt);
		updatePickups();
		if (audio.ctx && audio.engine && audio.engineGain && audio.sirenGain) {
			const sp = driving ? Math.abs(cars[playerCar].speed) : 0;
			const lat = driving ? Math.abs(cars[playerCar].lat) : 0;
			audio.engine.frequency.value = 42 + sp * 3.4 + lat * .6;
			audio.engineGain.gain.value = started && driving ? Math.min(.035, .008 + sp * 8e-4) : 0;
			let nearest = 1e9;
			if (started && wanted > 0) {
				const me = playerPos();
				for (const c of cars) {
					if (!c.police || c.hp <= 0 || c.mode === "player") continue;
					nearest = Math.min(nearest, Math.hypot(c.x - me.x, c.z - me.z));
				}
			}
			const closeness = nearest < 1e8 ? clamp(1 - nearest / 90, 0, 1) : 0;
			const sirenOn = started && wanted > 0;
			audio.sirenGain.gain.value = sirenOn ? .004 + closeness * .028 + (wanted >= 5 ? .006 : 0) : 0;
			if (sirenOn && audio.sirenA && audio.sirenB) {
				const hi = Math.sin(sirenFlip * 9) > 0;
				audio.sirenA.frequency.value = hi ? 760 : 640;
				audio.sirenB.frequency.value = hi ? 540 : 480;
			}
			if (audio.tireGain) {
				const screech = started && driving && (lat > 3.2 || drifting && sp > 8);
				audio.tireGain.gain.value = screech ? clamp((lat + (drifting ? 4 : 0)) / 90, 0, .04) : 0;
			}
			if (audio.radioGain && audio.radioA && audio.radioB) {
				const tracks = [
					{
						a: 110,
						b: 164.8
					},
					{
						a: 98,
						b: 146.8
					},
					{
						a: 130.8,
						b: 196
					},
					{
						a: 82.4,
						b: 123.5
					}
				];
				const tr = tracks[radioTrack] ?? tracks[0];
				audio.radioA.frequency.value = tr.a;
				audio.radioB.frequency.value = tr.b;
				const pulse = .65 + .35 * Math.sin(sirenFlip * (radioTrack === 3 ? 8 : 3));
				audio.radioGain.gain.value = started && radioOn ? .015 * pulse * (sirenOn ? .4 : 1) : 0;
			}
		}
	}
	function syncWorld(elapsed) {
		bodyMesh.instanceMatrix.needsUpdate = true;
		cabinMesh.instanceMatrix.needsUpdate = true;
		glassMesh.instanceMatrix.needsUpdate = true;
		hoodMesh.instanceMatrix.needsUpdate = true;
		wheelMesh.instanceMatrix.needsUpdate = true;
		rimMesh.instanceMatrix.needsUpdate = true;
		headMesh.instanceMatrix.needsUpdate = true;
		tailMesh.instanceMatrix.needsUpdate = true;
		barMesh.instanceMatrix.needsUpdate = true;
		shadowMesh.instanceMatrix.needsUpdate = true;
		const blink = Math.sin(sirenFlip * 14) > 0;
		cars.forEach((car, i) => {
			const dead = car.hp <= 0;
			const rs = RIDES[car.ride].scale;
			const squat = dead ? .42 : car.hp < car.maxHp * .4 ? .82 : 1;
			q.setFromAxisAngle(up, car.yaw + Math.PI);
			const hop = (dead ? .16 : .62) * rs[1] * squat;
			v.set(car.x, hop, car.z);
			scaleBody.set(rs[0], rs[1] * squat, rs[2]);
			m.compose(v, q, scaleBody);
			bodyMesh.setMatrixAt(i, m);
			v2.set(0, .42 * rs[1], -.2 * rs[2]).applyQuaternion(q);
			v.set(car.x, hop, car.z).add(v2);
			m.compose(v, q, scaleBody);
			cabinMesh.setMatrixAt(i, m);
			scaleBody.set(rs[0] * .96, rs[1] * squat * .92, rs[2] * .96);
			m.compose(v, q, dead ? scale0 : scaleBody);
			glassMesh.setMatrixAt(i, m);
			v.set(car.x, .04, car.z);
			scaleBody.set(rs[0] * 1.15, 1, rs[2] * 1.25);
			m.compose(v, q, dead ? scale0 : scaleBody);
			shadowMesh.setMatrixAt(i, m);
			v2.set(0, .02 * rs[1], .95 * rs[2]).applyQuaternion(q);
			v.set(car.x, hop, car.z).add(v2);
			scaleBody.set(rs[0], rs[1] * squat * .85, rs[2]);
			m.compose(v, q, dead ? scale0 : scaleBody);
			hoodMesh.setMatrixAt(i, m);
			tint.setHex(dead ? 2763306 : car.color);
			bodyMesh.setColorAt(i, tint);
			hoodMesh.setColorAt(i, tint);
			const wheelLocal = [
				[
					-.78 * rs[0],
					-.28 * rs[1],
					1.25 * rs[2]
				],
				[
					.78 * rs[0],
					-.28 * rs[1],
					1.25 * rs[2]
				],
				[
					-.78 * rs[0],
					-.28 * rs[1],
					-1.25 * rs[2]
				],
				[
					.78 * rs[0],
					-.28 * rs[1],
					-1.25 * rs[2]
				]
			];
			q2.setFromAxisAngle(axle, car.spin);
			qw.multiplyQuaternions(q, q2);
			scaleWheel.set(.85 + rs[0] * .2, .85 + rs[0] * .2, .85 + rs[0] * .2);
			wheelLocal.forEach((off, w) => {
				v2.set(off[0], off[1], off[2]).applyQuaternion(q);
				v.set(car.x, hop, car.z).add(v2);
				m.compose(v, qw, dead ? scale0 : scaleWheel);
				wheelMesh.setMatrixAt(i * 4 + w, m);
				m.compose(v, qw, dead ? scale0 : scale1);
				rimMesh.setMatrixAt(i * 4 + w, m);
			});
			[[
				-.55 * rs[0],
				.05,
				2.02 * rs[2]
			], [
				.55 * rs[0],
				.05,
				2.02 * rs[2]
			]].forEach((off, k) => {
				v2.set(off[0], off[1], off[2]).applyQuaternion(q);
				v.set(car.x, hop, car.z).add(v2);
				m.compose(v, q, dead ? scale0 : scale1);
				headMesh.setMatrixAt(i * 2 + k, m);
			});
			[[
				-.55 * rs[0],
				.05,
				-2.02 * rs[2]
			], [
				.55 * rs[0],
				.05,
				-2.02 * rs[2]
			]].forEach((off, k) => {
				v2.set(off[0], off[1], off[2]).applyQuaternion(q);
				v.set(car.x, hop, car.z).add(v2);
				m.compose(v, q, dead ? scale0 : scale1);
				tailMesh.setMatrixAt(i * 2 + k, m);
			});
			[-.28, .28].forEach((xOff, k) => {
				v2.set(xOff, .7 * rs[1], -.15).applyQuaternion(q);
				v.set(car.x, hop, car.z).add(v2);
				m.compose(v, q, car.police && !dead ? scale1 : scale0);
				barMesh.setMatrixAt(i * 2 + k, m);
				tint.setHex(!blink === (k === 0) ? 16722474 : 3829247);
				barMesh.setColorAt(i * 2 + k, tint);
			});
		});
		if (bodyMesh.instanceColor) bodyMesh.instanceColor.needsUpdate = true;
		if (hoodMesh.instanceColor) hoodMesh.instanceColor.needsUpdate = true;
		if (barMesh.instanceColor) barMesh.instanceColor.needsUpdate = true;
		pedBody.instanceMatrix.needsUpdate = true;
		pedHead.instanceMatrix.needsUpdate = true;
		pedHair.instanceMatrix.needsUpdate = true;
		pedLeg.instanceMatrix.needsUpdate = true;
		pedArm.instanceMatrix.needsUpdate = true;
		peds.forEach((p, i) => {
			if (!p.active) {
				m.compose(v.set(0, -10, 0), qid, scale0);
				pedBody.setMatrixAt(i, m);
				pedHead.setMatrixAt(i, m);
				pedHair.setMatrixAt(i, m);
				pedLeg.setMatrixAt(i * 2, m);
				pedLeg.setMatrixAt(i * 2 + 1, m);
				pedArm.setMatrixAt(i * 2, m);
				pedArm.setMatrixAt(i * 2 + 1, m);
				return;
			}
			const down = p.state === "down" || p.dive > .2;
			q.setFromAxisAngle(up, p.yaw + Math.PI);
			if (down) {
				q2.setFromAxisAngle(axle, Math.PI / 2);
				q.multiply(q2);
			}
			const bob = down ? 0 : Math.abs(Math.sin(p.bob)) * .05;
			const stride = down ? 0 : Math.sin(p.bob);
			const baseY = (down ? .32 : .92) + bob;
			v.set(p.x, baseY, p.z);
			m.compose(v, q, scale1);
			pedBody.setMatrixAt(i, m);
			v2.set(0, down ? .08 : .48, 0).applyQuaternion(q);
			v.set(p.x, baseY, p.z).add(v2);
			m.compose(v, q, scale1);
			pedHead.setMatrixAt(i, m);
			v2.set(0, down ? .18 : .58, down ? 0 : -.02).applyQuaternion(q);
			v.set(p.x, baseY, p.z).add(v2);
			m.compose(v, q, scale1);
			pedHair.setMatrixAt(i, m);
			v2.set(-.12, -.48, stride * .16).applyQuaternion(q);
			v.set(p.x, baseY, p.z).add(v2);
			m.compose(v, q, scale1);
			pedLeg.setMatrixAt(i * 2, m);
			v2.set(.12, -.48, -stride * .16).applyQuaternion(q);
			v.set(p.x, baseY, p.z).add(v2);
			m.compose(v, q, scale1);
			pedLeg.setMatrixAt(i * 2 + 1, m);
			v2.set(-.3, .04, -stride * .18).applyQuaternion(q);
			v.set(p.x, baseY, p.z).add(v2);
			m.compose(v, q, scale1);
			pedArm.setMatrixAt(i * 2, m);
			v2.set(.3, .04, stride * .18).applyQuaternion(q);
			v.set(p.x, baseY, p.z).add(v2);
			m.compose(v, q, scale1);
			pedArm.setMatrixAt(i * 2 + 1, m);
		});
		playerGroup.visible = started && !driving && alive;
		if (playerGroup.visible) {
			const pace = Math.hypot(vx, vz);
			playerGroup.position.set(px, Math.abs(Math.sin(elapsed * (6 + pace))) * .045, pz);
			playerGroup.rotation.y = camYaw + Math.PI;
			const swing = pace > .4 ? Math.sin(elapsed * 8) * .7 : 0;
			leftPivot.rotation.x = swing;
			rightPivot.rotation.x = -swing;
		}
		water.position.y = .9 + Math.sin(elapsed * 1.6) * .03;
		jet.scale.y = .85 + Math.sin(elapsed * 6) * .12;
		jet.position.y = 1.55 + jet.scale.y * .15;
		pickupMesh.instanceMatrix.needsUpdate = true;
		pickups.forEach((p, i) => {
			const hide = p.wait > 0;
			q.setFromAxisAngle(up, elapsed * 1.4 + i);
			v.set(p.x, hide ? -5 : .85 + Math.sin(elapsed * 3 + i) * .08, p.z);
			m.compose(v, q, hide ? scale0 : scale1);
			pickupMesh.setMatrixAt(i, m);
		});
		const attr = shotGeo.getAttribute("position");
		const arr = attr.array;
		shots.forEach((s, i) => {
			const o = i * 6;
			arr[o] = s.x;
			arr[o + 1] = s.y;
			arr[o + 2] = s.z;
			arr[o + 3] = s.x2;
			arr[o + 4] = s.y2;
			arr[o + 5] = s.z2;
		});
		attr.needsUpdate = true;
		shotGeo.setDrawRange(0, shots.length * 2);
		const car = cars[playerCar];
		if (!started) {
			const ang = elapsed * .13;
			camera.position.set(Math.sin(ang) * 72, 38, Math.cos(ang) * 72);
			camera.lookAt(0, 2, 0);
			head.intensity = 0;
		} else {
			const yaw = driving ? car.yaw + lookOffset : camYaw;
			const pitch = driving ? lookPitch : camPitch;
			const dist = driving ? 8.6 : 4.8;
			const height = driving ? 3.15 : 1.85;
			const fx = -Math.sin(yaw);
			const fz = -Math.cos(yaw);
			const tx = (driving ? car.x : px) + fx * 1.2;
			const tz = (driving ? car.z : pz) + fz * 1.2;
			const ty = 1.15;
			let cx = tx - fx * dist;
			let cz = tz - fz * dist;
			let cy = ty + height + pitch * (driving ? 1.4 : .4);
			const dx = cx - tx;
			const dy = cy - ty;
			const dz = cz - tz;
			const len = Math.hypot(dx, dy, dz) || 1;
			const hit = trace(tx, ty, tz, dx / len, dy / len, dz / len, len, driving ? playerCar : -1, -1, false);
			if (hit && hit.kind === "world" && hit.t < len - .3) {
				const t = Math.max(.6, hit.t - .4);
				cx = tx + dx / len * t;
				cy = ty + dy / len * t;
				cz = tz + dz / len * t;
			}
			const sx = Math.sin(elapsed * 73) * shake;
			const sy = Math.cos(elapsed * 57) * shake;
			camera.position.set(cx + sx, cy + sy, cz);
			camera.lookAt(tx, 1.3499999999999999, tz);
			if (driving) camera.rotateZ(clamp(-car.lat * .012, -.14, .14));
			camera.fov = 68 + (driving ? Math.min(18, Math.abs(car.speed) * .38 + Math.abs(car.lat) * .85) : 0);
			camera.updateProjectionMatrix();
			if (driving && car.hp > 0) {
				const nfx = -Math.sin(car.yaw);
				const nfz = -Math.cos(car.yaw);
				head.position.set(car.x + nfx * 2.1, .9, car.z + nfz * 2.1);
				head.target.position.set(car.x + nfx * 16, .4, car.z + nfz * 16);
				head.intensity = 14;
			} else head.intensity = 0;
			if (driving) lookOffset *= Math.exp(-2.4 * dtFrame);
			if (driving) lookPitch += (-.1 - lookPitch) * (1 - Math.exp(-1.6 * dtFrame));
		}
		water.position.y = .9 + Math.sin(elapsed * 2) * .03;
		beacon.visible = started && job.active && job.show;
		beacon.position.set(job.bx, 5.2, job.bz);
		beacon.rotation.y = elapsed;
		const showRing = beacon.visible && job.kind !== "shake" && !(job.kind === "deliver" && !job.flag);
		ring.visible = showRing;
		if (showRing) ring.position.set(job.kind === "deliver" ? job.x : job.bx, .18, job.kind === "deliver" ? job.z : job.bz);
		const showHeli = started && wanted >= 5;
		beam.visible = showHeli;
		heliSpot.intensity = showHeli ? lit ? 26 : 7 : 0;
		if (showHeli) {
			const txh = seenX;
			const tzh = seenZ;
			heliX += (txh - heliX) * (1 - Math.exp(-2.4 * dtFrame));
			heliZ += (tzh - heliZ) * (1 - Math.exp(-2.4 * dtFrame));
			heliSpot.position.set(heliX, 34, heliZ);
			heliSpot.target.position.set(heliX, .2, heliZ);
			beam.position.set(heliX, 16, heliZ);
			const mat = beam.material;
			mat.opacity = lit ? .16 : .05;
		}
		flash.visible = flashT > 0;
		if (flash.visible) flash.position.set(flashX, flashY, flashZ);
		smokeMesh.instanceMatrix.needsUpdate = true;
		let puff = 0;
		for (let i = 0; i < cars.length && puff < 24; i++) {
			const car = cars[i];
			if (car.hp <= 0 || car.hp > car.maxHp * .72) continue;
			const rise = (elapsed * .7 + puff * .37) % 1;
			const s = .35 + rise * 1.3;
			v.set(car.x + Math.sin(elapsed + puff) * .35, 1.1 + rise * 2.4, car.z + Math.cos(elapsed * .8 + puff) * .35);
			scaleBody.set(s, s, s);
			m.compose(v, qid, scaleBody);
			smokeMesh.setMatrixAt(puff, m);
			puff++;
		}
		for (let i = puff; i < 24; i++) {
			m.compose(v.set(0, -20, 0), qid, scale0);
			smokeMesh.setMatrixAt(i, m);
		}
	}
	let dtFrame = 0;
	function drawMini() {
		const ctx = minimap.getContext("2d");
		if (!ctx) return;
		const S = minimap.width;
		ctx.clearRect(0, 0, S, S);
		ctx.fillStyle = "#0c0e13";
		ctx.fillRect(0, 0, S, S);
		const scale = S / 150;
		const me = started ? playerPos() : {
			x: 0,
			z: 0,
			yaw: elapsedYaw(),
			speed: 0
		};
		const yaw = started ? driving ? cars[playerCar].yaw : camYaw : 0;
		const cos = Math.cos(yaw);
		const sin = Math.sin(yaw);
		const project = (x, z) => {
			const dx = x - me.x;
			const dz = z - me.z;
			const rx = dx * cos - dz * sin;
			const rz = dx * sin + dz * cos;
			return {
				x: S / 2 + rx * scale,
				y: S / 2 + rz * scale
			};
		};
		ctx.strokeStyle = "#3a3e48";
		ctx.lineWidth = 4;
		ctx.beginPath();
		for (const x of roadXs) {
			const a = project(x, -125);
			const b = project(x, HALF);
			ctx.moveTo(a.x, a.y);
			ctx.lineTo(b.x, b.y);
		}
		for (const z of roadZs) {
			const a = project(-125, z);
			const b = project(HALF, z);
			ctx.moveTo(a.x, a.y);
			ctx.lineTo(b.x, b.y);
		}
		ctx.stroke();
		ctx.fillStyle = "#23262e";
		for (const b of staticBlocks) {
			const a = project(b.minX, b.minZ);
			const c = project(b.maxX, b.maxZ);
			ctx.fillRect(Math.min(a.x, c.x), Math.min(a.y, c.y), Math.abs(c.x - a.x), Math.abs(c.y - a.y));
		}
		for (const c of cars) {
			if (c.mode === "player") continue;
			const p = project(c.x, c.z);
			ctx.fillStyle = c.police ? "#e23b3b" : "#f3efe4";
			ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
		}
		for (const p of peds) {
			if (!p.active || p.state === "down") continue;
			const pt = project(p.x, p.z);
			ctx.fillStyle = p.faction === "cop" ? "#e23b3b" : p.faction === "amber" ? "#ffb020" : p.faction === "teal" ? "#3ee0c5" : "#8a8478";
			ctx.fillRect(pt.x - 1.4, pt.y - 1.4, 2.8, 2.8);
		}
		ctx.save();
		ctx.translate(S / 2, S / 2);
		ctx.fillStyle = "#ffb020";
		ctx.beginPath();
		ctx.moveTo(0, -7);
		ctx.lineTo(5, 6);
		ctx.lineTo(-5, 6);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
		if (job.active && job.show) {
			const p = project(job.bx, job.bz);
			ctx.fillStyle = "#ffb020";
			ctx.beginPath();
			ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
			ctx.fill();
		}
		const lot = project(LOT.x, LOT.z);
		ctx.strokeStyle = "#ffb020";
		ctx.lineWidth = 2;
		ctx.strokeRect(lot.x - 4, lot.y - 4, 8, 8);
		for (const s of spots) {
			const p = project(s.x, s.z);
			ctx.fillStyle = s.place === "teller" || s.place === "vault" ? "#f3efe4" : s.cool > 0 ? "#e23b3b" : "#ffb020";
			ctx.fillRect(p.x - 2.2, p.y - 2.2, 4.4, 4.4);
		}
	}
	function elapsedYaw() {
		return 0;
	}
	const composer = new EffectComposer(renderer);
	const renderPass = new RenderPass(scene, camera);
	composer.addPass(renderPass);
	const bloomPass = new UnrealBloomPass(new Vector2(512, 512), .42, .55, .58);
	composer.addPass(bloomPass);
	composer.addPass(new OutputPass());
	function resize() {
		const w = canvas.clientWidth || window.innerWidth || 1;
		const h = canvas.clientHeight || window.innerHeight || 1;
		renderer.setSize(w, h, false);
		composer.setSize(w, h);
		const dpr = renderer.getPixelRatio();
		bloomPass.resolution.set(Math.max(1, Math.floor(w * dpr * .55)), Math.max(1, Math.floor(h * dpr * .55)));
		camera.aspect = w / Math.max(1, h);
		camera.updateProjectionMatrix();
	}
	function respawn() {
		alive = true;
		phase = started ? "play" : "menu";
		health = 100;
		armor = 20;
		wanted = 0;
		invuln = 2.4;
		driving = false;
		if (hold.house) {
			const home = spots.find((s) => s.id === "home1");
			px = home ? home.x : 14;
			pz = home ? home.z + 2 : -8;
		} else {
			px = 14;
			pz = -8;
		}
		vx = 0;
		vz = 0;
		camYaw = Math.PI;
		camPitch = -.05;
		const safe = resolveCircle(px, pz, .45);
		px = safe.x;
		pz = safe.z;
		say("Back on the block", 1.8);
		pushHud();
	}
	function start() {
		if (started) return;
		started = true;
		phase = "play";
		alive = true;
		driving = true;
		const car = cars[playerCar];
		car.mode = "player";
		car.x = playerStart.x;
		car.z = playerStart.z;
		car.yaw = 0;
		car.speed = 0;
		lookOffset = 0;
		lookPitch = -.08;
		audio.ensure();
		say("She's hot. Don't stop.");
		pushHud();
	}
	const onKeyDown = (e) => {
		if (e.repeat) keys.add(e.code);
		else keys.add(e.code);
		if ([
			"Space",
			"ArrowUp",
			"ArrowDown",
			"ArrowLeft",
			"ArrowRight"
		].includes(e.code)) e.preventDefault();
	};
	const onKeyUp = (e) => {
		keys.delete(e.code);
	};
	const onBlur = () => {
		keys.clear();
		mouseFire = false;
	};
	const onVis = () => {
		if (document.hidden) keys.clear();
	};
	const onMouseDown = (e) => {
		if (e.button !== 0) return;
		if (!started) return;
		mouseFire = true;
	};
	const onMouseUp = () => {
		mouseFire = false;
	};
	const onClick = () => {
		if (!started || phase !== "play") return;
		if (matchMedia("(pointer: coarse)").matches) return;
		canvas.requestPointerLock?.();
	};
	const onMove = (e) => {
		if (document.pointerLockElement !== canvas) return;
		const sens = .0022;
		if (driving) {
			lookOffset -= e.movementX * sens;
			lookPitch -= e.movementY * sens;
			lookOffset = clamp(lookOffset, -1.2, 1.2);
			lookPitch = clamp(lookPitch, -.65, .45);
		} else {
			camYaw -= e.movementX * sens;
			camPitch -= e.movementY * sens;
			camPitch = clamp(camPitch, -.95, 1.05);
		}
	};
	window.addEventListener("keydown", onKeyDown);
	window.addEventListener("keyup", onKeyUp);
	window.addEventListener("blur", onBlur);
	document.addEventListener("visibilitychange", onVis);
	canvas.addEventListener("pointerdown", onMouseDown);
	window.addEventListener("pointerup", onMouseUp);
	canvas.addEventListener("click", onClick);
	document.addEventListener("mousemove", onMove);
	canvas.addEventListener("contextmenu", (e) => e.preventDefault());
	const ro = new ResizeObserver(() => resize());
	ro.observe(canvas);
	resize();
	window.__controlsTest = {
		getYaw: () => driving ? cars[playerCar].yaw : camYaw,
		getSpeed: () => {
			if (!started) return 0;
			if (driving) return cars[playerCar].speed;
			return Math.hypot(vx, vz);
		},
		setKeys: (codes) => {
			injected.clear();
			steerOverride = null;
			for (const code of codes) injected.add(code);
		},
		setSteer: (v) => {
			steerOverride = v;
		}
	};
	window.__viceroy = {
		snap: () => ({
			driving,
			speed: driving ? cars[playerCar].speed : Math.hypot(vx, vz),
			yaw: driving ? cars[playerCar].yaw : camYaw,
			wanted,
			health,
			cash,
			bank: bankBal,
			loot,
			x: driving ? cars[playerCar].x : px,
			z: driving ? cars[playerCar].z : pz,
			down: peds.filter((p) => p.state === "down").length,
			alive: peds.filter((p) => p.active && p.state !== "down").length,
			phase,
			job: job.active ? `${job.kind}:${Math.ceil(job.t)}` : `wait:${job.cool.toFixed(1)}:${job.next}`,
			idle: cars.filter((c) => (c.mode === "idle" || c.mode === "coast") && c.hp >= 60 && !c.forSale && !c.police).length
		}),
		exit: () => {
			if (driving) tryUse();
		},
		enter: () => {
			if (!driving) tryUse();
		},
		fire: () => playerShoot(true),
		dummy: () => {
			eye();
			const flatYaw = driving ? cars[playerCar].yaw : camYaw;
			const fx = -Math.sin(flatYaw);
			const fz = -Math.cos(flatYaw);
			const ped = peds.find((p) => p.faction === "teal");
			ped.active = true;
			ped.state = "walk";
			ped.hp = 100;
			ped.x = (driving ? cars[playerCar].x : px) + fx * 7;
			ped.z = (driving ? cars[playerCar].z : pz) + fz * 7;
			if (driving) {
				lookOffset = 0;
				lookPitch = 0;
			} else camPitch = 0;
		},
		books: () => ({
			cash: Math.floor(cash),
			bank: Math.floor(bankBal),
			loot: Math.floor(loot)
		}),
		goto: (id) => {
			const s = spots.find((sp) => sp.id === id);
			if (!s) return false;
			if (driving) tryUse();
			driving = false;
			const car = cars[playerCar];
			if (car && car.mode === "player") car.mode = "idle";
			px = s.x;
			pz = s.z + 1.6;
			const safe = resolveCircle(px, pz, .45);
			px = safe.x;
			pz = safe.z;
			vx = 0;
			vz = 0;
			return true;
		},
		pump: () => {
			if (!channel) return false;
			channel.left = 0;
			return true;
		},
		buy: (id) => buySpend(id),
		hold: () => ({
			tunes: hold.tunes,
			house: hold.house,
			lux: hold.lux,
			biz: hold.biz,
			packs: hold.packs,
			invite: hold.invite,
			crew: Math.ceil(hold.crewT),
			tape: tapeValue()
		}),
		pad: (n) => {
			cash = Math.max(0, Math.floor(cash + n));
			noteWorth();
			return Math.floor(cash);
		}
	};
	let acc = 0;
	const loop = () => {
		if (disposed) return;
		raf = requestAnimationFrame(loop);
		timer.update();
		dtFrame = Math.min(timer.getDelta(), .05);
		acc += dtFrame;
		const stepDt = 1 / 60;
		let guard = 0;
		while (acc >= stepDt && guard < 4) {
			step(stepDt);
			acc -= stepDt;
			guard++;
		}
		if (guard === 4) acc = 0;
		syncWorld(timer.getElapsed());
		drawMini();
		composer.render();
		hudAcc += dtFrame;
		if (hudAcc > .12) {
			hudAcc = 0;
			pushHud();
		}
	};
	noteWorth();
	pushHud();
	raf = requestAnimationFrame(loop);
	return {
		touch,
		start,
		respawn,
		dispose() {
			disposed = true;
			cancelAnimationFrame(raf);
			timer.disconnect();
			ro.disconnect();
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			window.removeEventListener("blur", onBlur);
			document.removeEventListener("visibilitychange", onVis);
			canvas.removeEventListener("pointerdown", onMouseDown);
			window.removeEventListener("pointerup", onMouseUp);
			canvas.removeEventListener("click", onClick);
			document.removeEventListener("mousemove", onMove);
			if (audio.ctx) audio.ctx.close();
			composer.dispose();
			renderer.dispose();
			if (window.__controlsTest) delete window.__controlsTest;
			if (window.__viceroy) delete window.__viceroy;
		}
	};
}
//#endregion
export { createGame };
