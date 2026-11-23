# Snake Lab

Learn Python by building Snake, one function at a time, on the **PIXEL-8**: a tiny
handheld with a 16 × 16 grid of lights that only speaks Python.

**To play, open `snake-lab.html` in a browser.** It's a single self-contained file:
no install, no server and no internet needed. Progress is saved in the browser.

## The 15 lessons

| Chapter | Lessons | You learn |
|---|---|---|
| Power on | Hello · Name tag · How big is the screen? | `print`, variables, f-strings, arithmetic |
| Draw | First light · Ground · Crate · Checkerboard | calling functions, `for` loops, `range`, nested loops, `if`/`else`, `%` |
| Snake | A snake appears · The paintbrush | lists, tuples, unpacking, `def` |
| Game | One step · Walls · Slither · Ouch · Faster | `return`, `elif`, booleans, slicing, `in`, `//`, `min` |
| Your rules | Your game | everything: change the rules of your own Snake |

From lesson 10 on, the game is real: the PIXEL-8 calls **your** functions every
tick (`step`, `hits_wall`, `move`, `bites_itself`, `speed`, and `draw` to paint the
screen), and you play it with the arrow keys, W A S D, the on-screen pad or a swipe.
Each function you write is kept and used by the lessons after it, and the last lesson
puts them all in one file for you to change: wrap-around walls, a rainbow snake, rocks.

The Python is the interpreter from COLD BOOT (`../coldboot/src/code/python.js`), a
real subset of Python 3 with CPython-style error messages, a hint for every error,
and a step limit so an endless loop can't freeze the page.

## Working on it

```
node snakelab/build.mjs    # src/ + the interpreter  ->  snake-lab.html
node snakelab/test.mjs     # headless check: every lesson, every play mode, the error messages
```

`src/lessons.js` holds the lessons, `src/app.js` the editor, the console and the game,
`src/style.css` and `src/body.html` the page. Edit those, not `snake-lab.html`.
