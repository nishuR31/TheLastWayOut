// Gentle rolling ground. Visual-first: the physics plane stays at y=0, while
// the mesh, paths, player, actors and props follow heightAt. Kept small enough
// that the bike's raycast wheels and 2D walk collision still behave.
import { fbm } from '../core/util.js'

export function makeHeight(seed = 0, amp = 1.5) {
  const s = seed * 13.71
  return (x, z) => {
    const broad = fbm(x * 0.010 + s, z * 0.010 - s, 4)
    const fine = fbm(x * 0.033 - s, z * 0.033 + s, 3)
    return ((broad - 0.47) * 0.82 + (fine - 0.47) * 0.18) * amp
  }
}

// Attach a height function to a level. Safe to call before ground()/ribbon().
export function rolling(L, seed = 0, amp = 1.5) {
  L.heightAt = makeHeight(seed, amp)
  L.groundY = (x, z) => (L.heightAt ? L.heightAt(x, z) : 0)
  return L.heightAt
}
