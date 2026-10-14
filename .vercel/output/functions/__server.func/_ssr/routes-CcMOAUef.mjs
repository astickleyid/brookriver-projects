import { i as __toESM } from "../_runtime.mjs";
import { G as require_jsx_runtime, K as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as Star } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CcMOAUef.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var UNIT = 48;
function clamp(v, a, b) {
	return Math.max(a, Math.min(b, v));
}
function rate(n) {
	return clamp(n, 0, 5);
}
function starsFor(heat) {
	if (heat <= 0) return 0;
	if (heat <= 2) return 1;
	return Math.min(5, heat - 1);
}
function scoreHustle(def) {
	const earn = rate(def.earn);
	const heat = rate(def.heat);
	const danger = rate(def.danger);
	const stake = rate(def.stake);
	const premium = 1 + .22 * heat + .18 * danger + .1 * stake;
	const gross = earn <= 0 ? 0 : Math.round(UNIT * Math.pow(earn, 1.62) * premium);
	const spread = clamp(.1 + .08 * stake + .025 * danger, .1, .7);
	const low = Math.max(0, Math.round(gross * (1 - spread)));
	const high = Math.max(low, Math.round(gross * (1 + spread)));
	const seconds = Math.round((1.8 + earn * .85 + heat * .4 + danger * .2) * 10) / 10;
	const stars = starsFor(heat);
	const bustStars = heat <= 0 ? 0 : Math.min(5, stars + (heat >= 3 ? 1 : 0) + (heat >= 5 ? 1 : 0));
	const hurt = danger <= 0 ? 0 : Math.round(4 * Math.pow(danger, 1.2));
	const bustHurt = danger <= 0 ? 0 : Math.round(hurt * 1.85 + danger * 4);
	const fail = clamp(.04 + .07 * danger + .045 * heat + .025 * stake, .04, .78);
	const stakeCash = stake <= 0 ? 0 : Math.round(UNIT * Math.pow(stake, 1.35));
	return {
		gross,
		low,
		high,
		seconds,
		stars,
		hurt,
		fail,
		bustStars,
		bustHurt,
		stakeCash,
		cooldown: Math.round(10 + heat * 9 + earn * 4),
		fenceCut: clamp(.4 + .08 * earn - .04 * heat, .28, .84),
		winChance: clamp(.62 - .07 * stake, .18, .62),
		winPay: stakeCash <= 0 ? 0 : Math.round(stakeCash * (1.5 + .22 * earn))
	};
}
function resolveHustle(def, rng, lootOnHand, hostile = false) {
	const s = scoreHustle(def);
	if (def.kind === "fence") {
		if (lootOnHand <= 0) return {
			ok: false,
			wallet: 0,
			loot: 0,
			clearLoot: false,
			stars: 0,
			hurt: 0,
			line: "Nothing to pawn"
		};
		if (hostile || rng() < s.fail) return {
			ok: false,
			wallet: 0,
			loot: 0,
			clearLoot: true,
			stars: s.bustStars,
			hurt: s.bustHurt,
			line: "Fence got hit. Goods gone."
		};
		const pay = Math.round(lootOnHand * s.fenceCut);
		return {
			ok: true,
			wallet: pay,
			loot: 0,
			clearLoot: true,
			stars: s.stars,
			hurt: s.hurt,
			line: `Pawned $${pay}`
		};
	}
	if (def.kind === "wager") {
		const win = !hostile && rng() < s.winChance;
		const incident = hostile || rng() < s.fail;
		const stolen = incident && rate(def.danger) >= 4;
		const wallet = win && !stolen ? s.winPay : 0;
		const net = wallet - s.stakeCash;
		return {
			ok: wallet > 0,
			wallet,
			loot: 0,
			clearLoot: false,
			stars: incident ? s.bustStars : 0,
			hurt: incident ? s.bustHurt : Math.round(s.hurt * .35),
			line: wallet > 0 ? `Up $${net}` : `Down $${s.stakeCash}`
		};
	}
	if (hostile || rng() < s.fail) return {
		ok: false,
		wallet: 0,
		loot: 0,
		clearLoot: false,
		stars: hostile ? Math.min(5, s.bustStars + 1) : s.bustStars,
		hurt: s.bustHurt,
		line: hostile ? "They came up shooting" : s.stakeCash > 0 ? "Blown. Stake's gone." : "Blown"
	};
	const span = s.high - s.low;
	const payout = s.low + (span > 0 ? Math.floor(rng() * (span + 1)) : 0);
	let wallet = 0;
	let loot = 0;
	if (def.yield === "cash") wallet = payout;
	else if (def.yield === "goods") loot = payout;
	else {
		wallet = Math.round(payout * .42);
		loot = Math.max(0, payout - wallet);
	}
	const bit = loot > 0 && wallet > 0 ? `$${wallet} + $${loot} goods` : loot > 0 ? `$${loot} in goods` : `$${wallet}`;
	return {
		ok: true,
		wallet,
		loot,
		clearLoot: false,
		stars: s.stars,
		hurt: s.hurt,
		line: `${def.name} · ${bit}`
	};
}
function blurb(def) {
	const s = scoreHustle(def);
	if (def.kind === "fence") return `${def.name} ${Math.round(s.fenceCut * 100)}%`;
	if (def.kind === "wager") return `${def.name} $${s.stakeCash}→$${s.winPay}`;
	const stake = s.stakeCash > 0 ? ` · stake $${s.stakeCash}` : "";
	return `${def.name} ~$${s.gross}${stake}`;
}
function ledgerLines() {
	return HUSTLES.map((def) => {
		const s = scoreHustle(def);
		const pay = def.kind === "wager" ? `$${s.stakeCash}→$${s.winPay}` : def.kind === "fence" ? `${Math.round(s.fenceCut * 100)}%` : `~$${s.gross.toLocaleString("en-US")}`;
		return {
			id: def.id,
			name: def.name,
			pay,
			risk: `${def.heat}/${def.danger}/${def.stake}`
		};
	});
}
var HUSTLES = [
	{
		id: "mug",
		name: "Rob civilian",
		kind: "take",
		place: "civ",
		yield: "mixed",
		earn: 1,
		heat: 2,
		danger: 2,
		stake: 0
	},
	{
		id: "home",
		name: "Break in",
		kind: "take",
		place: "home",
		yield: "goods",
		earn: 2,
		heat: 2,
		danger: 2,
		stake: 0
	},
	{
		id: "store",
		name: "Rob store",
		kind: "take",
		place: "store",
		yield: "mixed",
		earn: 3,
		heat: 3,
		danger: 3,
		stake: 0
	},
	{
		id: "vault",
		name: "Rob bank",
		kind: "take",
		place: "vault",
		yield: "cash",
		earn: 5,
		heat: 5,
		danger: 4,
		stake: 1
	},
	{
		id: "roller",
		name: "Roll a whale",
		kind: "take",
		place: "roller",
		yield: "mixed",
		earn: 4,
		heat: 3,
		danger: 4,
		stake: 1
	},
	{
		id: "deal",
		name: "Sell a pack",
		kind: "take",
		place: "corner",
		yield: "cash",
		earn: 3,
		heat: 3,
		danger: 2,
		stake: 3
	},
	{
		id: "pawn",
		name: "Pawn goods",
		kind: "fence",
		place: "pawn",
		yield: "cash",
		earn: 2,
		heat: 1,
		danger: 1,
		stake: 0
	},
	{
		id: "dice",
		name: "Street dice",
		kind: "wager",
		place: "casino",
		yield: "cash",
		earn: 2,
		heat: 1,
		danger: 2,
		stake: 1
	},
	{
		id: "table",
		name: "High-limit",
		kind: "wager",
		place: "casino",
		yield: "cash",
		earn: 4,
		heat: 2,
		danger: 1,
		stake: 4
	},
	{
		id: "private",
		name: "Private work",
		kind: "take",
		place: "roller",
		yield: "cash",
		earn: 5,
		heat: 2,
		danger: 2,
		stake: 2
	}
];
function hustleById(id) {
	return HUSTLES.find((h) => h.id === id);
}
function hustlesAt(place) {
	return HUSTLES.filter((h) => h.place === place);
}
function scoreSpend(def, owned = 0) {
	const price = rate(def.price);
	const power = rate(def.power);
	const heat = rate(def.heat);
	const upkeep = rate(def.upkeep);
	const stack = 1 + Math.max(0, owned) * .55;
	const premium = 1 + .18 * power + .08 * heat + .05 * upkeep;
	return {
		cost: price <= 0 ? 0 : Math.round(UNIT * 2.4 * Math.pow(price, 1.75) * premium * stack),
		stars: heat <= 0 ? 0 : heat <= 2 ? 1 : Math.min(5, heat - 1),
		seconds: Math.round((8 + power * 6 + price * 2) * 10) / 10,
		income: power <= 0 ? 0 : Math.round(UNIT * .22 * Math.pow(power, 1.4)),
		upkeepCash: upkeep <= 0 ? 0 : Math.round(UNIT * .035 * Math.pow(upkeep, 1.35)),
		power
	};
}
function spendBlurb(def, owned = 0) {
	const s = scoreSpend(def, owned);
	return `${def.name} $${s.cost.toLocaleString("en-US")}`;
}
var SPENDS = [
	{
		id: "ammo",
		name: "Buy ammo",
		kind: "ammo",
		price: 1,
		power: 2,
		heat: 0,
		upkeep: 0
	},
	{
		id: "vest",
		name: "Buy a vest",
		kind: "armor",
		price: 1,
		power: 2,
		heat: 0,
		upkeep: 0
	},
	{
		id: "tune",
		name: "Tune the ride",
		kind: "tune",
		price: 2,
		power: 3,
		heat: 0,
		upkeep: 0
	},
	{
		id: "van",
		name: "Buy a van",
		kind: "ride",
		price: 2,
		power: 2,
		heat: 0,
		upkeep: 1
	},
	{
		id: "bribe",
		name: "Bribe a badge",
		kind: "bribe",
		price: 2,
		power: 3,
		heat: 2,
		upkeep: 0
	},
	{
		id: "crew",
		name: "Hire a gun",
		kind: "crew",
		price: 2,
		power: 3,
		heat: 2,
		upkeep: 1
	},
	{
		id: "drugs",
		name: "Buy a brick",
		kind: "drug",
		price: 2,
		power: 3,
		heat: 2,
		upkeep: 1
	},
	{
		id: "shotgun",
		name: "Buy shotgun",
		kind: "gun",
		price: 2,
		power: 3,
		heat: 1,
		upkeep: 0
	},
	{
		id: "sport",
		name: "Buy a sport",
		kind: "ride",
		price: 3,
		power: 4,
		heat: 0,
		upkeep: 1
	},
	{
		id: "smg",
		name: "Buy an SMG",
		kind: "gun",
		price: 3,
		power: 4,
		heat: 2,
		upkeep: 0
	},
	{
		id: "market",
		name: "Buy the tape",
		kind: "market",
		price: 3,
		power: 3,
		heat: 0,
		upkeep: 3
	},
	{
		id: "hit",
		name: "Order a hit",
		kind: "hit",
		price: 3,
		power: 4,
		heat: 3,
		upkeep: 0
	},
	{
		id: "invite",
		name: "Buy the invite",
		kind: "invite",
		price: 3,
		power: 2,
		heat: 1,
		upkeep: 0
	},
	{
		id: "luxury",
		name: "Buy the watch",
		kind: "luxury",
		price: 4,
		power: 3,
		heat: 0,
		upkeep: 1
	},
	{
		id: "business",
		name: "Open a shop",
		kind: "business",
		price: 4,
		power: 4,
		heat: 1,
		upkeep: 3
	},
	{
		id: "house",
		name: "Buy the house",
		kind: "house",
		price: 5,
		power: 4,
		heat: 0,
		upkeep: 2
	}
];
function spendById(id) {
	return SPENDS.find((s) => s.id === id);
}
var LEDGER = ledgerLines();
var EMPTY = {
	phase: "menu",
	health: 100,
	armor: 30,
	wanted: 0,
	cash: 0,
	bank: 0,
	loot: 0,
	best: 0,
	speedMph: 0,
	driving: true,
	toast: "",
	cooling: false,
	looking: false,
	lostCash: 0,
	error: "",
	gun: "PISTOL",
	ammo: "12/72",
	job: "",
	radio: "NIGHTLINE",
	shop: "",
	nearShop: false,
	drifting: false,
	cover: false,
	hustle: "",
	hustlePct: 0,
	nearWork: false,
	nearTeller: false,
	assets: ""
};
function makeTouch() {
	return {
		x: 0,
		y: 0,
		lookX: 0,
		lookY: 0,
		fire: false,
		sprint: false,
		useQueued: false,
		reloadQueued: false,
		cycleGunQueued: false,
		radioQueued: false,
		hustleQueued: false,
		bankQueued: false,
		buy: ""
	};
}
function ViceroyApp() {
	const canvasRef = (0, import_react.useRef)(null);
	const miniRef = (0, import_react.useRef)(null);
	const gameRef = (0, import_react.useRef)(null);
	const touchRef = (0, import_react.useRef)(makeTouch());
	const pendingStart = (0, import_react.useRef)(false);
	const [hud, setHud] = (0, import_react.useState)(EMPTY);
	const [touchUi, setTouchUi] = (0, import_react.useState)(false);
	const [booted, setBooted] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		const mini = miniRef.current;
		if (!canvas || !mini) return;
		let handle = null;
		let dead = false;
		import("./create-game-jnL2WnEe.mjs").then(({ createGame }) => {
			if (dead) return;
			handle = createGame(canvas, mini, touchRef.current, setHud);
			gameRef.current = handle;
			setBooted(true);
			if (pendingStart.current) handle.start();
		});
		return () => {
			dead = true;
			handle?.dispose();
			gameRef.current = null;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		const query = () => {
			const coarse = window.matchMedia("(pointer: coarse)").matches;
			setTouchUi(coarse || window.innerWidth < 900);
		};
		query();
		window.addEventListener("resize", query);
		return () => window.removeEventListener("resize", query);
	}, []);
	const start = () => {
		if (gameRef.current) gameRef.current.start();
		else pendingStart.current = true;
	};
	const phase = hud.phase;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "fixed inset-0 overflow-hidden bg-bg font-sans text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
				ref: canvasRef,
				className: "absolute inset-0 h-full w-full touch-none",
				"aria-label": "Viceroy city"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
				ref: miniRef,
				width: 256,
				height: 256,
				className: `pointer-events-none absolute top-36 right-3 z-10 h-20 w-20 mini-frame bg-bg sm:top-40 sm:h-32 sm:w-32 ${phase === "play" ? "" : "hidden"}`
			}),
			phase === "play" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `pointer-events-none absolute inset-0 z-10 night-grade ${hud.wanted > 0 ? "heat-vignette" : ""}`,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start justify-between gap-3 p-3 sm:p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "hud-chip w-28 px-2 py-1.5 sm:w-52",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
										label: "Health",
										value: hud.health,
										tone: "blood"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
										label: "Armor",
										value: hud.armor,
										tone: "paper"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-1 font-display text-2xl leading-none tracking-wide text-fg",
										children: hud.gun
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs tracking-widest text-muted",
										children: hud.ammo
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col items-center gap-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex gap-1",
										children: Array.from({ length: 5 }, (_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Star, {
											className: `h-4 w-4 sm:h-5 sm:w-5 ${i < hud.wanted ? "fill-amber text-amber" : "text-line"}`,
											strokeWidth: 1.75
										}, i))
									}),
									touchUi && hud.driving ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: `font-display text-2xl leading-none ${hud.drifting ? "text-amber" : "text-fg"}`,
										children: [hud.speedMph, " MPH"]
									}) : null,
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "font-display text-lg leading-none tracking-widest text-muted",
										children: hud.cover ? "OFF THE LIGHT" : hud.cooling ? "LOSING THEM" : hud.wanted > 0 ? "WANTED" : "QUIET"
									}),
									hud.job ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "max-w-48 text-center text-xs text-amber",
										children: hud.job
									}) : null,
									hud.hustle ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "max-w-48 sm:max-w-xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-center text-xs text-fg",
											children: hud.hustle
										}), hud.hustlePct > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "mt-1 h-1 bg-line",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "h-full bg-amber",
												style: { width: `${Math.round(hud.hustlePct * 100)}%` }
											})
										}) : null]
									}) : null
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "hud-chip w-24 px-2 py-1.5 text-right sm:w-44",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "font-display text-3xl leading-none text-amber sm:text-4xl",
										children: ["$", hud.cash.toLocaleString("en-US")]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs tracking-widest text-muted",
										children: "Wallet"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-sm leading-tight text-fg",
										children: ["Bank $", hud.bank.toLocaleString("en-US")]
									}),
									hud.loot > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-xs text-amber",
										children: ["Goods $", hud.loot.toLocaleString("en-US")]
									}) : null,
									hud.assets ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs leading-tight text-muted",
										children: hud.assets
									}) : null
								]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "absolute top-1/2 left-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute top-1/2 left-0 h-px w-1.5 bg-fg/90" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute top-1/2 right-0 h-px w-1.5 bg-fg/90" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute top-0 left-1/2 h-1.5 w-px bg-fg/90" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute bottom-0 left-1/2 h-1.5 w-px bg-fg/90" })
						]
					}),
					hud.toast ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "hud-chip absolute bottom-28 left-1/2 max-w-sm -translate-x-1/2 px-3 py-1 text-center text-sm text-fg",
						children: hud.toast
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1",
						children: [
							!touchUi && hud.driving ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: `font-display text-4xl leading-none ${hud.drifting ? "text-amber" : "text-fg"}`,
								children: [hud.speedMph, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ml-1 text-lg text-muted",
									children: "MPH"
								})]
							}) : null,
							hud.shop ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "max-w-md text-center text-xs text-amber",
								children: hud.shop
							}) : null,
							!touchUi ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-center text-xs text-muted",
								children: [hud.driving ? "W throttle · A left · D right · Shift drift · F exit · J work · K bank · 1 2 3 guns" : "WASD move · mouse look · Shift sprint · F jack · J work · K bank · 1 2 3 guns", !hud.looking && !hud.driving ? " · click to look" : ""]
							}) : null
						]
					})
				]
			}) : null,
			phase === "menu" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "scrim-bottom absolute inset-0 z-20 flex flex-col justify-end p-4 safe-b sm:p-8",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "max-w-xl border-l-2 border-amber pl-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs tracking-widest text-amber",
							children: "WARD 04 · NIGHT OPEN"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "font-display text-6xl leading-none text-fg sm:text-8xl",
							children: "VICEROY"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 max-w-md text-sm text-muted sm:text-lg",
							children: "The wallet is what the street can take. The bank keeps the rest. The plaza fixer sells the city off the same scale."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-3 hidden max-w-md grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted sm:grid",
							children: LEDGER.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex items-baseline justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
									row.name,
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-fg",
										children: row.risk
									})
								] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-amber",
									children: row.pay
								})]
							}, row.id))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-3 max-w-sm text-xs text-muted sm:hidden",
							children: [LEDGER.map((row) => `${row.name} ${row.pay}`).join(" · "), ". Plaza fixer takes the big checks."]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 flex flex-wrap items-center gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: start,
								className: "min-h-12 bg-amber px-8 font-display text-3xl leading-none tracking-wide text-bg",
								children: "Start"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-muted",
								children: booted ? "Night is live." : "Wiring the blocks…"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-4 text-sm text-muted",
							children: touchUi ? "Left stick drives. Work shows up on a mark, a door, the bank, or the plaza fixer." : "You start with $40. A turns left. White post is the bank. Plaza fixer sells rides, guns, and the house."
						}),
						hud.bank > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 text-sm text-fg",
							children: ["Bank $", hud.bank.toLocaleString("en-US")]
						}) : null,
						hud.best > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 text-sm text-amber",
							children: ["Best net $", hud.best.toLocaleString("en-US")]
						}) : null,
						hud.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-sm text-blood",
							children: hud.error
						}) : null
					]
				})
			}) : null,
			phase === "dead" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 z-20 flex flex-col items-start justify-end bg-bg/80 p-4 safe-b sm:p-8",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "border-l-2 border-blood pl-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs tracking-widest text-blood",
							children: "FLATLINED"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-7xl leading-none text-fg sm:text-8xl",
							children: "WASTED"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 text-muted",
							children: [
								"Hospital took $",
								hud.lostCash.toLocaleString("en-US"),
								" off the wallet.",
								hud.bank > 0 ? ` The bank still holds $${hud.bank.toLocaleString("en-US")}.` : " Nothing was in the bank."
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => gameRef.current?.respawn(),
							className: "mt-4 min-h-12 bg-fg px-6 font-display text-3xl leading-none text-bg",
							children: "Get up"
						})
					]
				})
			}) : null,
			phase === "play" && touchUi && hud.nearShop ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute top-40 left-3 z-20 flex flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TouchButton, {
						label: "Bail",
						onDown: () => {
							touchRef.current.buy = "bail";
						},
						onUp: () => {}
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TouchButton, {
						label: "Vest",
						onDown: () => {
							touchRef.current.buy = "vest";
						},
						onUp: () => {}
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TouchButton, {
						label: "Shot",
						onDown: () => {
							touchRef.current.buy = "shotgun";
						},
						onUp: () => {}
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TouchButton, {
						label: "Sport",
						onDown: () => {
							touchRef.current.buy = "sport";
						},
						onUp: () => {}
					})
				]
			}) : null,
			phase === "play" && touchUi ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute inset-x-0 bottom-0 z-20 flex items-end justify-between p-3 safe-b",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stick, {
						label: "Move",
						onChange: (x, y) => {
							touchRef.current.x = x;
							touchRef.current.y = y;
						}
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-2 flex flex-col gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TouchButton, {
								label: "Fire",
								onDown: () => {
									touchRef.current.fire = true;
								},
								onUp: () => {
									touchRef.current.fire = false;
								}
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TouchButton, {
								label: "Jack",
								onDown: () => {
									touchRef.current.useQueued = true;
								},
								onUp: () => {}
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TouchButton, {
								label: hud.driving ? "Drift" : "Sprint",
								onDown: () => {
									touchRef.current.sprint = true;
								},
								onUp: () => {
									touchRef.current.sprint = false;
								}
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TouchButton, {
								label: "Gun",
								onDown: () => {
									touchRef.current.cycleGunQueued = true;
								},
								onUp: () => {}
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TouchButton, {
								label: "Tune",
								onDown: () => {
									touchRef.current.radioQueued = true;
								},
								onUp: () => {}
							}),
							hud.nearWork ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TouchButton, {
								label: hud.nearTeller ? "Deposit" : "Work",
								onDown: () => {
									touchRef.current.hustleQueued = true;
								},
								onUp: () => {}
							}) : null,
							hud.nearTeller || hud.nearWork && hud.hustle.includes("swap") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TouchButton, {
								label: hud.nearTeller ? "Draw" : "Swap",
								onDown: () => {
									touchRef.current.bankQueued = true;
								},
								onUp: () => {}
							}) : null
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LookPad, { onDelta: (dx, dy) => {
						touchRef.current.lookX += dx;
						touchRef.current.lookY += dy;
					} })
				]
			}) : null
		]
	});
}
function Bar({ label, value, tone }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mb-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-1 flex justify-between text-xs text-muted",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: Math.round(value) })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "h-1.5 bg-line",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: `h-full ${tone === "blood" ? "bg-blood" : "bg-fg"}`,
				style: { width: `${clampPct(value)}%` }
			})
		})]
	});
}
function clampPct(n) {
	return Math.max(0, Math.min(100, n));
}
function Stick({ label, onChange }) {
	const origin = (0, import_react.useRef)(null);
	const [knob, setKnob] = (0, import_react.useState)({
		x: 0,
		y: 0
	});
	const end = () => {
		origin.current = null;
		setKnob({
			x: 0,
			y: 0
		});
		onChange(0, 0);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		role: "application",
		"aria-label": label,
		className: "relative h-28 w-28 touch-none rounded-full border border-line bg-surface/80",
		onPointerDown: (e) => {
			e.currentTarget.setPointerCapture(e.pointerId);
			origin.current = {
				x: e.clientX,
				y: e.clientY
			};
		},
		onPointerMove: (e) => {
			if (!origin.current) return;
			const dx = e.clientX - origin.current.x;
			const dy = e.clientY - origin.current.y;
			const max = 44;
			const mag = Math.hypot(dx, dy) || 1;
			const k = Math.min(max, mag) / mag;
			const x = dx * k / max;
			const y = -(dy * k) / max;
			setKnob({
				x: x * max,
				y: -y * max
			});
			onChange(x, y);
		},
		onPointerUp: end,
		onPointerCancel: end,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "absolute top-1/2 left-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber",
			style: { transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }
		})
	});
}
function LookPad({ onDelta }) {
	const last = (0, import_react.useRef)(null);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		role: "application",
		"aria-label": "Look",
		className: "h-28 w-28 touch-none border border-line bg-surface/50",
		onPointerDown: (e) => {
			e.currentTarget.setPointerCapture(e.pointerId);
			last.current = {
				x: e.clientX,
				y: e.clientY
			};
		},
		onPointerMove: (e) => {
			if (!last.current) return;
			onDelta(e.clientX - last.current.x, e.clientY - last.current.y);
			last.current = {
				x: e.clientX,
				y: e.clientY
			};
		},
		onPointerUp: () => {
			last.current = null;
		},
		onPointerCancel: () => {
			last.current = null;
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "flex h-full items-center justify-center text-xs tracking-wide text-muted",
			children: "LOOK"
		})
	});
}
function TouchButton({ label, onDown, onUp }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		className: "min-h-12 min-w-20 border border-line bg-surface/90 px-3 font-display text-2xl leading-none text-fg",
		onPointerDown: (e) => {
			e.currentTarget.setPointerCapture(e.pointerId);
			onDown();
		},
		onPointerUp: onUp,
		onPointerCancel: onUp,
		children: label
	});
}
var routes_exports = /* @__PURE__ */ __exportAll({ component: () => Home });
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ViceroyApp, {});
}
//#endregion
export { hustlesAt as a, scoreSpend as c, hustleById as i, spendBlurb as l, SPENDS as n, resolveHustle as o, blurb as r, scoreHustle as s, routes_exports as t, spendById as u };
