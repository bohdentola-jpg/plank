// Lyosha's spoken intro for each Night School lesson (voiced in Russian).
import { LESSONS } from '../../code/lessons.js';

export const LINES = {};
for (const L of LESSONS) {
  if (L.ru?.line) LINES['lesson.' + L.id] = { who: 'lyosha', ru: L.ru.line, en: L.ru.en };
}
