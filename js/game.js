//@format
/*globals PIXI*/
import {PitchDetector, NoteInfo} from './sound.js';

function init() {
  const app = new PIXI.Application({
      backgroundColor: 0x1099bb,
      width: window.innerWidth,
      height: window.innerHeight,
    }),
    player = PIXI.Sprite.from('img/bird.png'),
    pitchDetector = new PitchDetector(),
    startBtn = document.getElementById('startBtn');

  document.body.appendChild(app.view);

  player.anchor.set(0.5);
  const screenW = app.screen.width,
    screenH = app.screen.height;
  player.x = screenW / 2;
  player.y = screenH / 2;

  app.stage.addChild(player);

  // Listen for animate update
  app.ticker.add((_delta) => {
    // just for fun, let's rotate mr rabbit a little
    // delta is 1 if running at 100% performance
    // creates frame-independent transformation
    if (pitchDetector.listening) {
      const pitch = pitchDetector.detectPitch(),
        noteInfo = NoteInfo.fromPitch(pitch),
        idx = noteInfo.noteIndex,
        v = idx === 0 ? 0 : idx - 40;
      player.y = v * 20;
    }
  });

  let started = false;
  startBtn.addEventListener('click', (_) => {
    if (!started) {
      pitchDetector.listenToMic().then((_) => console.log('listening'));
      started = true;
      startBtn.style.display = 'none';
    }
  });
}

export {init};
