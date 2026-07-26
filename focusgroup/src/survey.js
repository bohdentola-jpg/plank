// FOCUS GROUP — Form 4B.
//
// A reply-paid card with four questions on it. No stamp is required. No
// collection is necessary. Your answers are remembered and come back at you on
// Saturday in a voice that is being friendly about it.
//
// Question four has four boxes and only three of them have anything printed
// next to them.

import { SURVEY } from './story.js';

export class SurveyCard {
  constructor(host) {
    this.el = document.createElement('div');
    this.el.className = 'survey';
    this.el.hidden = true;
    host.appendChild(this.el);
    this.open = false;
  }

  /**
   * @returns {Promise<number[]>} one answer index per question
   */
  show() {
    const answers = new Array(SURVEY.questions.length).fill(-1);
    this.el.hidden = false;
    this.open = true;

    this.el.innerHTML = `
      <div class="card">
        <div class="card-head">
          <span class="ch-brand">VALCO</span>
          <span class="ch-form">${SURVEY.head}</span>
        </div>
        <p class="card-intro">${SURVEY.intro}</p>
        <div class="card-qs"></div>
        <div class="card-foot">
          <span class="cf-note">Please complete in pen. Leave the card where you found it.</span>
          <button class="cf-send" disabled>RETURN THE CARD</button>
        </div>
      </div>`;

    const qs = this.el.querySelector('.card-qs');
    const send = this.el.querySelector('.cf-send');

    SURVEY.questions.forEach((q, qi) => {
      const block = document.createElement('div');
      block.className = 'q';
      block.innerHTML = `<div class="q-t">${q.q}</div>`;
      const row = document.createElement('div');
      row.className = 'q-a';
      q.a.forEach((label, ai) => {
        const b = document.createElement('button');
        b.className = `q-b${label ? '' : ' blank'}`;
        b.innerHTML = `<span class="q-box">☐</span><span>${label || ''}</span>`;
        b.onclick = () => {
          answers[qi] = ai;
          [...row.children].forEach((c, ci) => {
            c.classList.toggle('on', ci === ai);
            c.querySelector('.q-box').textContent = ci === ai ? '☒' : '☐';
          });
          send.disabled = answers.some((a) => a < 0);
        };
        row.appendChild(b);
      });
      block.appendChild(row);
      qs.appendChild(block);
    });

    return new Promise((res) => {
      send.onclick = () => {
        // the thank-you is printed on the back, and it has been there the
        // whole time you were filling in the front
        this.el.querySelector('.card').innerHTML = `
          <div class="card-head"><span class="ch-brand">VALCO</span>
            <span class="ch-form">FORM 4B — RECEIVED</span></div>
          <p class="card-thanks">${SURVEY.thanks}</p>
          <div class="card-foot"><span class="cf-note"></span>
            <button class="cf-send">PUT IT BACK</button></div>`;
        this.el.querySelector('.cf-send').onclick = () => {
          this.el.hidden = true;
          this.open = false;
          res(answers);
        };
      };
    });
  }
}

/** What the announcer says back to you, given what you ticked. */
export function surveyEcho(answers) {
  if (!answers || !answers.length) return 'You did not fill in the card. We filled it in.';
  const lines = [];
  answers.forEach((a, i) => {
    const q = SURVEY.questions[i];
    if (q && a >= 0 && q.echo[a]) lines.push(q.echo[a]);
  });
  // the ad only has room for one of them, and it picks the worst one
  return lines[3] || lines[2] || lines[0] || '';
}
