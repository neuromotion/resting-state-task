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

const moveThree = async(position, code) => {
  const center = event_codes.center
  await sleep(5000)
  moveDot(position)
  PD_spot_encode(code)
  sendToPort(code)
  await sleep(2000)
  moveDot('center')
  PD_spot_encode(center)
  sendToPort(center)
  await sleep(2000)
  moveDot(position)
  PD_spot_encode(code)
  sendToPort(code)
  await sleep(2000)
  moveDot('center')
  PD_spot_encode(center)
  sendToPort(center)
  await sleep(2000)
  moveDot(position)
  PD_spot_encode(code)
  sendToPort(code)
  await sleep(2000)
  moveDot('center')
  PD_spot_encode(center)
  sendToPort(center)
}


const blinkTask = async() => {
  await sleep(1000)
  const start = event_codes.blink_start;
  PD_spot_encode(start)
  sendToPort(start)
  beep()
  await sleep(10000)
  const finish = event_codes.blink_end;
  PD_spot_encode(finish)
  sendToPort(finish)
  beep()
  await sleep(1000)
}

const closeEyesTask = async() => {
  await sleep(1000)
  const close = event_codes.close_eyes;
  PD_spot_encode(close)
  sendToPort(close)
  beep()
  await sleep(10000)
  const finish = event_codes.open_eyes;
  PD_spot_encode(open)
  sendToPort(open)
  beep()
  await sleep(1000)
}
