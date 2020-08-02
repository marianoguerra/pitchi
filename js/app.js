//@format
import {init} from './game.js';

function main() {
  window.onerror = (err) => alert('' + err);
  init();
}

window.addEventListener('load', (_) => main());
