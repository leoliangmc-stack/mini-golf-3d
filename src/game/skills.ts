/**
 * Skills: things the player can do on purpose while a round is on, a set number of
 * times per hole (SPEC v3 2.8). Hole data names them by id, `skills: { freeze: 2 }`;
 * what each one does lives in a registered definition, like zones and challenges.
 */

/** What a skill can see of the round, and do to it. */
export interface SkillHost {
  readonly phase: string;
  /** Time is frozen: nothing moves and no tick passes. */
  readonly frozen: boolean;
  setFrozen(frozen: boolean): void;
  /** True if at least one ball is out in the open rather than inside a tunnel or a cannon. */
  hasFreeBall(): boolean;
}

export interface SkillDef {
  /** Whether the skill can be used right now, uses left aside. */
  ready(host: SkillHost): boolean;
  use(host: SkillHost): void;
}

/** A skill on the current hole: how many uses the hole gives, and how many are left. */
export interface SkillState {
  max: number;
  charges: number;
}

const registry = new Map<string, SkillDef>();

export function registerSkill(id: string, def: SkillDef): void {
  registry.set(id, def);
}

export function getSkill(id: string): SkillDef {
  const def = registry.get(id);
  if (!def) throw new Error(`Unknown skill "${id}"`);
  return def;
}

export function registerBuiltinSkills(): void {
  /**
   * Time freeze (SPEC v3 2.3): stops everything while a ball is under way, so the
   * player can look around and play another stroke from where the ball is, mid-air
   * included. Not available while the player is aiming anyway.
   */
  registerSkill('freeze', {
    ready: (host) => host.phase === 'rolling' && !host.frozen && host.hasFreeBall(),
    use: (host) => host.setFrozen(true),
  });
}
