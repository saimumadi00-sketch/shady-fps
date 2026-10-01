import * as THREE from "three";
import { weaponMesh } from "./weapon-models.js";
import { classes } from "./lobby-data.js";
import { drawCharacter } from "./characters.js";
import { Arena } from "./world.js";

// Arena, squad and weapon canvases share the game's geometry with no remote model dependencies.
export function createLobbyScene(squadCanvas, weaponCanvas) {
  const renderers = [];
  const material = (color, metalness = 0, roughness = 1) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const dark = material(0x15202b),
    joint = material(0x101820, 0.1, 0.85),
    steel = material(0x4a606d);
  const glow = new THREE.MeshStandardMaterial({
    color: 0x80e5fc,
    emissive: 0x28b9e0,
    emissiveIntensity: 2,
  });
  function setup(canvas) {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setClearColor(0, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    scene.add(new THREE.HemisphereLight(0xe8f0e9, 0x526662, 0.8));
    const key = new THREE.DirectionalLight(0xe8f0e9, 1.5);
    key.position.set(-3, 6, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    key.shadow.bias = -0.001;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xa7ead4, 0.25);
    rim.position.set(2, 3, -3);
    scene.add(rim);
    const warm = new THREE.DirectionalLight(0xf29a66, 0.25);
    warm.position.set(5, 2, 2);
    scene.add(warm);
    renderers.push(renderer);
    return { renderer, scene, camera, canvas };
  }
  const squad = setup(squadCanvas),
    preview = setup(weaponCanvas);
  squad.camera.position.set(0, 2.75, 9.4);
  squad.camera.lookAt(0, 1.15, 0);
  preview.camera.position.set(0, 0.2, 1.45);
  preview.camera.lookAt(0, 0, 0);
  function mesh(parent, geometry, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geometry, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function box(parent, x, y, z, w, h, d, mat) {
    return mesh(parent, new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  }
  function gun(config) {
    const data = weaponMesh(
        config.model,
        config.skin,
        config.optic,
        false,
        false,
      ),
      positions = [],
      normals = [],
      colors = [];
    for (let i = 0; i < data.length; i += 9) {
      positions.push(...data.slice(i, i + 3));
      normals.push(...data.slice(i + 3, i + 6));
      colors.push(...data.slice(i + 6, i + 9));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(normals, 3),
    );
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeBoundingBox();
    const center = geometry.boundingBox.getCenter(new THREE.Vector3());
    geometry.translate(-center.x, -center.y, -center.z);
    const group = new THREE.Group();
    const body = mesh(
      group,
      geometry,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        metalness: 0.7,
        roughness: 0.38,
      }),
    );
    body.rotation.y = Math.PI / 2;
    // Barrel extensions remain visible in both the inspection and soldier scenes.
    if (config.barrel !== "standard") {
      const size = config.barrel === "suppressor" ? 0.23 : 0.08;
      const muzzle = mesh(
        group,
        new THREE.CylinderGeometry(0.037, 0.037, size, 12),
        dark,
        0.52,
        0,
        0,
      );
      muzzle.rotation.z = Math.PI / 2;
    }
    if (config.model === 3) group.scale.x = 1.2;
    return group;
  }
  // Reuse the actual arena character builder, including team colors and cubic proportions.
  function soldier(type, config) {
    const root = new THREE.Group(),
      body = new THREE.Group(),
      head = new THREE.Group();
    root.add(body);
    body.add(head);
    root.userData.body = body;
    root.userData.head = head;
    const id = Object.keys(classes).indexOf(type);
    drawCharacter(
      (x, y, z, w, h, d, color, angle) => {
        // Replace only the gameplay placeholder gun with the shared detailed primary mesh.
        if (w === 0.13 && h === 0.13 && d === 0.65) return;
        const mat = new THREE.MeshLambertMaterial({
          color: new THREE.Color(...color),
        });
        const part = box(y > 1.23 ? head : body, x, y, z, w, h, d, mat);
        part.rotation.y = angle;
      },
      {
        id,
        team: 0,
        x: 0,
        y: 0,
        z: 0,
        yaw: Math.PI,
        crouched: false,
        moving: false,
        shield: 0,
      },
      0,
      false,
    );
    const weapon = gun(config);
    weapon.scale.setScalar(0.8);
    weapon.position.set(0, 1.0, 0.35);
    weapon.rotation.z = -0.12;
    body.add(weapon);
    return root;
  }
  // A painted concrete muster pad replaces the orbital display platform.
  box(squad.scene, 0, -0.1, 0, 5.8, 0.18, 3.8, material(0x727e72, 0, 1));
  for (const x of [-2.65, 2.65])
    box(squad.scene, x, 0.001, 0, 0.07, 0.012, 3.4, material(0xa7ead4, 0, 1));
  for (let x = -2.4; x < 2.5; x += 0.45)
    box(
      squad.scene,
      x,
      0.002,
      1.72,
      0.23,
      0.013,
      0.1,
      material(0xcfbf7b, 0, 1),
    );
  // Render the same world boxes as the playable arena behind the interface.
  const yardCanvas = document.createElement("canvas");
  yardCanvas.className = "yard-background";
  yardCanvas.setAttribute("aria-hidden", "true");
  document.querySelector(".lobby").prepend(yardCanvas);
  const yard = setup(yardCanvas);
  yard.scene.background = new THREE.Color(0x91a5a6);
  yard.scene.fog = new THREE.Fog(0x91a5a6, 35, 90);
  yard.camera.position.set(23, 13, 26);
  yard.camera.lookAt(0, 0, 0);
  for (const b of new Arena().boxes)
    box(
      yard.scene,
      b.x,
      b.y,
      b.z,
      b.w,
      b.h,
      b.d,
      new THREE.MeshLambertMaterial({ color: new THREE.Color(...b.color) }),
    );
  const people = [];
  let selected = null,
    inspection = null,
    reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const squadTypes = ["engineer", "support", "recon"];
  [
    [-1.7, 0, -0.4],
    [-0.65, 0, -0.7],
    [1.55, 0, -0.4],
  ].forEach((pos, i) => {
    const type = squadTypes[i];
    const person = soldier(type, {
      ...classes[type].weapons[0],
      skin: "graphite",
      optic: type === "recon" ? "scope" : "reflex",
      barrel: "standard",
    });
    person.position.set(...pos);
    person.rotation.y = [0.18, 0.08, -0.2][i];
    squad.scene.add(person);
    people.push(person);
  });
  function dispose(group) {
    group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && ![dark, joint, steel, glow].includes(o.material))
        o.material.dispose();
    });
    group.removeFromParent();
  }
  function update(type, config) {
    if (selected) dispose(selected);
    if (inspection) dispose(inspection);
    selected = soldier(type, config);
    selected.position.set(0.52, 0, 0.55);
    squad.scene.add(selected);
    inspection = gun(config);
    inspection.rotation.set(0.13, -0.25, 0.03);
    preview.scene.add(inspection);
    squadCanvas.dataset.class = type;
    weaponCanvas.dataset.weapon = config.name;
  }
  // Pointer capture keeps dragging stable even when the cursor leaves the preview.
  let drag = null;
  weaponCanvas.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY };
    weaponCanvas.setPointerCapture(e.pointerId);
  });
  weaponCanvas.addEventListener("pointermove", (e) => {
    if (!drag || !inspection) return;
    inspection.rotation.y += (e.clientX - drag.x) * 0.015;
    inspection.rotation.x += (e.clientY - drag.y) * 0.01;
    drag = { x: e.clientX, y: e.clientY };
  });
  weaponCanvas.addEventListener("pointerup", () => (drag = null));
  weaponCanvas.addEventListener("pointercancel", () => (drag = null));
  weaponCanvas.addEventListener("keydown", (e) => {
    if (
      !inspection ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
    )
      return;
    e.preventDefault();
    inspection.rotation.y +=
      e.key === "ArrowLeft" ? -0.15 : e.key === "ArrowRight" ? 0.15 : 0;
    inspection.rotation.x +=
      e.key === "ArrowUp" ? -0.15 : e.key === "ArrowDown" ? 0.15 : 0;
  });
  weaponCanvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      preview.camera.position.z = THREE.MathUtils.clamp(
        preview.camera.position.z + e.deltaY * 0.002,
        1.2,
        3.5,
      );
    },
    { passive: false },
  );
  // Resize from CSS dimensions so the same scene fits both desktop and touch layouts.
  function resize() {
    for (const view of [squad, preview, yard]) {
      const w = view.canvas.clientWidth,
        h = view.canvas.clientHeight;
      if (!w || !h) continue;
      view.renderer.setSize(w, h, false);
      view.camera.aspect = w / h;
      view.camera.updateProjectionMatrix();
    }
    squad.camera.position.z = squad.camera.aspect < 1.2 ? 11 : 9.4;
  }
  const observer = new ResizeObserver(resize);
  observer.observe(squadCanvas);
  observer.observe(weaponCanvas);
  observer.observe(yardCanvas);
  resize();
  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden || now - last < 32) return;
    last = now;
    const t = now * 0.001;
    for (const [i, p] of [...people, selected].filter(Boolean).entries()) {
      p.userData.body.position.y = reduced ? 0 : Math.sin(t * 1.6 + i) * 0.009;
      p.userData.head.rotation.y = reduced ? 0 : Math.sin(t * 0.33 + i) * 0.07;
    }
    if (inspection && !drag && !reduced) inspection.rotation.y += 0.003;
    for (const view of [squad, preview, yard])
      view.renderer.render(view.scene, view.camera);
  }
  requestAnimationFrame(frame);
  return {
    update,
    setReducedMotion(value) {
      reduced = value;
    },
  };
}
