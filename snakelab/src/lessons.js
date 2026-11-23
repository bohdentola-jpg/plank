// SNAKE LAB — the lessons.
// kind: 'output' (check what was printed), 'draw' (match the ghost picture),
// 'drawfn' (a draw function called with test cases), 'func' (a function with
// test cases; then Play), 'sandbox' (everything together; Play).
// A lesson that `provides` a function adds the player's code for it to the
// toolkit, which later lessons load before their own code.

const ROW = (y, color) => Array.from({ length: 16 }, (_, x) => [x, y, color]);
const RECT = (x0, x1, y0, y1, color) => {
  const out = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y, color]);
  return out;
};

const LESSONS = [
  // ------------------------------------------------------------------ Power on
  {
    id: 'hello', chapter: 'Power on', title: 'Hello, PIXEL-8', kind: 'output',
    story: 'You found it at a flea market for two dollars: the <b>PIXEL-8</b>, a home-made handheld with a 16 × 16 grid of lights. Taped to the back is a note: <i>“I only speak Python. Say hello.”</i>',
    task: 'Make the PIXEL-8 print exactly <code>Hello, PIXEL-8!</code>',
    concept: ['print()', '<code>print(...)</code> shows whatever is inside the brackets. Text goes in quotes, <code>"like this"</code>. The quotes themselves are not printed.'],
    starter: '# Lines that start with # are notes for humans. Python skips them.\n# Change the text between the quotes, then press Run (or Ctrl+Enter).\n\nprint("Hello")\n',
    solution: 'print("Hello, PIXEL-8!")\n',
    hints: [
      'The text must match exactly: the capital letters, the comma, the dash and the exclamation mark.',
      'Put the whole message between the quotes: <code>print("Hello, PIXEL-8!")</code>',
    ],
    expect: (out) => out.includes('Hello, PIXEL-8!') ? null
      : out.length ? `It printed <code>${esc(out[0])}</code>. It should print <code>Hello, PIXEL-8!</code>` : 'Nothing was printed. Use <code>print(...)</code>.',
  },
  {
    id: 'name', chapter: 'Power on', title: 'Name tag', kind: 'output',
    story: 'The screen flickers: <i>OWNER UNKNOWN.</i> It wants to know who you are, and it keeps things in <b>variables</b>: names that hold values.',
    task: 'Put your name in the variable <code>name</code> and set <code>level</code> to 1. Print <code>Owner: </code> followed by your name, then on the next line <code>Level 1</code>, using the <code>level</code> variable.',
    concept: ['Variables and f-strings', '<code>name = "Sam"</code> puts the text "Sam" into <code>name</code>. Use it later without quotes. An <b>f-string</b> (an <code>f</code> before the quote) fills in names in curly braces: <code>f"Owner: {name}"</code>.'],
    starter: 'name = "your name here"\nlevel = 1\n\nprint(f"Owner: {name}")\n# now print Level 1, using the level variable\n',
    solution: 'name = "Sam"\nlevel = 1\n\nprint(f"Owner: {name}")\nprint(f"Level {level}")\n',
    hints: [
      'Change <code>"your name here"</code> to your own name, still inside the quotes.',
      'Another f-string does the second line: <code>print(f"Level {level}")</code>',
    ],
    expect: (out, vm) => {
      const name = vm.get('name'), level = vm.get('level');
      if (typeof name !== 'string' || !name.trim()) return 'The variable <code>name</code> should hold some text, in quotes.';
      if (name === 'your name here') return 'Put your own name in the quotes on the first line.';
      if (level !== 1) return '<code>level</code> should be <code>1</code>.';
      if (out[0] !== `Owner: ${name}`) return `The first line should be <code>${esc(`Owner: ${name}`)}</code>${out[0] !== undefined ? `, not <code>${esc(out[0])}</code>` : ''}.`;
      if (out[1] !== 'Level 1') return `The second line should be <code>Level 1</code>${out[1] !== undefined ? `, not <code>${esc(out[1])}</code>` : ''}.`;
      return null;
    },
  },
  {
    id: 'count', chapter: 'Power on', title: 'How big is the screen?', kind: 'output',
    story: '<i>HOW MANY LIGHTS DO I HAVE?</i> The screen is 16 lights wide and 16 lights tall. Python can do the maths.',
    task: 'Keep <code>width</code> and <code>height</code> at 16 and let Python work out <code>total = width * height</code>. Then it prints <code>256 pixels</code>.',
    concept: ['Arithmetic', 'Python does maths with <code>+ - * /</code>. <code>total = width * height</code> multiplies the two values and keeps the answer in <code>total</code>.'],
    starter: 'width = 16\nheight = 16\ntotal = 0   # make Python work this out instead\n\nprint(f"{total} pixels")\n',
    solution: 'width = 16\nheight = 16\ntotal = width * height\n\nprint(f"{total} pixels")\n',
    hints: [
      'Multiplication in Python is <code>*</code>.',
      'Change the third line to <code>total = width * height</code>',
    ],
    expect: (out, vm) => {
      if (vm.get('width') !== 16 || vm.get('height') !== 16) return 'Keep <code>width</code> and <code>height</code> at 16.';
      if (vm.get('total') !== 256) return `<code>total</code> is ${esc(String(vm.get('total')))}. It should be width times height.`;
      if (!out.includes('256 pixels')) return 'It should print <code>256 pixels</code>.';
      return null;
    },
  },
  // ---------------------------------------------------------------------- Draw
  {
    id: 'first', chapter: 'Draw', title: 'First light', kind: 'draw',
    story: 'Now it wants to see something. The lights are numbered from 0: <b>x</b> goes left to right (0–15) and <b>y</b> goes top to bottom (0–15). The faint squares show where light is wanted. Point at the screen to read a square’s x and y.',
    task: 'Light the three marked pixels: <code>(2, 3)</code> red, <code>(7, 7)</code> green and <code>(13, 12)</code> blue.',
    concept: ['Calling a function', '<code>pixel(x, y, color)</code> is a function. Call it by its name, with three <b>arguments</b> in brackets, separated by commas: <code>pixel(2, 3, "red")</code>.'],
    starter: 'pixel(2, 3, "red")\n# now the green one at (7, 7) and the blue one at (13, 12)\n',
    solution: 'pixel(2, 3, "red")\npixel(7, 7, "green")\npixel(13, 12, "blue")\n',
    hints: [
      'Each pixel is one line: the x, the y, then the colour in quotes.',
      'Add <code>pixel(7, 7, "green")</code> and <code>pixel(13, 12, "blue")</code>',
    ],
    target: [[2, 3, 'red'], [7, 7, 'green'], [13, 12, 'blue']],
  },
  {
    id: 'ground', chapter: 'Draw', title: 'Ground', kind: 'draw',
    story: 'A landscape needs ground: sixteen green pixels in a row. You could write <code>pixel(...)</code> sixteen times. Or let a <b>loop</b> do it.',
    task: 'Fill the whole row <code>y = 12</code> with green, using one <code>for</code> loop.',
    concept: ['for loops', '<code>for x in range(16):</code> repeats the indented lines under it 16 times, with <code>x</code> = 0, 1, 2 … 15. The indent (4 spaces) marks what is inside the loop.'],
    starter: 'for x in range(16):\n    pass   # replace pass with a pixel(...) that uses x\n',
    solution: 'for x in range(16):\n    pixel(x, 12, "green")\n',
    hints: [
      'Inside the loop, <code>x</code> is a different number each time round. Use it as the first argument.',
      'The line inside the loop: <code>pixel(x, 12, "green")</code>',
    ],
    target: ROW(12, 'green'),
  },
  {
    id: 'crate', chapter: 'Draw', title: 'Crate', kind: 'draw',
    story: 'Every game needs a crate. This one is an orange block, 6 wide and 6 tall: x from 5 to 10, y from 4 to 9.',
    task: 'Draw the orange block with two loops, one inside the other.',
    concept: ['range(start, stop) and nested loops', '<code>range(5, 11)</code> counts 5, 6, 7, 8, 9, 10: it stops just <i>before</i> 11. A loop inside a loop visits every (x, y) in a rectangle.'],
    starter: 'for y in range(4, 10):\n    # put a second loop here, for x from 5 to 10,\n    # and light the pixel at (x, y) inside it\n    pass\n',
    solution: 'for y in range(4, 10):\n    for x in range(5, 11):\n        pixel(x, y, "orange")\n',
    hints: [
      'The inner loop goes inside the outer one, indented by 4 more spaces: <code>for x in range(5, 11):</code>',
      'And inside that, 8 spaces in: <code>pixel(x, y, "orange")</code>',
    ],
    target: RECT(5, 10, 4, 9, 'orange'),
  },
  {
    id: 'checkers', chapter: 'Draw', title: 'Checkerboard', kind: 'draw',
    story: 'The PIXEL-8 wants a floor for its arcade: a checkerboard, purple and pink, over the whole screen.',
    task: 'Fill all 256 pixels: purple where <code>x + y</code> is even, pink where it is odd.',
    concept: ['if / else and %', '<code>%</code> gives the remainder of a division: <code>7 % 2</code> is 1 and <code>8 % 2</code> is 0. So <code>(x + y) % 2 == 0</code> asks “is x + y even?”. <code>==</code> compares; <code>if</code> / <code>else</code> picks one of two paths.'],
    starter: 'for y in range(16):\n    for x in range(16):\n        if (x + y) % 2 == 0:\n            pixel(x, y, "purple")\n        # else: the pink ones\n',
    solution: 'for y in range(16):\n    for x in range(16):\n        if (x + y) % 2 == 0:\n            pixel(x, y, "purple")\n        else:\n            pixel(x, y, "pink")\n',
    hints: [
      '<code>else:</code> lines up exactly under its <code>if</code>, and ends with a colon.',
      'Under <code>else:</code>, indented 4 more: <code>pixel(x, y, "pink")</code>',
    ],
    target: (() => { const t = []; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.push([x, y, (x + y) % 2 === 0 ? 'purple' : 'pink']); return t; })(),
  },
  // --------------------------------------------------------------------- Snake
  {
    id: 'snake', chapter: 'Snake', title: 'A snake appears', kind: 'draw',
    story: 'Deep in the PIXEL-8’s memory you find an unfinished game: <b>SNAKE</b>. A snake is just a <b>list</b> of positions, head first. Each position is a pair <code>(x, y)</code>, called a <b>tuple</b>.',
    task: 'Draw the snake: every part green, then its head (the first item, <code>snake[0]</code>) in lime.',
    concept: ['Lists and tuples', 'A list keeps items in order, and <code>snake[0]</code> is the first one. <code>for x, y in snake:</code> hands you each pair already split into <code>x</code> and <code>y</code>.'],
    starter: 'snake = [(8, 8), (7, 8), (6, 8), (5, 8)]\n\nfor x, y in snake:\n    pixel(x, y, "green")\n\n# now light the head, snake[0], in lime\n',
    solution: 'snake = [(8, 8), (7, 8), (6, 8), (5, 8)]\n\nfor x, y in snake:\n    pixel(x, y, "green")\n\nhx, hy = snake[0]\npixel(hx, hy, "lime")\n',
    hints: [
      'Split the head into two names first: <code>hx, hy = snake[0]</code>',
      'Then <code>pixel(hx, hy, "lime")</code>. It comes after the loop, so the lime goes over the green.',
    ],
    target: [[8, 8, 'lime'], [7, 8, 'green'], [6, 8, 'green'], [5, 8, 'green']],
  },
  {
    id: 'draw', chapter: 'Snake', title: 'The paintbrush', kind: 'drawfn', provides: 'draw',
    story: 'A game redraws its screen many times a second, so the drawing goes in a <b>function</b> you can call again and again. This one becomes the game’s paintbrush.',
    task: 'Finish <code>draw(snake, apple)</code>: clear the screen, light the apple red, the snake green, and its head lime.',
    concept: ['def: your own functions', '<code>def draw(snake, apple):</code> makes a function. <code>snake</code> and <code>apple</code> are <b>parameters</b>: names for whatever the game passes in each time it calls <code>draw</code>.'],
    starter: 'def draw(snake, apple):\n    clear()\n    ax, ay = apple\n    pixel(ax, ay, "red")\n    # draw the snake green, then its head (snake[0]) lime\n\n\n# try it out:\ndraw([(4, 4), (3, 4), (2, 4)], (10, 10))\n',
    solution: 'def draw(snake, apple):\n    clear()\n    ax, ay = apple\n    pixel(ax, ay, "red")\n    for x, y in snake:\n        pixel(x, y, "green")\n    hx, hy = snake[0]\n    pixel(hx, hy, "lime")\n',
    hints: [
      'It’s the same loop as the last lesson, indented one level more because it’s inside the function.',
      'Inside the function: <code>for x, y in snake:</code> / <code>pixel(x, y, "green")</code>, then <code>hx, hy = snake[0]</code> and <code>pixel(hx, hy, "lime")</code>.',
    ],
    cases: [
      { snake: [[4, 4], [3, 4], [2, 4]], apple: [10, 10] },
      { snake: [[12, 3], [12, 4]], apple: [0, 15] },
      { snake: [[1, 1], [2, 1], [3, 1], [3, 2]], apple: [8, 8] },
    ],
  },
  // ---------------------------------------------------------------------- Game
  {
    id: 'step', chapter: 'Game', title: 'One step', kind: 'func', provides: 'step', play: 'dot',
    story: 'The snake has to move. Every tick, the game asks your function: <i>the head is here and we’re heading this way, so where is the head next?</i>',
    task: 'Write <code>step(head, direction)</code>. It gets the head as <code>(x, y)</code> and a direction: "up", "down", "left" or "right". Return the next position. When the tests pass, press <b>Play</b> and steer with the arrow keys.',
    concept: ['return and if / elif', '<code>return</code> hands a value back to whoever called the function. <code>if</code> / <code>elif</code> / <code>else</code> checks conditions in order and runs only the first true one. Remember that y grows <i>downward</i>.'],
    starter: 'def step(head, direction):\n    x, y = head\n    if direction == "up":\n        return (x, y - 1)\n    elif direction == "down":\n        return (x, y + 1)\n    # add "left" and "right"\n',
    solution: 'def step(head, direction):\n    x, y = head\n    if direction == "up":\n        return (x, y - 1)\n    elif direction == "down":\n        return (x, y + 1)\n    elif direction == "left":\n        return (x - 1, y)\n    else:\n        return (x + 1, y)\n',
    hints: [
      'Left and right change <code>x</code>, not <code>y</code>.',
      'Add <code>elif direction == "left":</code> returning <code>(x - 1, y)</code>, and one more for "right" returning <code>(x + 1, y)</code>.',
    ],
    tests: [
      { call: 'step((5, 5), "up")', expect: [5, 4], show: '(5, 4)' },
      { call: 'step((5, 5), "down")', expect: [5, 6], show: '(5, 6)' },
      { call: 'step((5, 5), "left")', expect: [4, 5], show: '(4, 5)' },
      { call: 'step((5, 5), "right")', expect: [6, 5], show: '(6, 5)' },
      { call: 'step((0, 9), "left")', expect: [-1, 9], show: '(-1, 9)' },
    ],
  },
  {
    id: 'walls', chapter: 'Game', title: 'Walls', kind: 'func', provides: 'hits_wall', play: 'walls',
    story: 'Off the edge, the dot vanished into nothing. A real game has walls. Before every move the game will ask your function: <i>is this spot off the screen?</i>',
    task: 'Write <code>hits_wall(pos)</code>: return <code>True</code> if x or y is outside 0–15, otherwise <code>False</code>.',
    concept: ['Booleans and or', 'A comparison like <code>x &lt; 0</code> is either <code>True</code> or <code>False</code>. <code>or</code> is True when either side is: <code>x &lt; 0 or x &gt; 15</code>. You can return a condition directly.'],
    starter: 'def hits_wall(pos):\n    x, y = pos\n    if x < 0:\n        return True\n    # what about the other three edges?\n    return False\n',
    solution: 'def hits_wall(pos):\n    x, y = pos\n    return x < 0 or x > 15 or y < 0 or y > 15\n',
    hints: [
      'The screen runs from 0 to 15, so 16 is already off it. Check x &gt; 15, y &lt; 0 and y &gt; 15 too.',
      'One line does it all: <code>return x &lt; 0 or x &gt; 15 or y &lt; 0 or y &gt; 15</code>',
    ],
    tests: [
      { call: 'hits_wall((8, 8))', expect: false, show: 'False' },
      { call: 'hits_wall((0, 0))', expect: false, show: 'False' },
      { call: 'hits_wall((15, 15))', expect: false, show: 'False' },
      { call: 'hits_wall((-1, 5))', expect: true, show: 'True' },
      { call: 'hits_wall((16, 5))', expect: true, show: 'True' },
      { call: 'hits_wall((5, -1))', expect: true, show: 'True' },
      { call: 'hits_wall((5, 16))', expect: true, show: 'True' },
    ],
  },
  {
    id: 'move', chapter: 'Game', title: 'Slither', kind: 'func', provides: 'move', play: 'snake',
    story: 'Time for a body. Every tick the snake gets a new head at the front and loses its tail at the back. When it eats the apple it keeps its tail, and so it grows.',
    task: 'Write <code>move(snake, new_head, grow)</code>: return a new list with <code>new_head</code> first, then the old snake without its last part. If <code>grow</code> is True, keep the whole old snake.',
    concept: ['Joining and slicing lists', '<code>[new_head] + snake</code> joins two lists. <code>snake[:-1]</code> is a <b>slice</b>: the whole list except the last item.'],
    starter: 'def move(snake, new_head, grow):\n    if grow:\n        return [new_head] + snake\n    # not growing: leave the tail behind\n',
    solution: 'def move(snake, new_head, grow):\n    if grow:\n        return [new_head] + snake\n    return [new_head] + snake[:-1]\n',
    hints: [
      'When it’s not growing, the list still starts with <code>[new_head]</code>, but then drops the last part of <code>snake</code>.',
      '<code>return [new_head] + snake[:-1]</code>',
    ],
    tests: [
      { call: 'move([(5, 5), (4, 5), (3, 5)], (6, 5), False)', expect: [[6, 5], [5, 5], [4, 5]], show: '[(6, 5), (5, 5), (4, 5)]' },
      { call: 'move([(5, 5), (4, 5), (3, 5)], (6, 5), True)', expect: [[6, 5], [5, 5], [4, 5], [3, 5]], show: '[(6, 5), (5, 5), (4, 5), (3, 5)]' },
      { call: 'move([(2, 2)], (2, 1), False)', expect: [[2, 1]], show: '[(2, 1)]' },
    ],
  },
  {
    id: 'bite', chapter: 'Game', title: 'Ouch', kind: 'func', provides: 'bites_itself', play: 'full',
    story: 'Your snake slides straight through its own body. Not very snake-like. If the head lands on any other part of it, the game is over.',
    task: 'Write <code>bites_itself(snake)</code>: return <code>True</code> if the head (<code>snake[0]</code>) is also somewhere in the rest of the body.',
    concept: ['in', '<code>in</code> checks whether something is in a list: <code>(3, 4) in [(1, 1), (3, 4)]</code> is True. <code>snake[1:]</code> is everything after the head.'],
    starter: 'def bites_itself(snake):\n    head = snake[0]\n    body = snake[1:]\n    # is the head in the body?\n    return False\n',
    solution: 'def bites_itself(snake):\n    head = snake[0]\n    body = snake[1:]\n    return head in body\n',
    hints: [
      'Python can answer “is head in body?” almost word for word.',
      '<code>return head in body</code>',
    ],
    tests: [
      { call: 'bites_itself([(5, 5), (4, 5), (3, 5)])', expect: false, show: 'False' },
      { call: 'bites_itself([(4, 5), (5, 5), (5, 6), (4, 6), (4, 5)])', expect: true, show: 'True' },
      { call: 'bites_itself([(1, 1)])', expect: false, show: 'False' },
      { call: 'bites_itself([(2, 2), (2, 3), (2, 2)])', expect: true, show: 'True' },
    ],
  },
  {
    id: 'speed', chapter: 'Game', title: 'Faster', kind: 'func', provides: 'speed', play: 'speed',
    story: 'It works! Now make it exciting: the more apples you eat, the faster the snake goes.',
    task: 'Write <code>speed(score)</code>: start at 5 moves a second, add 1 for every 3 apples, and never go above 15.',
    concept: ['// and min()', '<code>//</code> divides and drops the remainder, so <code>7 // 3</code> is 2. <code>min(a, b)</code> gives the smaller of the two, which is a handy way to set a limit.'],
    starter: 'def speed(score):\n    moves = 5 + score // 3\n    # never faster than 15\n    return moves\n',
    solution: 'def speed(score):\n    moves = 5 + score // 3\n    return min(moves, 15)\n',
    hints: [
      'At a score of 30, <code>5 + 30 // 3</code> is 15. At 99 it would be 38: far too fast.',
      '<code>return min(moves, 15)</code>',
    ],
    tests: [
      { call: 'speed(0)', expect: 5, show: '5' },
      { call: 'speed(2)', expect: 5, show: '5' },
      { call: 'speed(3)', expect: 6, show: '6' },
      { call: 'speed(9)', expect: 8, show: '8' },
      { call: 'speed(30)', expect: 15, show: '15' },
      { call: 'speed(99)', expect: 15, show: '15' },
    ],
  },
  // ---------------------------------------------------------------- Your rules
  {
    id: 'yours', chapter: 'Your rules', title: 'Your game', kind: 'sandbox', play: 'speed',
    story: '<b>SNAKE</b> is finished, and every line of it is yours. All your functions are below in one place. Change the rules, press Run, then Play your own version.',
    task: 'Ideas to try:<ul><li><b>Wrap-around:</b> in <code>step</code>, use <code>% 16</code> so the snake comes out the other side, and make <code>hits_wall</code> return <code>False</code>.</li><li><b>Rainbow:</b> in <code>draw</code>, give each part a colour from a list: <code>colors[i % len(colors)]</code> with <code>for i, (x, y) in enumerate(snake):</code></li><li><b>Rocks:</b> make a list <code>ROCKS = [(4, 4), (11, 11)]</code>, draw them grey, and have <code>hits_wall</code> return True on them too.</li></ul>',
    concept: ['Everything', 'print, variables, maths, loops, if, lists, tuples, functions and return: that’s a real game, and real Python.'],
    starter: null,   // built from the toolkit
    solution: null,
    hints: [
      'Wrap-around step: <code>return ((x + 1) % 16, y)</code> for "right", and the same idea for the others.',
      'Rainbow draw: <code>colors = ["red", "orange", "yellow", "lime", "cyan", "blue", "purple"]</code> then <code>for i, (x, y) in enumerate(snake): pixel(x, y, colors[i % len(colors)])</code>',
    ],
  },
];

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
