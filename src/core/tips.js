// Rotating tips drawn from the whole game — controls, items, story beats and the
// weird rules of the night. One shared rotation feeds every `.rot-tip` element,
// so the character screen, main menu and loading screen stay in sync.
const TIPS = [
  'Hold <k>Shift</k>+<k>W</k> while steering the bike — Nishant runs round and pushes from behind, and you move much faster.',
  'Press <k>G</k> to take the handlebars and walk the bike over rough ground. <k>B</k> gets you back in the saddle (you need the key).',
  'The red bike has a horn: left click while riding. <k>E</k> starts and stops the engine.',
  '<k>F</k> is your flashlight. While you are walking the bike it switches the bike headlight instead.',
  '<k>C</k> crouches. Some things in the forest only notice people who are standing.',
  '<k>X</k> swaps between first-person and third-person. If something feels wrong, look at it from the other side too.',
  'Your phone (<k>P</k>) shows the time. Watch what happens to the signal as you go deeper.',
  'Pick up your phone and key from the table before you leave the house. <k>Shift</k>+<k>E</k> puts an item back.',
  'Helmets hang on the rear holder by the chin strap — <k>Shift</k>+<k>B</k> near the bike to hang or take one.',
  '<k>T</k> builds a fire with three twigs. Warmth eases tiredness and fear; <k>E</k> at a fire-pit lights it with two.',
  'The gold marker is the only thing that never lies. <k>M</k> opens the map if you lose it.',
  'If the road brings you back to the same village a second time, stop and watch instead of riding straight in.',
  'A white shape at a window, gone when you look again? Note where it was. The Reality Log (<k>R</k>) keeps track.',
  'The bamboo shelter is not as empty as it looks. Move quietly; watch the edges of the frame.',
  'Running matters. <k>Shift</k>+<k>W</k> gets you away faster but tires you — a tired person hears things differently.',
  'Matches are more useful for what they reveal than for the light itself.',
  'Stuck on a path? <k>H</k> hops you a few metres forward along the route.',
  'Headphones help. Some of the warnings in the forest arrive as sound before they arrive as sight.',
  'Press the highlighted letter in any menu instead of clicking — <k>N</k> new game, <k>S</k> settings, <k>B</k> back.',
  '<k>Ctrl</k>+<k>V</k> takes a screenshot. <k>V</k> on its own lifts the helmet visor.',
  'Nishan hears things first; Nishant sees things first. Switch character (<k>V</k>) to feel the difference.',
  'There is no fighting here. If something follows you, hiding and waiting is a real option.',
  'In the pause menu, <k>Esc</k> resumes and <k>M</k> returns to the main menu.',
  'The clicking in the walls of the old village is not the wind.',
  'The horizon at the cremation ground stays the wrong colour. Stay a moment and let your eyes adjust.'
]

const render = (t) => t.replace(/<k>(.*?)<\/k>/g, '<kbd>$1</kbd>')

export const tips = {
  el: [], order: [], i: 0, timer: null,
  init(interval = 6000) {
    this.el = Array.from(document.querySelectorAll('.rot-tip'))
    if (!this.el.length) return
    this.next()
    clearInterval(this.timer)
    this.timer = setInterval(() => this.next(), interval)
  },
  next() {
    if (!this.order.length || this.i >= this.order.length) {
      this.order = TIPS.map((_, i) => i)
      for (let i = this.order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const t = this.order[i]; this.order[i] = this.order[j]; this.order[j] = t
      }
      this.i = 0
    }
    const html = render(TIPS[this.order[this.i++]])
    for (const el of this.el) {
      if (el.dataset.fading) continue
      el.dataset.fading = '1'
      el.style.opacity = '0'
      setTimeout(() => {
        el.innerHTML = html
        el.style.opacity = '1'
        delete el.dataset.fading
      }, 280)
    }
  }
}
