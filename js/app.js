//@format
/*globals Promise, Float32Array*/

function getUserMedia(constraints) {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    return navigator.mediaDevices.getUserMedia(constraints);
  } else {
    const fn =
      navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia ||
      navigator.msGetUserMedia;

    return new Promise((resolve, reject) => fn(constraints, resolve, reject));
  }
}
class PitchDetector {
  constructor() {
    this.audioContext = null;
    this.mediaStreamSource = null;
    this.analyser = null;
    this.bufLen = 2048;
    this.buf = new Float32Array(this.bufLen);

    this.listining = false;
  }

  onGetUserMediaOk(stream) {
    this.listening = true;
    this.audioContext = new AudioContext();
    this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.mediaStreamSource.connect(this.analyser);
    return stream;
  }

  listenToMic() {
    return getUserMedia({audio: true, video: false})
      .catch((err) => alert('' + err))
      .then((stream) => this.onGetUserMediaOk(stream));
  }

  detectPitch() {
    this.analyser.getFloatTimeDomainData(this.buf);
    return autoCorrelate(this.buf, this.audioContext.sampleRate, 0, 0.9);
  }
}

class NoteInfo {
  constructor(noteIndex, noteName, accidental, octave, detune) {
    this.noteIndex = noteIndex;
    this.noteName = noteName;
    this.accidental = accidental;
    this.octave = octave;
    this.detune = detune;
  }
}

const ACC_NONE = 0,
  ACC_FLAT = -1,
  ACC_SHARP = 1;
NoteInfo.fromPitch = function (pitch) {
  if (pitch === -1) {
    return new NoteInfo(0, '', ACC_NONE, 0, 0);
  }

  const noteIndex = noteFromPitch(pitch),
    noteName = NOTE_NAMES[noteIndex % 12],
    octave = Math.floor(noteIndex / 12),
    detune = centsOffFromPitch(pitch, noteIndex),
    accidental = detune === 0 ? ACC_NONE : detune < 0 ? ACC_FLAT : ACC_SHARP;

  return new NoteInfo(noteIndex, noteName, accidental, octave, detune);
};

// https://github.com/cwilso/PitchDetect/blob/master/js/pitchdetect.js

const NOTE_NAMES = [
    'C',
    'C♯',
    'D',
    'D♯',
    'E',
    'F',
    'F♯',
    'G',
    'G♯',
    'A',
    'A♯',
    'B',
  ],
  ACCIDENTAL_SYMBOLS = ['♭', '', '♯'];

function noteFromPitch(frequency) {
  const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
  return Math.round(noteNum) + 69;
}

function frequencyFromNoteNumber(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function centsOffFromPitch(frequency, note) {
  return Math.floor(
    (1200 * Math.log(frequency / frequencyFromNoteNumber(note))) / Math.log(2)
  );
}

// good enough correlation: "bar" for how close a correlation needs to be
function autoCorrelate(buf, sampleRate, minSamples, goodEnoughCorrelation) {
  let SIZE = buf.length,
    MAX_SAMPLES = Math.floor(SIZE / 2),
    bestOffset = -1,
    bestCorrelation = 0,
    rms = 0,
    foundGoodCorrelation = false,
    correlations = new Array(MAX_SAMPLES);

  for (let i = 0; i < SIZE; i++) {
    let val = buf[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01)
    // not enough signal
    return -1;

  let lastCorrelation = 1;
  for (let offset = minSamples; offset < MAX_SAMPLES; offset++) {
    let correlation = 0;

    for (let i = 0; i < MAX_SAMPLES; i++) {
      correlation += Math.abs(buf[i] - buf[i + offset]);
    }
    correlation = 1 - correlation / MAX_SAMPLES;
    correlations[offset] = correlation; // store it, for the tweaking we need to do below.
    if (correlation > goodEnoughCorrelation && correlation > lastCorrelation) {
      foundGoodCorrelation = true;
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    } else if (foundGoodCorrelation) {
      // short-circuit - we found a good correlation, then a bad one, so we'd just be seeing copies from here.
      // Now we need to tweak the offset - by interpolating between the values to the left and right of the
      // best offset, and shifting it a bit.  This is complex, and HACKY in this code (happy to take PRs!) -
      // we need to do a curve fit on correlations[] around bestOffset in order to better determine precise
      // (anti-aliased) offset.

      // we know bestOffset >=1,
      // since foundGoodCorrelation cannot go to true until the second pass (offset=1), and
      // we can't drop into this clause until the following pass (else if).
      let shift =
        (correlations[bestOffset + 1] - correlations[bestOffset - 1]) /
        correlations[bestOffset];
      return sampleRate / (bestOffset + 8 * shift);
    }
    lastCorrelation = correlation;
  }
  if (bestCorrelation > 0.01) {
    // console.log("f = " + sampleRate/bestOffset + "Hz (rms: " + rms + " confidence: " + bestCorrelation + ")")
    return sampleRate / bestOffset;
  }
  return -1;
  //	let best_frequency = sampleRate/bestOffset;
}

function byId(id) {
  return document.getElementById(id);
}
function main() {
  window.onerror = (err) => alert('' + err);
  const pitchDetector = new PitchDetector(),
    startBtn = byId('startBtn'),
    noteNode = byId('note'),
    octaveNode = byId('octave'),
    accidentalNode = byId('accidental'),
    detuneNode = byId('detune');

  function updateUI() {
    if (pitchDetector.listening) {
      const pitch = pitchDetector.detectPitch(),
        noteInfo = NoteInfo.fromPitch(pitch);
      noteNode.innerText = noteInfo.noteName;
      octaveNode.innerText = noteInfo.octave;
      accidentalNode.innerText = ACCIDENTAL_SYMBOLS[noteInfo.accidental + 1];
      detuneNode.innerText = Math.abs(noteInfo.detune);
    }

    window.requestAnimationFrame(updateUI);
  }

  let started = false;
  startBtn.addEventListener('click', (_) => {
    if (!started) {
      pitchDetector.listenToMic().then((_) => console.log('listening'));
      window.requestAnimationFrame(updateUI);
      started = true;
    }
  });
}

main();
