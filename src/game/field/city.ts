import { FIXED_DT } from '../../core/loop';
import { hypot } from '../../core/math';
import type { Vec3, XYZ } from '../../core/types';
import { xyz } from '../../core/types';
import type { TrainDef, TunnelDef, TunnelMouthDef } from '../../level/field';
import type { Ball } from '../../physics/ball';
import { RAPIER } from '../../physics/rapier';
import { getSurface } from '../../physics/surfaces';
import {
  DEFAULT_RADIUS,
  headingVector,
  mouthAt,
  stepTunnel,
  type Mouth,
  type TunnelHost,
  type TunnelTrip,
} from '../../physics/zones/tunnel';
import { standPost, TURN_COOLDOWN, TURN_SPEED } from './elements';
import { ground, type Field, type Part } from './field';

/** How far a mouth stands out from the middle of its kiosk, unless its data says otherwise. */
export const KIOSK_REACH = 0.55;
/** How tall a kiosk stands. */
export const KIOSK_HEIGHT = 1.3;

/** Where a mouth of a tunnel is, on the ground, when it opens toward `facing`. */
export function mouthPoint(mouth: TunnelMouthDef, facing: number): Vec3 {
  const dir = headingVector(facing);
  const reach = mouth.reach ?? KIOSK_REACH;
  return [mouth.at[0] + dir.x * reach, mouth.at[1], mouth.at[2] + dir.z * reach];
}

/**
 * A pair of tunnel mouths that can be turned (SPEC v7 3.2). To a ball it is the tunnel
 * of Chapter 2, run by the same code (physics/zones/tunnel.ts): what is new is that a
 * knock on a mouth's lever turns the mouth about its kiosk to the next of its facings.
 * That moves where a ball comes out, and, since a mouth only takes a ball rolling
 * against the way it faces, where one can go in.
 *
 * It is one of the works, where the old tunnel is a zone, because a ball changes it:
 * which way each mouth faces is in the snapshot, and goes back with a stroke.
 *
 * Its signal: a mouth faces another way than it started.
 */
export class Tunnel implements Part {
  readonly kind = 'tunnel';
  readonly busy = false;
  readonly radius: number;
  /** Which of its facings each mouth opens toward. */
  readonly index: [number, number];
  private readonly ends: readonly [TunnelMouthDef, TunnelMouthDef];
  private readonly starts: readonly [number, number];
  /** The collider of each mouth's lever, or -1 for a mouth without one. */
  private readonly levers: [number, number] = [-1, -1];
  private readonly cooldown: [number, number] = [0, 0];
  /** The mouth that was turned last: where the camera looks. */
  private turned: 0 | 1 = 0;
  private trips = new WeakMap<Ball, TunnelTrip>();
  /** Mouths by ball radius, end and facing: worked out once each. */
  private readonly mouths = new Map<string, Mouth>();
  private rider: Ball | null = null;
  private readonly tunnelHost: TunnelHost;

  constructor(
    readonly def: TunnelDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    this.ends = [def.a, def.b];
    this.radius = def.radius ?? DEFAULT_RADIUS;
    this.ends.forEach((end, i) => {
      const count = end.facings.length;
      if (count < 1 || count > 4) throw new Error(`Tunnel "${id}": a mouth has one to four facings, not ${count}`);
      if (count > 1 && !end.lever) throw new Error(`Tunnel "${id}": a mouth that turns needs a lever`);
      if (!((end.start ?? 0) in end.facings)) throw new Error(`Tunnel "${id}": a mouth starts at a facing it does not have`);
      if (end.lever && count > 1) this.levers[i] = standPost(field, this, end.lever);
      // The kiosk the mouth is set in: a round wall. A ball that meets it anywhere but at the mouth bounces off.
      const { world, surfaces } = field.host;
      const kiosk = world.raw.createCollider(
        RAPIER.ColliderDesc.cylinder(KIOSK_HEIGHT / 2 + 0.15, end.reach ?? KIOSK_REACH)
          .setTranslation(end.at[0], end.at[1] + KIOSK_HEIGHT / 2 - 0.15, end.at[2])
          .setFriction(0)
          .setRestitution(getSurface('kiosk').restitution)
          .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max),
      );
      surfaces.setCollider(kiosk.handle, 'wall', 'kiosk');
    });
    this.starts = [def.a.start ?? 0, def.b.start ?? 0];
    this.index = [this.starts[0], this.starts[1]];
    const { host } = field;
    this.tunnelHost = {
      busy: () => this.rider && host.hold(this.rider),
      snap: () => this.rider && host.snap(this.rider),
      cue: (name) => host.cue(name),
    };
  }

  get on(): boolean {
    return this.index[0] !== this.starts[0] || this.index[1] !== this.starts[1];
  }

  get anchor(): XYZ {
    return ground(this.ends[this.turned].at);
  }

  /** Compass heading a mouth opens toward right now, in degrees. */
  facing(end: 0 | 1): number {
    return this.ends[end].facings[this.index[end]];
  }

  private mouth(end: 0 | 1, ballRadius: number): Mouth {
    const facing = this.facing(end);
    const key = `${ballRadius}|${end}|${facing}`;
    let mouth = this.mouths.get(key);
    if (!mouth) this.mouths.set(key, (mouth = mouthAt(mouthPoint(this.ends[end], facing), facing, ballRadius)));
    return mouth;
  }

  hit(_ball: Ball, speed: number, collider: number): void {
    const which = this.levers.indexOf(collider);
    if (which < 0) return;
    const end = which as 0 | 1;
    if (this.cooldown[end] > 0 || speed < TURN_SPEED) return;
    this.index[end] = (this.index[end] + 1) % this.ends[end].facings.length;
    this.cooldown[end] = TURN_COOLDOWN;
    this.turned = end;
    this.field.host.cue('tunnelTurn');
    this.field.host.changed(this.id);
  }

  step(): void {
    const { host } = this.field;
    for (const end of [0, 1] as const) if (this.cooldown[end] > 0) this.cooldown[end]--;
    for (const ball of host.balls()) {
      let trip = this.trips.get(ball);
      if (!trip) this.trips.set(ball, (trip = { transit: null }));
      const r = ball.props.radius;
      this.rider = ball;
      // A trip under way keeps the mouths it began with, whatever is turned meanwhile.
      stepTunnel(ball, host.world.tick, [this.mouth(0, r), this.mouth(1, r)], this.radius, trip, this.tunnelHost);
    }
    this.rider = null;
  }

  save(): [number, number] {
    return [this.index[0], this.index[1]];
  }

  load(state: unknown): void {
    const [a, b] = state as [number, number];
    this.index[0] = a;
    this.index[1] = b;
    this.cooldown[0] = this.cooldown[1] = 0;
    // A stroke is only ever put back with the ball out in the open: no trip is under way.
    this.trips = new WeakMap();
  }
}

/** How fast a train runs on average, in m/s, unless its data says otherwise. */
const TRAIN_SPEED = 7;
const BOARD_RADIUS = 0.5;
/** Ticks a ball takes to hop aboard, and to hop off again. */
const HOP_TICKS = 12;
/** How high the hop goes, in metres. */
const HOP_HEIGHT = 0.35;
/** How far above the track a ball's underside rides: the floor of the wagon. */
export const TRAIN_SEAT = 0.3;
/** The train comes back empty this many times quicker than it went out. */
const RETURN_PACE = 2;
/** The least a station has to be clear of the platform it serves, on top of the platform's radius. */
const CLEAR_OF_PLATFORM = 0.3;

/** What a train is doing: waiting at its platform, taking a ball aboard, on its way out, setting it down, on its way back. */
export type TrainStage = 'home' | 'boarding' | 'out' | 'alighting' | 'back';

/** The track of one line: its corners and how far along the track each one is. */
interface Route {
  points: XYZ[];
  /** Metres of track from the platform to each corner. */
  along: number[];
  /** Ticks the run out takes, and the run back. */
  out: number;
  back: number;
}

const smooth = (u: number): number => {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
};

/**
 * A train (SPEC v7 3.3). It waits at its platform with the points set by the levers
 * that its lines name. A ball that rolls onto the platform is put aboard, at whatever
 * speed it came, and the train leaves at once along the line the points are set for;
 * at the station it sets the ball down, at rest, and runs back empty.
 *
 * Nothing here has grip, so nothing can ride on a carriage: the ball is taken out of
 * the simulation while it is aboard, like a ball in a robot arm, and meets nothing on
 * the way. The carriage itself is no collider at all.
 *
 * A stroke is not over until the train is home again. So the points are never thrown
 * under a moving train, a snapshot is always of a train at its platform, and a ball
 * can never be waiting on a platform the train is away from.
 *
 * Its signal: it is away from its platform.
 */
export class Train implements Part {
  readonly kind = 'train';
  /** On its way back there is nothing to watch: the camera stays with the ball it set down. */
  readonly discreet = true;
  readonly anchor: XYZ;
  readonly radius: number;
  stage: TrainStage = 'home';
  /** The line the points are set for. */
  line: number;
  /** The line it is out on, or last was. */
  running: number;
  /** Where the carriage is after the coming step, and after the last one. */
  position: XYZ;
  prev: XYZ;
  /** The way the track runs where the carriage is, on the ground: a unit vector. */
  heading: { x: number; z: number } = { x: 0, z: -1 };
  private readonly home: XYZ;
  private readonly routes: Route[];
  private tick = 0;
  private rider: Ball | null = null;
  /** Where the ball was when it was taken aboard. */
  private from: XYZ;

  constructor(
    readonly def: TrainDef,
    private readonly field: Field,
    readonly id: string,
  ) {
    if (def.lines.length === 0) throw new Error(`Train "${id}" has no line to run on`);
    if (!def.lines.some((line) => line.when === undefined)) {
      throw new Error(`Train "${id}" needs a line the points are set for when no lever is thrown`);
    }
    this.anchor = ground(def.board);
    this.radius = def.radius ?? BOARD_RADIUS;
    this.home = xyz(def.home);
    this.position = this.prev = this.from = this.home;
    const speed = def.speed ?? TRAIN_SPEED;
    this.routes = def.lines.map((line, i) => {
      const clear = hypot(line.drop[0] - def.board[0], line.drop[1] - def.board[1], line.drop[2] - def.board[2]);
      if (clear < this.radius + CLEAR_OF_PLATFORM) {
        throw new Error(`Train "${id}": line ${i} sets the ball down on the train's own platform`);
      }
      const points = [this.home, ...(line.via ?? []).map(xyz), xyz(line.stop)];
      const along = [0];
      for (let p = 1; p < points.length; p++) {
        const a = points[p - 1];
        const b = points[p];
        along.push(along[p - 1] + hypot(b.x - a.x, b.y - a.y, b.z - a.z));
      }
      const length = along[along.length - 1];
      if (!(length > 0)) throw new Error(`Train "${id}": line ${i} goes nowhere`);
      const out = Math.max(HOP_TICKS, Math.round(length / speed / FIXED_DT));
      return { points, along, out, back: Math.max(HOP_TICKS, Math.round(out / RETURN_PACE)) };
    });
    // Until the levers can be asked (`resync`, once every part exists): the line that needs none.
    this.line = this.running = def.lines.findIndex((line) => line.when === undefined);
    this.heading = this.place(this.routes[this.line], 0).heading;
  }

  get on(): boolean {
    return this.stage !== 'home';
  }

  get busy(): boolean {
    return this.stage !== 'home';
  }

  /** True while a ball is aboard, hopping on or hopping off. */
  get loaded(): boolean {
    return this.rider !== null;
  }

  /** The line the levers call for right now: the first whose signal is on, or the one that needs none. */
  private wanted(): number {
    const { lines } = this.def;
    for (let i = 0; i < lines.length; i++) {
      const when = lines[i].when;
      if (when !== undefined && this.field.test(when)) return i;
    }
    return lines.findIndex((line) => line.when === undefined);
  }

  /** Where the carriage is `share` of the way along a route, 0 at the platform and 1 at the station. */
  private place(route: Route, share: number): { at: XYZ; heading: { x: number; z: number } } {
    const { points, along } = route;
    const distance = share * along[along.length - 1];
    let i = 0;
    while (i < points.length - 2 && distance > along[i + 1]) i++;
    const a = points[i];
    const b = points[i + 1];
    const span = along[i + 1] - along[i];
    const t = span > 0 ? Math.min(1, Math.max(0, (distance - along[i]) / span)) : 0;
    const flat = hypot(b.x - a.x, b.z - a.z);
    return {
      at: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t },
      heading: flat > 1e-9 ? { x: (b.x - a.x) / flat, z: (b.z - a.z) / flat } : this.heading,
    };
  }

  private within(ball: Ball): boolean {
    const p = ball.position();
    const [x, y, z] = this.def.board;
    return hypot(p.x - x, p.y - ball.props.radius - y, p.z - z) <= this.radius;
  }

  /** Holds the rider `share` of the way from one point to another, with a hop in the middle. */
  private hop(from: XYZ, to: XYZ, share: number): void {
    const lift = 4 * share * (1 - share) * HOP_HEIGHT;
    this.rider!.body.setTranslation(
      {
        x: from.x + (to.x - from.x) * share,
        y: from.y + (to.y - from.y) * share + lift,
        z: from.z + (to.z - from.z) * share,
      },
      true,
    );
  }

  /** Where the middle of the rider is while it sits in the carriage. */
  private seat(at: XYZ): XYZ {
    return { x: at.x, y: at.y + TRAIN_SEAT + this.rider!.props.radius, z: at.z };
  }

  step(): void {
    const { host } = this.field;
    this.prev = this.position;
    if (this.stage === 'home') {
      const wanted = this.wanted();
      if (wanted !== this.line) {
        this.line = this.running = wanted;
        this.heading = this.place(this.routes[wanted], 0).heading;
        host.cue('pointsSet');
        host.changed(this.id);
      }
      const ball = host.balls().find((candidate) => candidate.body.isEnabled() && this.within(candidate));
      if (!ball) return;
      this.rider = ball;
      this.from = { ...ball.position() };
      this.stage = 'boarding';
      this.tick = 0;
      ball.halt();
      ball.body.setEnabled(false);
      host.hold(ball);
      host.cue('trainBoard');
      return;
    }

    const route = this.routes[this.running];
    const rider = this.rider;
    if (rider) host.hold(rider);
    this.tick++;
    if (this.stage === 'boarding') {
      this.hop(this.from, this.seat(this.home), this.tick / HOP_TICKS);
      if (this.tick < HOP_TICKS) return;
      this.stage = 'out';
      this.tick = 0;
      host.cue('trainDepart');
    } else if (this.stage === 'out') {
      const { at, heading } = this.place(route, smooth(this.tick / route.out));
      this.position = at;
      this.heading = heading;
      rider!.body.setTranslation(this.seat(at), true);
      if (this.tick < route.out) return;
      this.stage = 'alighting';
      this.tick = 0;
      host.cue('trainArrive');
    } else if (this.stage === 'alighting') {
      const [x, y, z] = this.def.lines[this.running].drop;
      const drop = { x, y: y + rider!.props.radius, z };
      this.hop(this.seat(this.position), drop, this.tick / HOP_TICKS);
      if (this.tick < HOP_TICKS) return;
      // Set down, at rest (SPEC v7 3.3): the stroke ends here, once the train is home.
      rider!.body.setEnabled(true);
      rider!.teleport(drop);
      this.rider = null;
      this.stage = 'back';
      this.tick = 0;
      host.cue('trainSetDown');
    } else {
      const { at, heading } = this.place(route, smooth(1 - this.tick / route.back));
      this.position = at;
      this.heading = heading;
      if (this.tick < route.back) return;
      this.position = this.home;
      this.stage = 'home';
      this.tick = 0;
    }
  }

  save(): null {
    return null;
  }

  /** The train has nothing of its own to put back: it is at its platform, and the points follow the levers. */
  load(): void {
    this.rider?.body.setEnabled(true);
    this.rider = null;
    this.stage = 'home';
    this.tick = 0;
    this.position = this.prev = this.home;
  }

  resync(): void {
    this.line = this.wanted();
    if (this.stage === 'home') {
      this.running = this.line;
      this.heading = this.place(this.routes[this.line], 0).heading;
    }
  }
}
