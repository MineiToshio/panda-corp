import { type CopyKey, t } from "@/lib/copy/copy";
/** Contiguous bands of the engine's forty ranks. */
export const ERAS = [
  { id: "awakening", from: 0, to: 3 },
  { id: "bearers", from: 4, to: 6 },
  { id: "guardians", from: 7, to: 15 },
  { id: "champions", from: 16, to: 24 },
  { id: "ascended", from: 25, to: 33 },
  { id: "transcendence", from: 34, to: 39 },
] as const;
/** Flavor is UI copy keyed by the original rank sprite family. */
export function flavorFor(sprite: string | undefined): string {
  const keys: Record<string, CopyKey> = {
    human: "logros.ranks.flavor.human",
    "dawn-seeker": "logros.ranks.flavor.dawnSeeker",
    lightbearer: "logros.ranks.flavor.lightbearer",
    oathkeeper: "logros.ranks.flavor.oathkeeper",
    glyphwarden: "logros.ranks.flavor.glyphwarden",
    "aether-warden": "logros.ranks.flavor.aetherWarden",
    shardbearer: "logros.ranks.flavor.shardbearer",
    "knight-radiant": "logros.ranks.flavor.knightRadiant",
    realmcaller: "logros.ranks.flavor.realmcaller",
    "dawn-herald": "logros.ranks.flavor.dawnHerald",
    stormlord: "logros.ranks.flavor.stormlord",
    ascendant: "logros.ranks.flavor.ascendant",
    "phoenix-ascendant": "logros.ranks.flavor.phoenixAscendant",
    "leviathan-lord": "logros.ranks.flavor.leviathanLord",
    "crimson-dragonlord": "logros.ranks.flavor.crimsonDragonlord",
    "celestial-warden": "logros.ranks.flavor.celestialWarden",
    "dawn-sovereign": "logros.ranks.flavor.dawnSovereign",
    "eternal-oathbearer": "logros.ranks.flavor.eternalOathbearer",
  };
  const key = sprite ? keys[sprite] : undefined;
  return key ? t(key) : "";
}
