import { useEffect, useRef, useState } from "react";
import type { CarBody } from "@/game/property";

const thumbs = new Map<string, string>();

type StageProps = {
  body: CarBody;
  bodies: CarBody[];
  onThumbs: (shots: Record<string, string>) => void;
};

/**
 * Studio canvas for the car catalog only. It does not add lights to the city.
 * Stills of each Cosmo body fill the grid. The selected body stays on the stage.
 */
export function CarStage({ body, bodies, onThumbs }: StageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bodyRef = useRef(body);
  const thumbsRef = useRef(onThumbs);
  bodyRef.current = body;
  thumbsRef.current = onThumbs;
  const [status, setStatus] = useState("Rolling the body out");
  const lineup = bodies.join(",");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dead = false;
    let raf = 0;
    let dispose = () => {};
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const names = lineup.split(",").filter(Boolean);

    void (async () => {
      const THREE = await import("three/webgpu");
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      if (dead) return;
      const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 40);
      camera.position.set(2.7, 1.2, 3.5);
      camera.lookAt(0, 0.42, 0);
      scene.add(new THREE.HemisphereLight(0xf3efe4, 0x1a140e, 1.2));
      const key = new THREE.DirectionalLight(0xfff4e4, 2.5);
      key.position.set(4, 6, 3);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0x8eb4d4, 0.4);
      fill.position.set(-4, 2, -2);
      scene.add(fill);
      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(2.6, 48),
        new THREE.MeshStandardMaterial({ color: 0x14171f, roughness: 0.94 }),
      );
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);
      const root = new THREE.Group();
      scene.add(root);
      const loader = new GLTFLoader();

      const resize = () => {
        const w = Math.max(1, canvas.clientWidth || 640);
        const h = Math.max(1, canvas.clientHeight || 360);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);
      dispose = () => {
        ro.disconnect();
        renderer.dispose();
      };

      const fit = (model: import("three/webgpu").Object3D) => {
        while (root.children.length) root.remove(root.children[0]!);
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const wrap = new THREE.Group();
        model.position.set(-center.x, -center.y, -center.z);
        wrap.add(model);
        const scale = 3.15 / Math.max(size.x, size.z, 0.001);
        wrap.scale.setScalar(scale);
        wrap.position.y = (size.y * scale) / 2;
        root.add(wrap);
        root.rotation.y = 0.6;
      };

      let ticket = 0;
      const place = async (name: string, token: number) => {
        const gltf = await loader.loadAsync(`/vendor/cosmo/low-poly-cars/${name}.glb`);
        if (dead || token !== ticket) return false;
        fit(gltf.scene);
        return true;
      };

      try {
        await renderer.init();
      } catch {
        if (!dead) setStatus("The stage didn't start");
        return;
      }
      if (dead) {
        dispose();
        return;
      }

      for (const name of names) {
        if (thumbs.has(name)) continue;
        ticket += 1;
        const token = ticket;
        const ok = await place(name, token);
        if (!ok || dead) break;
        renderer.render(scene, camera);
        try {
          const url = canvas.toDataURL("image/png");
          if (url.length > 64) thumbs.set(name, url);
        } catch {
          /* a blank still just leaves the name on the card */
        }
      }
      if (!dead) thumbsRef.current(Object.fromEntries(thumbs));

      let shown = "";
      const loop = () => {
        if (dead) return;
        const wanted = bodyRef.current;
        if (shown !== wanted) {
          shown = wanted;
          ticket += 1;
          const token = ticket;
          void place(wanted, token).then((ok) => {
            if (ok && !dead) setStatus("");
          });
        }
        if (!reduced) root.rotation.y += 0.007;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(loop);
      };
      loop();
    })();

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      dispose();
    };
  }, [lineup]);

  return (
    <div className="relative min-h-56 bg-surface sm:min-h-80">
      <canvas ref={canvasRef} className="h-full min-h-56 w-full sm:min-h-80" aria-label={`${body} preview`} />
      {status ? <p className="absolute bottom-3 left-3 text-xs tracking-widest text-muted">{status}</p> : null}
    </div>
  );
}
