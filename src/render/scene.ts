import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TABLE_HEIGHT, type SimSession } from "../sim/session";
import { MM, type SimObject } from "../sim/world";
import { buildRobotModel } from "./robotModel";

export type CameraMode = "top" | "aligned" | "free";

/** Draws a SimSession with Three.js and keeps meshes in sync with physics. */
export class SceneView {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
  private controls: OrbitControls;
  private mode: CameraMode = "top";
  private session: SimSession | null = null;
  private meshes: { obj: SimObject; mesh: THREE.Object3D }[] = [];
  private robot: ReturnType<typeof buildRobotModel> | null = null;
  private floorTexture: THREE.CanvasTexture | null = null;
  private levelGroup = new THREE.Group();
  private sun: THREE.DirectionalLight;
  private lastRobot = { x: 0, y: 0, heading: 0 };

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0xdde5ee);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a94a6, 1.6));
    const sun = (this.sun = new THREE.DirectionalLight(0xffffff, 1.6));
    sun.position.set(1.2, 3, 1.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.5, far: 8 });
    this.scene.add(sun, sun.target);
    this.scene.add(this.levelGroup);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    this.controls.addEventListener("start", () => {
      if (this.mode !== "free") this.setCamera("free");
    });

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Replace everything with a new session's playground and robot. */
  load(session: SimSession) {
    this.session = session;
    this.levelGroup.clear();
    this.meshes = [];
    const { w, h } = session.def.size;
    const theme = session.def.theme;

    // Sky / water color and shadows sized to the field.
    const sky = theme === "underwater" ? 0x0f5a7a : 0xdde5ee;
    this.scene.background = new THREE.Color(sky);
    this.scene.fog = theme === "underwater" ? new THREE.Fog(sky, 2.5, 7) : null;
    const half = (Math.max(w, h) / 2) * MM + 0.5;
    Object.assign(this.sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, far: half * 4 + 4 });
    this.sun.position.set(half * 0.6, half * 1.5 + 1, half * 0.8);
    this.sun.shadow.camera.updateProjectionMatrix();

    // Ground under the field (far below it for a raised table), then the
    // painted field itself.
    const raised = session.def.raised;
    const groundColor = theme === "underwater" ? 0xcbb98a : raised ? 0x7d9a6a : 0xb9c2cd;
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry((w + (raised ? 6000 : 600)) * MM, 0.04, (h + (raised ? 6000 : 600)) * MM),
      new THREE.MeshStandardMaterial({ color: groundColor, roughness: 0.9 }),
    );
    ground.position.y = raised ? -TABLE_HEIGHT * MM - 0.021 : -0.021;
    ground.receiveShadow = true;
    this.levelGroup.add(ground);
    if (theme === "island") {
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry((w + 6000) * MM, (h + 6000) * MM),
        new THREE.MeshStandardMaterial({ color: 0x2f7fb8, roughness: 0.3, transparent: true, opacity: 0.85 }),
      );
      water.rotation.x = -Math.PI / 2;
      water.position.y = -0.22;
      this.levelGroup.add(water);
    }

    this.floorTexture?.dispose();
    this.floorTexture = new THREE.CanvasTexture(session.floor.canvas);
    this.floorTexture.colorSpace = THREE.SRGBColorSpace;
    this.floorTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(w * MM, h * MM),
      // alphaTest: non-rectangular fields leave the outside transparent.
      new THREE.MeshStandardMaterial({ map: this.floorTexture, roughness: 0.95, alphaTest: 0.5 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.0005;
    floor.receiveShadow = true;
    this.levelGroup.add(floor);

    for (const obj of session.world.objects) this.addObject(obj);

    this.robot = buildRobotModel(session.robot.kind);
    this.levelGroup.add(this.robot.group);
    this.lastRobot = { ...session.robot.position, heading: session.robot.heading };
    this.setCamera(this.mode);
  }

  private addObject(obj: SimObject) {
    const s = obj.shape;
    const geo =
      s.kind === "box"
        ? new THREE.BoxGeometry(s.w * MM, s.h * MM, s.d * MM)
        : new THREE.CylinderGeometry(s.r * MM, s.r * MM, s.h * MM, s.kind === "hex" ? 6 : 32);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: obj.color, roughness: 0.7 }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.levelGroup.add(mesh);
    this.meshes.push({ obj, mesh });
  }

  /** Call after the floor canvas changes (pen drawing, fills). */
  floorChanged() {
    if (this.floorTexture) this.floorTexture.needsUpdate = true;
  }

  setCamera(mode: CameraMode) {
    this.mode = mode;
    this.controls.enabled = true;
    if (!this.session) return;
    const { w, h } = this.session.def.size;
    const span = Math.max(w, h) * MM;
    if (mode === "top") {
      this.camera.position.set(0, span * 1.25, 0.001);
      this.controls.target.set(0, 0, 0);
    } else if (mode === "free") {
      // Keep whatever the user is doing; start from an angled view.
      if (this.camera.position.y > span) {
        this.camera.position.set(0, span * 0.8, span * 0.9);
        this.controls.target.set(0, 0, 0);
      }
    }
    this.controls.update();
  }

  get cameraMode() {
    return this.mode;
  }

  private lastFloorUpload = 0;

  render() {
    if (!this.session || !this.robot) return;
    // Pen strokes: re-upload the floor texture, at most ~12 times a second.
    const now = performance.now();
    if (this.session.floorDirty && now - this.lastFloorUpload > 80) {
      this.session.floorDirty = false;
      this.lastFloorUpload = now;
      this.floorChanged();
    }
    for (const { obj, mesh } of this.meshes) {
      mesh.visible = !obj.removed;
      const t = obj.body.translation();
      const r = obj.body.rotation();
      mesh.position.set(t.x, t.y, t.z);
      mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
    const body = this.session.robot.body;
    const t = body.translation();
    const r = body.rotation();
    this.robot.group.position.set(t.x, t.y, t.z);
    this.robot.group.quaternion.set(r.x, r.y, r.z, r.w);
    this.spinWheels();

    if (this.mode === "aligned") {
      const hd = (this.session.robot.heading * Math.PI) / 180;
      const fwd = new THREE.Vector3(Math.sin(hd), 0, -Math.cos(hd));
      const target = new THREE.Vector3(t.x, 0.05, t.z).addScaledVector(fwd, 0.35);
      const eye = new THREE.Vector3(t.x, 0.42, t.z).addScaledVector(fwd, -0.55);
      this.camera.position.lerp(eye, 0.15);
      this.controls.target.lerp(target, 0.15);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private spinWheels() {
    const robot = this.session!.robot;
    const p = robot.position;
    const heading = robot.heading;
    const hd = (heading * Math.PI) / 180;
    const forward = (p.x - this.lastRobot.x) * Math.sin(hd) + (p.y - this.lastRobot.y) * Math.cos(hd);
    let turn = heading - this.lastRobot.heading;
    turn = ((turn + 540) % 360) - 180;
    const turnArc = (turn * Math.PI / 180) * 70; // mm each side travels
    this.lastRobot = { x: p.x, y: p.y, heading };
    this.robot!.wheels.forEach((wheel, i) => {
      const left = i < 2;
      const dist = forward + (left ? turnArc : -turnArc);
      wheel.rotation.x -= dist / 34;
    });
  }
}
