const moveDot = (position) => {
  const p = $("#dot-container");
  p.attr('class', `move-${position}`);
}

const blink = () => {
  const p = $("#fixation-dot");
  p.attr('class', 'blink');
}

const beep = () => {
  const context = new AudioContext()
  const o = context.createOscillator()
  const g = context.createGain()
  o.type = 'sine'
  o.connect(g)
  g.connect(context.destination)
  o.start()
  g.gain.exponentialRampToValueAtTime(
        0.0000001, context.currentTime + 1
        )
}

const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const moveThree = async(position) => {
  await sleep(2000)
  moveDot(position)
  await sleep(2000)
  moveDot('center')
}
