import * as THREE from "three";
import { weaponMesh } from "./weapon-models.js";
import { classes } from "./lobby-data.js";

// Both canvases are real-time, locally rendered scenes with no remote model dependencies.
export function createLobbyScene(squadCanvas, weaponCanvas) {
  // A deterministic surface texture adds subtle wear without downloading texture assets.
  const surface = document.createElement("canvas");
  surface.width = surface.height = 128;
  const ctx = surface.getContext("2d");
  ctx.fillStyle = "#b9b9b9";
  ctx.fillRect(0, 0, 128, 128);
  let seed = 71;
  for (let i = 0; i < 3200; i++) {
    seed = (seed * 16807) % 2147483647;
    const x = seed % 128;
    seed = (seed * 16807) % 2147483647;
    const y = seed % 128;
    ctx.fillStyle = i % 3 ? "#a5a5a5" : "#d0d0d0";
    ctx.fillRect(x, y, i % 50 === 0 ? 8 : 1, 1);
  }
  const wear = new THREE.CanvasTexture(surface);
  wear.wrapS = wear.wrapT = THREE.RepeatWrapping;
  const material = (color, metalness = 0.35, roughness = 0.65) =>
    new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness,
      map: wear,
      bumpMap: wear,
      bumpScale: 0.002,
    });
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
    scene.add(new THREE.HemisphereLight(0xb9d6ef, 0x26333f, 1.6));
    const key = new THREE.DirectionalLight(0xe5f4ff, 3);
    key.position.set(-3, 6, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    key.shadow.bias = -0.001;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x52bfe9, 3);
    rim.position.set(2, 3, -3);
    scene.add(rim);
    const warm = new THREE.DirectionalLight(0xffc68d, 1);
    warm.position.set(5, 2, 2);
    scene.add(warm);
    return { renderer, scene, camera, canvas, visible: true, dirty: true };
  }
  const squad = setup(squadCanvas),
    preview = setup(weaponCanvas);
  const views = [squad, preview];
  function invalidate(view) {
    view.dirty = true;
    view.renderer.shadowMap.needsUpdate = true;
  }
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
  // Chamfered hard-surface plates avoid spherical toy-like armor while preserving joint articulation.
  function plate(parent, x, y, z, w, h, d, mat) {
    const shape = new THREE.Shape(),
      cut = Math.min(w, h) * 0.18;
    const points = [
      [-w / 2 + cut, -h / 2],
      [w / 2 - cut, -h / 2],
      [w / 2, -h / 2 + cut],
      [w / 2, h / 2 - cut],
      [w / 2 - cut, h / 2],
      [-w / 2 + cut, h / 2],
      [-w / 2, h / 2 - cut],
      [-w / 2, -h / 2 + cut],
    ];
    shape.moveTo(...points[0]);
    for (const p of points.slice(1)) shape.lineTo(...p);
    shape.closePath();
    const bevel = Math.min(w, h, d) * 0.12;
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.001, d - 2 * bevel),
      bevelEnabled: true,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 3,
      steps: 1,
    });
    geometry.translate(0, 0, -d / 2 + bevel);
    return mesh(parent, geometry, mat, x, y, z);
  }
  function box(parent, x, y, z, w, h, d, mat) {
    return mesh(parent, new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  }
  function limb(parent, a, b, r, mat) {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b),
      delta = end.clone().sub(start);
    const m = mesh(
      parent,
      new THREE.CapsuleGeometry(
        r,
        Math.max(0.01, delta.length() - r * 2),
        5,
        10,
      ),
      mat,
    );
    m.position.copy(start.add(end).multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      delta.normalize(),
    );
    return m;
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
  function soldier(type, config) {
    const root = new THREE.Group(),
      body = new THREE.Group();
    root.add(body);
    root.userData.body = body;
    const armor = material(classes[type].color),
      heavy = type === "support" ? 1.16 : 1;
    // Feet, shin plates, knee guards and segmented thigh armor establish human proportions.
    for (const side of [-1, 1]) {
      const x = side * 0.17;
      limb(body, [x, 0.2, 0], [x, 0.95, 0], 0.115, joint);
      plate(body, x, 0.37, 0.025, 0.24, 0.42, 0.28, armor);
      plate(body, x, 0.65, 0.09, 0.25, 0.22, 0.27, steel);
      plate(body, x, 0.85, 0, 0.29, 0.4, 0.3, armor);
      box(body, x, 0.11, 0.065, 0.24, 0.19, 0.4, dark);
      box(body, x, 0.39, 0.17, 0.08, 0.19, 0.035, dark);
    }
    plate(body, 0, 1.08, 0, 0.52, 0.34, 0.34, dark);
    plate(body, 0, 1.4, 0, 0.62 * heavy, 0.65, 0.4, joint);
    plate(body, 0, 1.48, 0.13, 0.59 * heavy, 0.43, 0.23, armor);
    // Split breastplates and inset fasteners give the armored suit a manufactured construction.
    for (const side of [-1, 1]) {
      const chest = plate(
        body,
        side * 0.15,
        1.5,
        0.267,
        0.26,
        0.27,
        0.045,
        steel,
      );
      chest.rotation.z = side * -0.1;
      box(body, side * 0.25, 1.6, 0.295, 0.025, 0.025, 0.014, dark);
    }
    plate(body, 0, 1.25, 0.15, 0.47, 0.2, 0.22, steel);
    box(body, 0, 1.51, 0.3, 0.1, 0.012, 0.025, glow);
    // Utility pouches, backpack, communications aerial and class-specific equipment.
    for (const x of [-0.2, -0.07, 0.07, 0.2])
      box(body, x, 1.14, 0.21, 0.105, 0.14, 0.1, dark);
    box(body, 0, 1.45, -0.24, 0.41, 0.48, 0.2, armor);
    limb(body, [0.18, 1.5, -0.25], [0.18, 2.02, -0.25], 0.012, steel);
    for (const side of [-1, 1]) {
      plate(body, side * 0.36, 1.57, 0, 0.3 * heavy, 0.32, 0.36, armor);
      const elbow = [side * 0.4, 1.26, 0.1],
        hand = [side * 0.2, 1.28, 0.38];
      limb(body, [side * 0.34, 1.52, 0], elbow, 0.1, joint);
      plate(body, side * 0.4, 1.37, 0.04, 0.23, 0.3, 0.25, armor);
      limb(body, elbow, hand, 0.085, armor);
      plate(body, ...hand, 0.15, 0.16, 0.16, dark);
    }
    limb(body, [0, 1.64, 0], [0, 1.82, 0], 0.1, joint);
    const head = new THREE.Group();
    head.position.y = 1.89;
    body.add(head);
    root.userData.head = head;
    const helmet = mesh(head, new THREE.SphereGeometry(1, 24, 16), armor);
    helmet.scale.set(0.165, 0.19, 0.175);
    plate(head, 0, 0.11, 0.04, 0.29, 0.08, 0.29, armor);
    plate(
      head,
      0,
      0.035,
      0.17,
      0.285,
      0.1,
      0.035,
      material(0x071c27, 0.7, 0.2),
    );
    box(head, 0, 0.065, 0.197, 0.23, 0.009, 0.012, glow);
    plate(head, 0, -0.1, 0.14, 0.23, 0.15, 0.17, dark);
    box(head, 0, -0.075, 0.235, 0.12, 0.045, 0.028, steel);
    for (const s of [-1, 1]) plate(head, s * 0.17, 0, 0, 0.08, 0.21, 0.2, dark);
    if (type === "recon") {
      plate(body, 0, 1.68, -0.07, 0.55, 0.22, 0.48, armor);
      const cape = mesh(
        body,
        new THREE.ConeGeometry(0.39, 0.87, 6, 1, true),
        new THREE.MeshStandardMaterial({
          color: 0x283c48,
          side: THREE.DoubleSide,
          roughness: 1,
        }),
        0,
        1.2,
        -0.26,
      );
      cape.scale.z = 0.35;
    }
    if (type === "support") {
      for (let i = 0; i < 7; i++)
        box(
          body,
          -0.24 + i * 0.075,
          1.39 - i * 0.045,
          0.295,
          0.045,
          0.1,
          0.045,
          material(0xab9565),
        );
    }
    if (type === "engineer") {
      box(body, 0.31, 1.03, 0, 0.13, 0.27, 0.15, armor);
      box(body, 0.32, 1.09, 0.085, 0.05, 0.08, 0.02, glow);
    }
    const weapon = gun(config);
    weapon.scale.setScalar(0.8);
    weapon.position.set(0.04, 1.3, 0.39);
    weapon.rotation.z = -0.18;
    body.add(weapon);
    return root;
  }
  // Illuminated low-profile platform receives real shadows from the squad.
  mesh(
    squad.scene,
    new THREE.CylinderGeometry(2.7, 2.85, 0.12, 96),
    material(0x17242d, 0.75, 0.45),
    0,
    -0.09,
    0,
  );
  const ring = mesh(
    squad.scene,
    new THREE.TorusGeometry(2.69, 0.012, 8, 120),
    glow,
    0,
    -0.018,
    0,
  );
  ring.rotation.x = Math.PI / 2;
  const inner = mesh(
    squad.scene,
    new THREE.TorusGeometry(2.5, 0.007, 8, 120),
    glow,
    0,
    -0.01,
    0,
  );
  inner.rotation.x = Math.PI / 2;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const tick = box(
      squad.scene,
      Math.sin(a) * 2.6,
      -0.012,
      Math.cos(a) * 2.6,
      0.025,
      0.007,
      0.09,
      i % 4 === 0 ? glow : steel,
    );
    tick.rotation.y = a;
  }
  const people = [];
  let selected = null,
    inspection = null,
    reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Distant patrol craft and sparse floating dust add motion without competing with the squad.
  const patrols = [];
  for (let i = 0; i < 2; i++) {
    const ship = new THREE.Group();
    box(ship, 0, 0, 0, 0.16, 0.06, 0.42, steel);
    const wings = mesh(ship, new THREE.ConeGeometry(0.3, 0.035, 3), dark);
    wings.rotation.x = Math.PI / 2;
    box(ship, 0, 0, 0.22, 0.075, 0.022, 0.025, glow);
    ship.position.set(i ? 3 : -3, 3.15 + i * 0.38, -5);
    ship.rotation.y = -0.8;
    ship.scale.setScalar(0.45);
    wings.rotation.x = 0;
    squad.scene.add(ship);
    patrols.push(ship);
  }
  const dustPositions = [];
  for (let i = 0; i < 55; i++)
    dustPositions.push(
      Math.sin(i * 17.4) * 4,
      Math.abs(Math.cos(i * 9.3)) * 3,
      Math.sin(i * 4.1) * 3,
    );
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(dustPositions, 3),
  );
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({
      color: 0x9ed3e9,
      size: 0.012,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    }),
  );
  squad.scene.add(dust);
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
    for (const view of views) invalidate(view);
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
    invalidate(preview);
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
    invalidate(preview);
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
      invalidate(preview);
    },
    { passive: false },
  );
  // Resize from CSS dimensions so the same scene fits both desktop and touch layouts.
  function resize() {
    for (const view of views) {
      const w = view.canvas.clientWidth,
        h = view.canvas.clientHeight;
      if (!w || !h) continue;
      view.renderer.setSize(w, h, false);
      view.camera.aspect = w / h;
      view.camera.updateProjectionMatrix();
      invalidate(view);
    }
    squad.camera.position.z = squad.camera.aspect < 1.2 ? 11 : 9.4;
  }
  const observer = new ResizeObserver(resize);
  observer.observe(squadCanvas);
  observer.observe(weaponCanvas);
  // Mobile layouts can scroll either preview out of view. Keep changes pending
  // until it returns so the first visible frame is always current.
  const visibility = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const view = views.find((view) => view.canvas === entry.target);
      view.visible = entry.isIntersecting;
      if (view.visible) invalidate(view);
    }
  });
  for (const view of views) visibility.observe(view.canvas);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) for (const view of views) invalidate(view);
  });
  for (const view of views)
    view.canvas.addEventListener("webglcontextrestored", () =>
      invalidate(view),
    );
  resize();
  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden || now - last < 32) return;
    last = now;
    const t = now * 0.001;
    function animate(p, i) {
      p.userData.body.position.y = reduced ? 0 : Math.sin(t * 1.6 + i) * 0.009;
      p.userData.head.rotation.y = reduced ? 0 : Math.sin(t * 0.33 + i) * 0.07;
    }
    people.forEach(animate);
    if (selected) animate(selected, people.length);
    if (!reduced) {
      patrols.forEach(
        (ship, i) => (ship.position.x = Math.sin(t * 0.07 + i * 2.5) * 4),
      );
      dust.rotation.y = t * 0.015;
    }
    if (inspection && !drag && !reduced) inspection.rotation.y += 0.003;
    for (const view of views) {
      if (!view.visible || (reduced && !view.dirty)) continue;
      view.renderer.shadowMap.autoUpdate = !reduced;
      view.renderer.render(view.scene, view.camera);
      view.dirty = false;
    }
  }
  requestAnimationFrame(frame);
  return {
    update,
    setReducedMotion(value) {
      if (reduced === value) return;
      reduced = value;
      for (const view of views) invalidate(view);
    },
  };
}
