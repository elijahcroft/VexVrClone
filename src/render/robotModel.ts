import * as THREE from "three";
import { ROBOT_SIZE, type RobotKind } from "../sim/robot";
import { MM } from "../sim/world";

const PAINT: Record<RobotKind, { body: number; plate: number }> = {
  vr_robot: { body: 0x3b4252, plate: 0xff8a3d },
  underwater: { body: 0x1f4e79, plate: 0xffd23f },
  mazebot: { body: 0x2f3b2f, plate: 0x4ade80 },
};

/**
 * Original robot look: chassis, colored top plate (per robot kind), four
 * wheels, a front bumper bar and an eye sensor. Built around the physics box's center, with
 * -Z as the robot's front.
 */
export function buildRobotModel(kind: RobotKind = "vr_robot") {
  const { w, l, h } = ROBOT_SIZE;
  const paint = PAINT[kind];
  const g = new THREE.Group();
  const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...extra });
  const box = (bw: number, bh: number, bl: number, color: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw * MM, bh * MM, bl * MM), mat(color));
    m.position.set(x * MM, y * MM, z * MM);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };

  const wheelW = 20;
  const wheelR = 34;
  const bodyW = w - wheelW * 2 - 4;
  const bottom = -h / 2;

  // Chassis and top plate.
  box(bodyW, 50, l - 20, paint.body, 0, bottom + 14 + 25, 0);
  box(bodyW + 10, 8, l - 30, paint.plate, 0, bottom + 14 + 54, 6);
  if (kind === "mazebot") {
    // Side distance sensors.
    for (const sx of [-1, 1]) box(12, 20, 28, 0x2e3440, sx * (bodyW / 2 + 6), bottom + 14 + 40, 0);
  }
  // Brain with a small screen.
  box(70, 34, 60, 0x2e3440, 0, bottom + 14 + 75, 30);
  const screen = box(54, 2, 40, 0x88c0d0, 0, bottom + 14 + 93, 30);
  (screen.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x2a6f8a);
  // Front bumper bar and eye sensor.
  box(w - 6, 22, 10, 0xd8dee9, 0, bottom + 24, -l / 2 + 5);
  box(30, 20, 14, 0x2e3440, 0, bottom + 52, -l / 2 + 10);
  const lens = new THREE.Mesh(
    new THREE.CircleGeometry(6 * MM, 20),
    mat(0x00e0ff, { emissive: new THREE.Color(0x00a0c0) }),
  );
  lens.position.set(0, (bottom + 52) * MM, (-l / 2 + 2.9) * MM);
  lens.rotation.y = Math.PI;
  g.add(lens);
  // Direction arrow on the plate.
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(14 * MM, 30 * MM, 3),
    mat(0xffffff),
  );
  arrow.rotation.x = -Math.PI / 2;
  arrow.position.set(0, (bottom + 14 + 60) * MM, (-l / 2 + 40) * MM);
  g.add(arrow);

  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(wheelR * MM, wheelR * MM, wheelW * MM, 24);
  wheelGeo.rotateZ(Math.PI / 2);
  const tire = mat(0x1d1f24, { roughness: 0.9 });
  const hubGeo = new THREE.CylinderGeometry(14 * MM, 14 * MM, (wheelW + 2) * MM, 12);
  hubGeo.rotateZ(Math.PI / 2);
  const hub = mat(0xbfc6d0, { metalness: 0.5 });
  const wheels: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wheel = new THREE.Mesh(wheelGeo, tire);
      wheel.add(new THREE.Mesh(hubGeo, hub));
      wheel.position.set((sx * (w / 2 - wheelW / 2)) * MM, (bottom + wheelR) * MM, (sz * (l / 2 - wheelR - 4)) * MM);
      wheel.castShadow = true;
      g.add(wheel);
      wheels.push(wheel);
    }
  }
  return { group: g, wheels };
}
