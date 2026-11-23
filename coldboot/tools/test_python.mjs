// Differential tests: every program runs through PyVM (src/code/python.js) and through real CPython
// (`python3 -I -c`), and stdout must match exactly. For programs that fail, the exception type, the
// message line and the line number must match too. Then API tests for PyVM.call / defineNative /
// defineModuleObject / timeouts / performance.
//
//   node tools/test_python.mjs            run everything
//   node tools/test_python.mjs -v         also print passing case names
//   node tools/test_python.mjs dict       only cases whose name contains "dict"

import { spawnSync } from 'node:child_process';
import { PyVM, runPython, toPy, pyRepr } from '../src/code/python.js';

const args = process.argv.slice(2);
const VERBOSE = args.includes('-v');
const FILTER = args.find((a) => !a.startsWith('-')) || '';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function dedent(src) {
  const lines = src.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
  const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return lines.map((l) => l.slice(ind)).join('\n') + '\n';
}
const CASES = [];
// T(name, source[, opts]) — opts: { noLine: true } skips the line-number comparison
function T(name, src, opts = {}) { CASES.push({ name, src: opts.raw ? src : dedent(src), opts }); }

function runCPython(src) {
  const r = spawnSync('python3', ['-I', '-c', src], { encoding: 'utf8', input: '', timeout: 20000 });
  const out = { stdout: r.stdout, error: null };
  if (r.status !== 0) {
    const lines = r.stderr.trimEnd().split('\n');
    const last = lines[lines.length - 1];
    const m = /^(\w+)(?:: (.*))?$/.exec(last);
    let line = null;
    for (const l of lines) { const lm = /File "<string>", line (\d+)/.exec(l); if (lm) line = Number(lm[1]); }
    out.error = m ? { type: m[1], message: m[2] ?? '', line } : { type: '?', message: last, line };
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. print, strings, comments
// ---------------------------------------------------------------------------
T('print basic', String.raw`
  print("Hello, Port Zarya!")
  print('single', "double", 42, 3.5, True, None)
  print()
  print("a", "b", "c", sep="-")
  print("no newline", end="")
  print(" ... joined")
  print("x", end="\n\n")
  print(*[1, 2, 3], sep=", ", end="!\n")
`);
T('comments and blank lines', String.raw`
  # a comment

  x = 5  # trailing comment
      # indented comment line is fine
  print(x)  # and another
`);
T('string escapes', String.raw`
  print("tab:\tend")
  print('quote: \' and \"')
  print("backslash: \\")
  print("unicode: \u0416 \x41 \101")
  print(r"raw \n stays")
  print("line1\nline2")
  print('''triple
  quoted''')
  print("""double "triple" quotes""")
  print("implicit " "concat" ' works')
`);
T('string repr', String.raw`
  print(repr("it's"), repr('say "hi"'), repr('both \' and "'))
  print(repr('\n\t\\'), repr('\x00\x7f'), repr('Рыбка'), repr(''))
  print(['a', "b'c", 'd"e'])
  print(str('plain'), repr(5), repr(2.0), repr(None))
`);
T('string concat and repeat', String.raw`
  name = "Rybka"
  print("Hi, " + name + "!")
  print("ab" * 3, 3 * "-", "x" * 0, "y" * -2)
  print(len("Port Zarya"), len(""))
`);
T('unicode strings', String.raw`
  s = "Привет, Рыбка"
  print(s.upper(), s.lower(), len(s), s[0], s[-5:])
  print(ord("Ж"), chr(1046), "ß".upper())
`);

// ---------------------------------------------------------------------------
// 2. numbers & arithmetic
// ---------------------------------------------------------------------------
T('int arithmetic', String.raw`
  print(7 + 3, 7 - 3, 7 * 3, 7 / 2, 7 // 2, 7 % 3, 2 ** 10)
  print(-7 // 2, -7 % 3, 7 % -3, -7 // -2, 7 // -2)
  print(4 / 2, 1 / 3, 10 / 4, -10 / 4)
  print(2 ** -1, 2 ** 0, 0 ** 0, (-2) ** 3, -2 ** 2)
  print(1 + 2 * 3, (1 + 2) * 3, 2 ** 3 ** 2, 10 - 2 - 3, 100 // 10 // 3)
`);
T('big ints', String.raw`
  print(2 ** 100)
  print(2 ** 64 - 1, -(2 ** 70))
  x = 1
  for i in range(1, 31):
      x *= i
  print(x)
  print(x // 7, x % 1000007, x // -13, -x % 97)
  print(10 ** 20 + 1, 99999999999999999 + 1, 9007199254740993)
  print(2 ** 64 >> 3, (2 ** 64) ^ 1, 2 ** 53 + 1)
`);
T('float repr', String.raw`
  print(0.1 + 0.2, 2.5, 3.0, 1.5e-05, 1e16, 1e15, 1e-4, 1e-5)
  print(123456789012345678.0, 1/3, -0.0, 1e22, 2.0 ** 60, 100.0)
  print(float("inf"), float("-inf"), float("nan"), 1e300 * 1e10)
  print(3 * 1.1, 0.1 * 3, 1 - 0.9, 100 * 1.1, 1.15 * 100, 0.07 * 100)
  print(10 / 3, 2 / 3, 1e-10, 9.95 * 10, 2 ** 53 + 1.0, 1.7976931348623157e308, 5e-324)
`);
T('float arithmetic', String.raw`
  print(7.5 // 2, 7.5 % 2, -7.5 // 2, -7.5 % 2, 1 // 0.1, 1 % 0.1)
  print(2.0 ** 3, 4 ** 0.5, 2 ** 0.5, 10 ** -2, 1.5 * 2, 0.5 + 0.5)
  print(abs(-2.5), abs(-0.0), -(-1.5), +2.5, round(2.675, 2))
`);
T('bool arithmetic', String.raw`
  print(True + 1, True + True, True * 3, -True, True / 2, 3 // True)
  print(True & False, True | False, True ^ True, 1 == True, 0 == False)
  print(sum([True, True, False]), int(True), float(False), str(True))
`);
T('int float conversion', String.raw`
  print(int(3.99), int(-3.99), int("42"), int(" 42 "), int("-12"), int("+7"), int("1_000"))
  print(int("ff", 16), int("101", 2), int("0xff", 16), int("0xff", 0), int("0b101", 0), int("0o17", 0), int("077", 8), int("z", 36))
  print(float(3), float("3.5"), float(" 2 "), float("1e3"), float("-1.5e-3"), float("inf"), float("1_000.5"))
  print(str(3.0), str(10), str(-0.5), bool(0), bool(0.0), bool(""), bool(" "), bool([]), bool([0]))
`);
T('round banker', String.raw`
  print(round(2.5), round(3.5), round(-2.5), round(0.5), round(1.5), round(-0.5))
  print(round(2.675, 2), round(1.25, 1), round(1.35, 1), round(1234.5, -2), round(1250, -2), round(5, 2))
  print(round(3.14159, 2), round(10.0), round(-3.7), round(1e20), round(12345, -2), round(-12355, -1))
  print(round(2.5, 0), round(0.125, 2), round(7.0 / 3, 3), type(round(2.5)), type(round(2.5, 1)))
`);
T('divmod pow abs', String.raw`
  print(divmod(7, 2), divmod(-7, 2), divmod(7.5, 2), divmod(-7, -2))
  print(pow(2, 10), pow(2.0, 3), pow(2, 10, 1000), pow(3, -1, 7), pow(-2, 3), pow(2, -2))
  print(abs(-3), abs(3), abs(-2 ** 70), abs(True))
`);
T('bitwise', String.raw`
  print(5 ^ 3, 5 & 3, 5 | 3, ~5, ~-1, 1 << 10, 1024 >> 3, -1 >> 1, -16 >> 2, 255 ^ 23)
  x = 0b1010
  x ^= 0b0110
  x |= 1
  x &= 0b1111
  x <<= 2
  x >>= 1
  print(x, bin(x), hex(x), oct(x))
  print(hex(255), hex(-255), bin(5), bin(-5), oct(8), hex(0), bin(0))
`);
T('augmented assignment', String.raw`
  n = 10
  n += 5; print(n)
  n -= 3; print(n)
  n *= 2; print(n)
  n /= 4; print(n)
  n //= 2; print(n)
  n = 17
  n %= 5; print(n)
  n **= 3; print(n)
  s = "ab"
  s += "cd"
  s *= 2
  print(s)
  xs = [1]
  ys = xs
  xs += [2, 3]
  xs *= 2
  print(xs, ys, xs is ys)
  t = (1,)
  t += (2,)
  print(t)
`);

// ---------------------------------------------------------------------------
// 3. comparisons, booleans, truthiness
// ---------------------------------------------------------------------------
T('comparisons chained', String.raw`
  print(1 < 2 < 3, 3 > 2 > 2, 1 < 2 > 1.5, 1 == 1.0 == True, 'a' < 'b' < 'c')
  print([1, 2] < [1, 3], (1, 2) < (1, 2, 0), 'abc' < 'abd', 'Z' < 'a', [1, 2] == [1, 2.0], (1, 2) == (1, 2))
  print(2 >= 2, 2 <= 1, 3 != 3, 'x' != 'y', None == None, [] == [], {} == {}, {'a': 1} == {'a': 1})
  x = 5
  print(0 < x < 10, 0 < x < 5, x == 5 != 6)
`);
T('and or not', String.raw`
  print(1 if 2 else 3, [] or 'empty', 0 and 5, None or 0 or 'x', 5 and 0, 0 or [])
  print(not 0, not [], not 'a', not None, True and 'yes', False or 'no', 'a' and 'b' and 'c')
  def loud(v):
      print('eval', v)
      return v
  print(loud(0) and loud(1))
  print(loud(1) or loud(2))
`);
T('is in', String.raw`
  x = [1, 2, 3]
  y = x
  z = [1, 2, 3]
  print(x is y, x is z, x == z, x is not z, None is None)
  print(3 in x, 4 not in x, 'ell' in 'hello', 'z' in 'hello', 'a' in {'a': 1}, 1 in {'a': 1})
  print(2 in (1, 2), 5 in range(10), 10 in range(10), 4 in range(0, 10, 2), 3 in range(0, 10, 2))
`);
T('truthiness', String.raw`
  for v in [0, 1, -1, 0.0, 0.5, '', 'a', [], [0], (), (0,), {}, {'a': 1}, None, True, False, range(0), range(1)]:
      print(repr(v), bool(v), 'yes' if v else 'no')
`);

// ---------------------------------------------------------------------------
// 4. variables, assignment, unpacking
// ---------------------------------------------------------------------------
T('tuple unpacking', String.raw`
  a, b = 1, 2
  a, b = b, a
  print(a, b)
  (c, d), e = (3, 4), 5
  print(c, d, e)
  first, *rest = [1, 2, 3, 4]
  *init, last = "abc"
  h, *mid, t = range(5)
  print(first, rest, init, last, h, mid, t)
  x = y = z = 0
  print(x, y, z)
  [p, q] = "pq"
  print(p, q)
  for i, (k, v) in enumerate([('a', 1), ('b', 2)]):
      print(i, k, v)
`);
T('chained assignment aliasing', String.raw`
  x = y = []
  x.append(1)
  print(y)
  a = [1, 2]
  b = a[:]
  b.append(3)
  print(a, b)
`);

// ---------------------------------------------------------------------------
// 5. control flow
// ---------------------------------------------------------------------------
T('if elif else', String.raw`
  for n in [-5, 0, 3, 12, 100]:
      if n < 0:
          print(n, 'negative')
      elif n == 0:
          print(n, 'zero')
      elif n < 10:
          print(n, 'small')
      else:
          print(n, 'big')
  if True: print('one-liner')
  x = 7
  label = 'odd' if x % 2 else 'even'
  print(label)
`);
T('while loops', String.raw`
  n = 0
  while n < 5:
      n += 1
      if n == 2:
          continue
      if n == 4:
          break
      print('n =', n)
  else:
      print('never')
  m = 3
  while m > 0:
      m -= 1
  else:
      print('while-else ran', m)
  count = 0
  while True:
      count += 1
      if count >= 10:
          break
  print(count)
`);
T('for loops and range', String.raw`
  for i in range(3): print(i, end=' ')
  print()
  for i in range(2, 10, 3): print(i, end=' ')
  print()
  for i in range(10, 0, -3): print(i, end=' ')
  print()
  print(list(range(5)), list(range(-5)), list(range(1, 2)), list(range(0, -10, -4)), len(range(0, 100, 7)))
  print(range(3), range(1, 10, 2), range(10)[2], range(10)[-1], range(10)[2:5], list(range(10)[::3]))
  for ch in "hey": print(ch)
  for x in []:
      print('never')
  else:
      print('for-else')
  total = 0
  for i in range(1, 101):
      total += i
  print(total)
`);
T('nested loops break continue', String.raw`
  for i in range(4):
      for j in range(4):
          if j > i:
              break
          if (i + j) % 2:
              continue
          print(i, j)
  found = None
  for row in [[1, 2], [3, 4], [5, 6]]:
      for v in row:
          if v == 4:
              found = v
              break
      if found:
          break
  print('found', found)
`);
T('pass and ellipsis', String.raw`
  def todo():
      pass
  def later():
      ...
  print(todo(), later(), ...)
  if True:
      pass
  print('ok')
`);

// ---------------------------------------------------------------------------
// 6. functions
// ---------------------------------------------------------------------------
T('def defaults keywords', String.raw`
  def greet(name, greeting="Hello", punct="!"):
      return greeting + ", " + name + punct
  print(greet("Dolly"))
  print(greet("Hank", "Hi"))
  print(greet("Ruth", punct="?"))
  print(greet(punct=".", name="Ray", greeting="Evening"))
  def nothing():
      x = 1
  print(nothing())
`);
T('recursion', String.raw`
  def fact(n):
      if n <= 1:
          return 1
      return n * fact(n - 1)
  def fib(n):
      return n if n < 2 else fib(n - 1) + fib(n - 2)
  print(fact(10), fact(20), fact(25))
  print([fib(i) for i in range(15)])
  def countdown(n):
      if n == 0:
          print('liftoff')
          return
      print(n)
      countdown(n - 1)
  countdown(3)
`);
T('star args kwargs', String.raw`
  def f(*args, **kw):
      return args, kw
  print(f(1, 2, a=3))
  print(f())
  def g(a, b=2, *rest, c, d=4, **more):
      print(a, b, rest, c, d, more)
  g(1, c=3)
  g(1, 2, 3, 4, c=5, d=6, e=7)
  nums = [3, 1, 2]
  print(*nums)
  print(max(*nums), sorted(nums))
  opts = {'sep': '|', 'end': '<\n'}
  print('a', 'b', **opts)
`);
T('closures nonlocal global', String.raw`
  count = 0
  def bump():
      global count
      count += 1
  bump(); bump()
  print(count)
  def make_counter():
      n = 0
      def inc():
          nonlocal n
          n += 1
          return n
      return inc
  c = make_counter()
  c(); c()
  print(c())
  def outer(x):
      def inner(y):
          return x + y
      return inner
  add5 = outer(5)
  print(add5(10), outer(1)(1))
  def shadow():
      count = 100
      return count
  print(shadow(), count)
`);
T('lambda sort key', String.raw`
  square = lambda x: x * x
  print(square(7))
  pairs = [(2, 'b'), (1, 'z'), (2, 'a'), (3, 'c')]
  print(sorted(pairs))
  print(sorted(pairs, key=lambda p: p[1]))
  print(sorted(pairs, key=lambda p: (-p[0], p[1])))
  words = ['banana', 'Apple', 'cherry', 'date']
  print(sorted(words), sorted(words, key=str.lower), sorted(words, key=len, reverse=True))
  target = 10
  print(sorted([3, 14, 9, 11], key=lambda n: abs(n - target)))
  print(list(map(lambda a, b: a + b, [1, 2], [3, 4])))
`);
T('mutable default gotcha', String.raw`
  def add(item, bucket=[]):
      bucket.append(item)
      return bucket
  print(add(1), add(2))
  def add2(item, bucket=None):
      if bucket is None:
          bucket = []
      bucket.append(item)
      return bucket
  print(add2(1), add2(2))
`);
T('docstring and help-free introspection', String.raw`
  def f(a, b):
      """Adds two numbers."""
      return a + b
  print(f.__doc__, f.__name__, f(2, 3))
  print(type(f).__name__, callable(f), callable(5))
`);
T('functions as values', String.raw`
  def double(x): return x * 2
  def apply_twice(fn, v): return fn(fn(v))
  print(apply_twice(double, 3))
  ops = {'dbl': double, 'neg': lambda v: -v}
  print(ops['dbl'](4), ops['neg'](4))
  print(list(map(double, [1, 2, 3])), list(filter(lambda n: n > 1, [0, 1, 2, 3])))
`);

// ---------------------------------------------------------------------------
// 7. lists
// ---------------------------------------------------------------------------
T('list basics', String.raw`
  fish = ['cod', 'salmon', 'halibut', 'crab']
  print(fish[0], fish[-1], fish[1:3], fish[:2], fish[2:], fish[-2:], fish[::-1], fish[::2])
  print(len(fish), 'crab' in fish, fish.index('halibut'), fish.count('cod'))
  fish.append('pollock')
  fish.insert(0, 'herring')
  fish.insert(100, 'end')
  fish.insert(-1, 'nearly')
  print(fish)
  print(fish.pop(), fish.pop(0), fish.pop(-2), fish)
  fish.remove('cod')
  print(fish)
  fish.extend(['a', 'b'])
  fish.extend('xy')
  print(fish)
`);
T('list sort reverse copy clear', String.raw`
  nums = [5, 3, 8, 1, 9, 2]
  nums.sort()
  print(nums)
  nums.sort(reverse=True)
  print(nums)
  nums.reverse()
  print(nums)
  copy = nums.copy()
  nums.clear()
  print(nums, copy)
  words = ['pear', 'Fig', 'apple', 'kiwi']
  words.sort(key=len)
  print(words)
  y = [3, 1, 2]
  z = y.sort()
  print(y, z)
  people = [('Ruth', 71), ('Tommy', 19), ('Dolly', 58), ('Hank', 58)]
  people.sort(key=lambda p: p[1])
  print(people)
  people.sort(key=lambda p: p[1], reverse=True)
  print(people)
`);
T('list slicing all', String.raw`
  s = list(range(10))
  print(s[2:8:2], s[8:2:-2], s[::-3], s[-3:-1], s[-1:-4:-1], s[5:5], s[100:], s[-100:3])
  print(s[1:-1:3], s[::], s[:-7:-2], s[3::-1], s[:3:-1])
  s[2:5] = ['a', 'b']
  print(s)
  s[::3] = [0, 0, 0]
  print(s)
  del s[1:3]
  print(s)
  del s[::2]
  print(s)
  s[0:0] = [9, 9]
  print(s)
  s[:] = []
  print(s)
`);
T('list ops', String.raw`
  print([1, 2] + [3], [0] * 5, [[0] * 2] * 2, [1, 2] * 0, 2 * ['a'])
  grid = [[0] * 3 for _ in range(3)]
  grid[1][1] = 5
  print(grid)
  print(max([3, 7, 2]), min([3, 7, 2]), sum([3, 7, 2]), sorted([3, 7, 2]), list(reversed([3, 7, 2])))
  xs = [4, 5, 6]
  del xs[0]
  print(xs)
  xs[-1] = 60
  print(xs, xs == [5, 60], xs != [5, 60], [1, [2, 3]] == [1, [2, 3]])
  print(list('abc'), list((1, 2)), list(range(3)), list({'k': 1, 'j': 2}))
`);
T('list comprehensions', String.raw`
  print([x * x for x in range(6)])
  print([x for x in range(20) if x % 3 == 0 if x % 2 == 0])
  print([(i, j) for i in range(3) for j in range(3) if i != j])
  print([c.upper() for c in "fish" if c != 'i'])
  print([[r * 3 + c for c in range(3)] for r in range(3)])
  words = ['cod', 'salmon', 'crab']
  print([len(w) for w in words], [w for w in words if w.startswith('c')])
  x = 'outer'
  print([x for x in range(3)], x)
`);
T('dict set comprehensions genexp', String.raw`
  print({w: len(w) for w in ['cod', 'salmon', 'crab']})
  print({k: v for k, v in [('a', 1), ('b', 2)]})
  print(sorted({x % 3 for x in range(10)}))
  print(sum(x * x for x in range(5)), any(c.isdigit() for c in 'ab3'), all(n > 0 for n in [1, 2]))
  print(''.join(c for c in 'hello' if c != 'l'), max(len(w) for w in ['a', 'bbb', 'cc']))
  g = (x * 2 for x in range(3))
  print(next(g), list(g), list(g))
  print(list(zip(*[(1, 'a'), (2, 'b')])))
`);
T('nested data', String.raw`
  council = [
      {'name': 'Dolly Finch', 'votes': 312, 'business': 'diner'},
      {'name': 'Hank Brubaker', 'votes': 288, 'business': 'hardware'},
      {'name': 'Ruth Aqpik', 'votes': 401, 'business': None},
      {'name': 'Ray Moody', 'votes': 175, 'business': 'cannery'},
      {'name': 'Lyle Pruitt', 'votes': 290, 'business': 'insurance'},
  ]
  for m in sorted(council, key=lambda m: m['votes'], reverse=True):
      print(f"{m['name']:<15}{m['votes']:>5}")
  top = max(council, key=lambda m: m['votes'])
  print(top['name'], sum(m['votes'] for m in council))
  owners = [m['name'].split()[0] for m in council if m['business']]
  print(owners)
`);

// ---------------------------------------------------------------------------
// 8. strings deeper
// ---------------------------------------------------------------------------
T('str methods case', String.raw`
  s = "  Hello, Port Zarya  "
  print(s.upper(), s.lower(), s.strip(), s.lstrip() + '|', '|' + s.rstrip())
  print("hello world".title(), "they're bill's".title(), "hello WORLD".capitalize(), "Hello".swapcase())
  print("xxhixx".strip('x'), "abcba".strip('ab'), "--a--".lstrip('-'), "--a--".rstrip('-'))
  print("ABC".isupper(), "abc1".islower(), "Abc Def".istitle(), "abc".isalpha(), "a1".isalnum(), "12".isdigit(), "1.5".isdigit(), "".isdigit(), " \t".isspace(), "".isspace())
`);
T('str methods search', String.raw`
  s = "Mississippi"
  print(s.find('ss'), s.rfind('ss'), s.find('x'), s.index('ss', 3), s.count('ss'), s.count('i'), s.count(''))
  print(s.startswith('Miss'), s.endswith('pi'), s.startswith(('x', 'M')), s.find('s', 4, 6), s.rindex('i'))
  print(s.replace('ss', 'SS'), s.replace('i', '!', 2), 'ab'.replace('', '-'), s.replace('zz', 'x'))
  print(s.partition('ss'), s.rpartition('ss'), s.partition('zz'))
`);
T('str split join', String.raw`
  print('a,b,,c'.split(','), '  a  b  '.split(), 'a b c'.split(None, 1), 'a,b,c'.rsplit(',', 1), 'a b c '.split(None, 1))
  print('one two three'.split(' '), 'x'.split(','), ''.split(), ''.split(','), 'a-b-c'.split('-', maxsplit=1))
  print('-'.join(['a', 'b', 'c']), ''.join(['x', 'y']), ', '.join('abc'), ' '.join(str(n) for n in [1, 2, 3]))
  print('line1\nline2\r\nline3'.splitlines(), 'a\n\nb\n'.splitlines())
  csv = "Dolly,58,diner"
  name, age, job = csv.split(",")
  print(name, int(age) + 1, job.upper())
`);
T('str padding', String.raw`
  print('ab'.center(5) + '|', 'ab'.center(6) + '|', 'abc'.center(6) + '|', 'a'.center(4, '*'), 'abc'.center(9, '*'))
  print('abc'.ljust(6, '.') + '|', 'abc'.rjust(6) + '|', '42'.zfill(5), '-42'.zfill(5), '+7'.zfill(3), 'abcdef'.zfill(3))
`);
T('str slicing', String.raw`
  s = "abcdef"
  print(s[::-1], s[1:4], s[-2:], s[:-2], s[::2], s[10:], s[-100:2], s[5:1:-1], s[-1], s[0])
  word = "racecar"
  print(word == word[::-1], "rybka"[::-1], "port"[1:], "port"[:-1])
  for i in range(len(s)):
      if i % 2 == 0:
          print(s[i], end='')
  print()
`);
T('str format method', String.raw`
  print('{} and {}'.format('a', 'b'), '{0}{1}{0}'.format('x', 'y'), '{name} is {age}'.format(name='Valya', age=78))
  print('{:>6.2f}|'.format(3.14159), '{0[1]}'.format([5, 6]), '{:<8}|{:^8}|{:>8}|'.format('a', 'b', 'c'))
  print('{:08.3f}'.format(-3.14159), '{:,}'.format(10 ** 9), '{:e}'.format(0), '{{literal}} {}'.format(1), '{!r}'.format('x'))
`);
T('percent format', String.raw`
  print('%s has %d fish (%.1f%%)' % ('Hank', 12, 45.678))
  print('%5s|%-5s|' % ('a', 'b'), '%r' % 'x', '%05.1f' % 3.14159, '%x %o %e' % (255, 8, 12345.678), '%d' % 1.9, '%i' % 3)
  print('%5.2f|%-6d|%+d|%x|%X|%o|%e|%g|%c|%%' % (3.14159, 42, 5, 255, 255, 8, 0.00012, 0.00012, 65))
  print('%s' % [1, 2], '%s' % (1,), '%(a)s-%(b)s' % {'a': 1, 'b': 2}, '%3d|%-3d|%03d' % (5, 5, 5))
`);
T('fstrings', String.raw`
  name, n, price = "Rybka", 42, 3.14159
  print(f"Hi {name}! {n} fish at {price:.2f} each = {n * price:.2f}")
  print(f"{n:05d}|{n:>5}|{n:<5}|{n:^5}|{name!r}|{name:>8}|{name:*^9}")
  print(f"{1234567:,}|{1234567.891:,.2f}|{255:x}|{255:#x}|{255:08b}|{-42:+d}|{42:+d}|{3:<4}|")
  print(f"{3.0}|{1e20}|{1/3:.3}|{1234.5:.3}|{0.5:.0f}|{1.5:.0f}|{2.5:.0f}|{-1.5:.0f}|{1e-5:.2e}")
  print(f"{12:o}|{65:c}|{0.25:%}|{-5:05d}|{5:+05d}|{1234.5678:_.2f}|{123:=+8}|{0.125:.2f}|{1.005:.2f}")
  x = 5
  print(f"{x=}", f"{x = }", f"{x*2=:>5}", f"{'nested ' + 'quotes'}", f"{'a' if x > 3 else 'b'}", f"{{x}}")
  print(f"{[1, 2][0]}", f"{ {'k': 'v'}['k'] }", f"{'%.1f' % 2.25}", f"{2.25:.1f}", f'{x!s:>3}|')
  w = 8
  print(f"{price:{w}.{2}f}|", f"{'ab':>{w}}|")
`);
T('format builtin', String.raw`
  print(format(3.14159, '.3f'), format(42, 'b'), format(1234, ','), format('x', '>4'), format(True, ''), format(True, 'd'), format(0.5, '%'))
  print(format(1e16, ''), format(123.0, '10'), format(1.5, '.3'), format(2.0, '.3'), format(1234.5, '.3'), format(123.0, '.3'))
  print(format(1234567.0, 'g'), format(0.00001234, 'g'), format(100000000, 'g'), format(1.0, 'g'), format(0.0001, 'g'))
  print(format(12345.678, '.2e'), format(-0.0, '.1f'), format(5, '.2f'), format(1234, '09,'), format(-1234.5, '012,.1f'))
`);
T('caesar and ord chr', String.raw`
  def shift(text, k):
      out = ''
      for c in text:
          if c.isalpha() and c.isupper():
              out += chr((ord(c) - ord('A') + k) % 26 + ord('A'))
          elif c.isalpha():
              out += chr((ord(c) - ord('a') + k) % 26 + ord('a'))
          else:
              out += c
      return out
  secret = shift("Meet at the Dome, Rybka!", 3)
  print(secret)
  print(shift(secret, -3))
  print([ord(c) for c in "AZaz09"], ''.join(chr(c) for c in [80, 121]))
`);
T('xor cipher', String.raw`
  key = 23
  msg = "WORMWOOD"
  enc = ''.join(chr(ord(c) ^ key) for c in msg)
  print(repr(enc))
  dec = ''.join(chr(ord(c) ^ key) for c in enc)
  print(dec, [ord(c) ^ key for c in "AB"], 65 ^ 23 ^ 23)
`);

// ---------------------------------------------------------------------------
// 9. dicts
// ---------------------------------------------------------------------------
T('dict basics', String.raw`
  prices = {'cod': 4.5, 'crab': 12, 'salmon': 9.25}
  print(prices, prices['crab'], len(prices), 'cod' in prices, 4.5 in prices)
  prices['halibut'] = 15
  prices['cod'] = 5
  print(prices)
  print(prices.get('tuna'), prices.get('tuna', 0), prices.get('crab', 0))
  del prices['crab']
  print(prices, list(prices), list(prices.keys()), list(prices.values()), list(prices.items()))
  print(prices.keys(), prices.values(), prices.items())
  print(prices.pop('salmon'), prices.pop('nope', 'default'), prices)
  print(prices.setdefault('cod', 99), prices.setdefault('eel', 1), prices)
`);
T('dict iteration order', String.raw`
  d = {}
  d['zeta'] = 1
  d['alpha'] = 2
  d[3] = 'three'
  d[(1, 2)] = 'tuple key'
  d[None] = 'none'
  d[2.5] = 'float'
  for k in d:
      print(k, d[k])
  for k, v in d.items():
      print(k, '->', v)
  d['zeta'] = 'updated'
  print(d)
  del d['zeta']
  d['zeta'] = 'back'
  print(list(d))
  print({1: 'a', 1.0: 'b', True: 'c'}, {0: 'x', False: 'y'})
`);
T('dict counting', String.raw`
  counts = {}
  for w in 'the cat the dog the end cat'.split():
      counts[w] = counts.get(w, 0) + 1
  print(counts)
  print(max(counts, key=counts.get), sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])))
  letters = {}
  for c in "banana":
      if c in letters:
          letters[c] += 1
      else:
          letters[c] = 1
  print(letters)
`);
T('dict methods', String.raw`
  a = {'x': 1, 'y': 2}
  b = a.copy()
  b['z'] = 3
  a.update({'y': 20, 'w': 0})
  a.update(v=5)
  print(a, b)
  print(dict(a=1, b=2), dict([('k', 'v'), ('j', 'w')]), dict(zip('abc', range(3))), dict.fromkeys(['p', 'q'], 0))
  print(a.popitem(), a)
  b.clear()
  print(b, len(b), {**a, 'new': 1})
  nested = {'dolly': {'diner': 'Midnight Sun', 'votes': 312}}
  nested['dolly']['votes'] += 1
  print(nested['dolly']['votes'], nested)
  print({'a': 1} | {'b': 2})
`);

// ---------------------------------------------------------------------------
// 10. tuples & sets
// ---------------------------------------------------------------------------
T('tuples', String.raw`
  t = (1, 'two', 3.0)
  print(t, t[1], t[-1], t[:2], len(t), (1,), (), tuple([1, 2]), tuple('ab'))
  print(t + (4,), (0,) * 3, t.count(1), t.index('two'), 3.0 in t, (1, 2) < (1, 3), max((3, 9, 2)))
  x, y, z = t
  print(x, y, z)
  coords = {(0, 0): 'origin', (1, 2): 'dome'}
  print(coords[(1, 2)], coords[1, 2])
  single = 5,
  print(single, type(single))
`);
T('sets', String.raw`
  a = {1, 2, 3}
  b = {2, 3, 4}
  print(sorted(a | b), sorted(a & b), sorted(a - b), sorted(a ^ b))
  print(sorted(a.union(b)), sorted(a.intersection(b)), sorted(a.difference(b)), sorted(a.symmetric_difference(b)))
  a.add(10)
  a.discard(1)
  a.discard(99)
  a.remove(2)
  print(sorted(a), len(a), 3 in a, 4 in a, {1, 2} <= {1, 2, 3}, {1, 2} < {1, 2}, set() == set())
  names = ['Ruth', 'Hank', 'Ruth', 'Dolly', 'Hank']
  print(sorted(set(names)), len(set(names)), set(), {1, 2, 3})
  s = set()
  for c in "hello":
      s.add(c)
  print(sorted(s))
`);

// ---------------------------------------------------------------------------
// 11. builtins
// ---------------------------------------------------------------------------
T('builtins misc', String.raw`
  print(len([1, 2]), len('abc'), len({'a': 1}), len((1,)), len(range(5)), len(set('aab')))
  print(min(3, 1, 2), max('apple', 'pear', key=len), min([], default=0), max([1, -5, 3], key=abs), min('hello'))
  print(sum([1, 2, 3]), sum([1, 2], 10), sum([0.1] * 10), sum([1, 0.1, 0.2]), sum([0.1, 0.2, 0.3]), sum([1e100, 1.0, -1e100]), sum([], 0.0))
  print(sorted('hello'), sorted([3, 1, 2], reverse=True), sorted({'b': 1, 'a': 2}), list(reversed('abc')), list(reversed(range(3))))
  print(list(enumerate('ab')), list(enumerate('ab', 1)), list(zip([1, 2, 3], 'ab')), list(zip()), dict(enumerate('xy')))
  print(any([]), all([]), any([0, '', None]), all([1, 'a']), any(x > 2 for x in [1, 3]))
  print(list(map(int, '1 2 3'.split())), list(filter(None, [0, 1, '', 'a'])), list(map(str.upper, ['a', 'b'])))
  print(chr(65), ord('A'), hex(255), bin(10), oct(64), abs(-7), round(3.7), divmod(17, 5), pow(2, 8))
`);
T('isinstance type', String.raw`
  for v in [1, 1.0, 'a', [], (), {}, set(), None, True, range(3), len, print]:
      print(type(v), type(v).__name__)
  print(isinstance(True, int), isinstance(1, (str, float)), isinstance([], list), isinstance('x', (int, str)), isinstance(1.0, int))
  print(type(1) == int, type('a') is str, type(type(1)), int, list, type(None).__name__, int.__name__)
  def f(): pass
  print(type(f), type(lambda: 0).__name__)
`);
T('str repr builtins', String.raw`
  print(str([1, 'two', 3.0]), str((1, 'a')), str({'k': 'v'}), repr('a'), repr([None]), str(None))
  print(repr(1.0), repr(-0.0), repr(1e100), str(10 ** 30), repr((1,)), repr(()), repr({}), repr(set()))
  print(ascii('Рыбка'), repr(range(0, 5, 2)), int, float('-inf'))
`);
T('iter next', String.raw`
  it = iter([1, 2, 3])
  print(next(it), next(it), next(it), next(it, 'done'))
  e = enumerate(['a', 'b'])
  print(next(e), list(e))
  z = zip('ab', 'cd')
  print(list(z), list(z))
  m = map(lambda x: x + 1, [1, 2])
  print(list(m))
  r = reversed([1, 2, 3])
  print(next(r), list(r))
`);

// ---------------------------------------------------------------------------
// 12. exceptions
// ---------------------------------------------------------------------------
T('try except else finally', String.raw`
  try:
      1 / 0
  except ZeroDivisionError as e:
      print('caught', e, type(e).__name__, repr(e), e.args)
  finally:
      print('done')
  try:
      int('x')
  except (TypeError, ValueError) as e:
      print(e)
  else:
      print('no')
  try:
      x = int('5')
  except ValueError:
      print('bad')
  else:
      print('else ran', x)
  def f():
      try:
          return 1
      finally:
          print('fin')
  print(f())
  for i in range(3):
      try:
          if i == 1:
              continue
          print(i)
      finally:
          print('f', i)
`);
T('exception objects', String.raw`
  try:
      raise ValueError('a', 2)
  except Exception as e:
      print(e, e.args, str(e), repr(e))
  try:
      [][1]
  except LookupError as e:
      print(type(e), e)
  try:
      {}['k']
  except KeyError as e:
      print(e, repr(e), str(e))
  try:
      raise KeyError
  except KeyError as e:
      print(repr(e), e.args)
  try:
      try:
          1 / 0
      except ZeroDivisionError:
          print('inner')
          raise
  except ArithmeticError as e:
      print('outer', e)
  err = RuntimeError('stored')
  print(isinstance(err, Exception), isinstance(err, RuntimeError), str(err))
`);
T('except bare and order', String.raw`
  def risky(n):
      if n == 0: raise ValueError('zero')
      if n == 1: raise TypeError('one')
      if n == 2: return 1 / 0
      return [n][5]
  for n in range(4):
      try:
          risky(n)
      except ValueError as e:
          print('V', e)
      except (TypeError, ZeroDivisionError) as e:
          print('T/Z', type(e).__name__, e)
      except:
          print('other')
`);
T('assert', String.raw`
  assert 1 + 1 == 2
  assert True, 'fine'
  try:
      assert 2 + 2 == 5, 'math broke'
  except AssertionError as e:
      print('caught:', e)
  print('ok')
`);

// ---------------------------------------------------------------------------
// 13. misc language
// ---------------------------------------------------------------------------
T('del statement', String.raw`
  x = 5
  del x
  try:
      print(x)
  except NameError as e:
      print(e)
  d = {'a': 1, 'b': 2}
  del d['a']
  xs = [1, 2, 3]
  del xs[-1]
  print(d, xs)
`);
T('main guard and dunder name', String.raw`
  def main():
      print('running main')
  if __name__ == "__main__":
      main()
  print(__name__)
`);
T('walrus and ternary', String.raw`
  data = [1, 5, 12, 3]
  if (n := len(data)) > 3:
      print('long', n)
  print([y for x in data if (y := x * 2) > 5])
  print('even' if n % 2 == 0 else 'odd')
`);
T('line continuation', String.raw`
  total = 1 + \
          2 + \
          3
  items = [
      'cod',
      'crab',   # comment inside brackets
  ]
  text = ("multi"
          "line")
  print(total, items, text, {
      'k': 1,
  })
`);
T('semicolons and one-line bodies', String.raw`
  a = 1; b = 2; print(a + b)
  for i in range(2): print(i); print('x')
  while False: pass
  def f(x): return x * 2
  print(f(4))
`);
T('global scope from functions', String.raw`
  fish = []
  def catch(name):
      fish.append(name)
  catch('cod'); catch('crab')
  print(fish)
  total = 10
  def read_total():
      return total * 2
  print(read_total())
`);
T('import math', String.raw`
  import math
  print(math.sqrt(16), math.floor(3.7), math.ceil(3.2), math.pi, math.gcd(12, 18), math.factorial(10))
  print(math.isqrt(17), math.hypot(3, 4), math.trunc(-3.7), math.fabs(-2), math.log10(1000), math.log2(8), math.log(math.e))
  from math import sqrt, pi as PI
  print(sqrt(2), PI, math.inf, -math.inf, math.isclose(0.1 + 0.2, 0.3), math.comb(5, 2), math.perm(5, 2), math.prod([1, 2, 3, 4]))
  print(math.fsum([0.1] * 10), math.copysign(3, -1), math.degrees(math.pi), math.floor(-0.5), math.lcm(4, 6))
`);
T('import string', String.raw`
  import string
  print(string.ascii_lowercase, string.ascii_uppercase, string.digits)
  print(string.ascii_letters[:5], len(string.punctuation), string.capwords('hello  port zarya'))
`);
T('big loop result', String.raw`
  total = 0
  for i in range(100000):
      total += i * i % 7
  print(total)
`);

// ---------------------------------------------------------------------------
// 14. runtime errors (type + message + line must match)
// ---------------------------------------------------------------------------
const ERR = (name, src, opts) => T('error: ' + name, src, opts);
ERR('NameError', `print("start")\nprint(totl)\n`);
ERR('NameError suggestion', `total = 1\nprint(totl)\n`);
ERR('NameError true', `x = true\n`);
ERR('NameError in function', `def f():\n    count = 0\n    return cont\nf()\n`);
ERR('NameError builtin typo', `pritn("hi")\n`);
ERR('NameError forgot import', `print(math.pi)\n`);
ERR('UnboundLocalError', `count = 0\ndef bump():\n    count += 1\nbump()\n`);
ERR('str + int', `n = 5\nprint("fish: " + n)\n`);
ERR('int + str', `print(1 + "a")\n`);
ERR('not callable', `x = 5\nx()\n`);
ERR('shadowed sum', `sum = 0\nfor i in range(3):\n    sum += i\nprint(sum([1, 2]))\n`);
ERR('not subscriptable', `x = 5\nprint(x[0])\n`);
ERR('None subscript', `def f():\n    pass\nr = f()\nprint(r[0])\n`);
ERR('not iterable', `for i in 5:\n    print(i)\n`);
ERR('too many args', `def f(a):\n    return a\nf(1, 2)\n`);
ERR('missing args', `def f(a, b):\n    return a\nf()\n`);
ERR('missing 3 args', `def f(a, b, c):\n    return a\nf()\n`);
ERR('unexpected kw', `def f(a):\n    return a\nf(b=1)\n`);
ERR('multiple values', `def f(a):\n    return a\nf(1, a=2)\n`);
ERR('defaults range msg', `def f(a, b=1):\n    return a\nf(1, 2, 3)\n`);
ERR('nested qualname', `def outer():\n    def inner(a): pass\n    inner()\nouter()\n`);
ERR('lambda args', `f = lambda a: a\nf()\n`);
ERR('compare str int', `print(1 < 'a')\n`);
ERR('sort mixed', `print(sorted([1, 'a']))\n`);
ERR('max mixed', `print(max(1, 'a'))\n`);
ERR('list index float', `xs = [1, 2]\nprint(xs[1.0])\n`);
ERR('str index str', `s = 'abc'\nprint(s['a'])\n`);
ERR('str item assignment', `s = 'abc'\ns[0] = 'x'\n`);
ERR('tuple item assignment', `t = (1, 2)\nt[0] = 5\n`);
ERR('seq times str', `print('5' * '5')\n`);
ERR('unhashable', `d = {[1]: 2}\n`);
ERR('join non-str', `print(', '.join([1, 2]))\n`);
ERR('len int', `print(len(5))\n`);
ERR('int of list', `int([1])\n`);
ERR('abs str', `abs('x')\n`);
ERR('neg str', `print(-'x')\n`);
ERR('in string int', `print(5 in 'abc')\n`);
ERR('in int', `print('x' in 5)\n`);
ERR('augmented type error', `x = 3\nx += 'a'\n`);
ERR('None plus', `x = None\nx += 1\n`);
ERR('list plus tuple', `print([1, 2] + (3,))\n`);
ERR('range float', `for i in range(2.5):\n    pass\n`);
ERR('chr float', `chr(65.0)\n`);
ERR('unpack non-iterable', `a, b = 5\n`);
ERR('ZeroDivisionError', `print(1 / 0)\n`);
ERR('int floordiv zero', `print(10 // 0)\n`);
ERR('int mod zero', `print(10 % 0)\n`);
ERR('float div zero', `print(1.0 / 0)\n`);
ERR('zero negative power', `print(0 ** -1)\n`);
ERR('IndexError list', `fish = ['cod']\nprint(fish[1])\n`);
ERR('IndexError str', `print('abc'[10])\n`);
ERR('IndexError assign', `xs = [1]\nxs[5] = 2\n`);
ERR('pop empty', `[].pop()\n`);
ERR('pop index', `[1].pop(5)\n`);
ERR('KeyError', `d = {'a': 1}\nprint(d['b'])\n`);
ERR('KeyError int', `d = {}\nd[5]\n`);
ERR('set remove', `s = set()\ns.remove(1)\n`);
ERR('ValueError int', `int('abc')\n`);
ERR('ValueError int float str', `int('3.5')\n`);
ERR('ValueError float', `float('abc')\n`);
ERR('ValueError index', `[1, 2, 3].index(5)\n`);
ERR('ValueError remove', `[1].remove(5)\n`);
ERR('ValueError substring', `'abc'.index('z')\n`);
ERR('unpack too many', `a, b = [1, 2, 3]\n`);
ERR('unpack too few', `a, b, c = [1, 2]\n`);
ERR('unpack star too few', `a, *b, c = [1]\n`);
ERR('max empty', `print(max([]))\n`);
ERR('empty separator', `'abc'.split('')\n`);
ERR('chr range', `chr(-1)\n`);
ERR('ord long', `ord('ab')\n`);
ERR('int base', `int('12', 1)\n`);
ERR('int non-string base', `int(5, 10)\n`);
ERR('AttributeError push', `xs = []\nxs.push(1)\n`);
ERR('AttributeError suggestion', `xs = []\nxs.apend(1)\n`);
ERR('AttributeError str', `'abc'.uper()\n`);
ERR('AttributeError None', `x = [3, 1].sort()\nx.append(1)\n`);
ERR('AttributeError dict', `d = {}\nd.has_key('a')\n`);
ERR('AttributeError module', `import math\nmath.sqroot(4)\n`);
ERR('AttributeError int', `x = 5\nx.append(3)\n`);
ERR('math domain', `import math\nmath.sqrt(-1)\n`);
ERR('ModuleNotFoundError', `import numpy_not_here\n`);
ERR('ImportError name', `from math import sqr\n`);
ERR('RecursionError', `def f(n):\n    return f(n + 1)\nf(0)\n`);
ERR('assert fail', `x = 3\nassert x > 5\n`);
ERR('assert fail msg', `assert 1 == 2, 'numbers disagree'\n`);
ERR('raise ValueError', `raise ValueError('bad value')\n`);
ERR('raise class', `raise KeyError\n`);
ERR('raise KeyError msg', `raise KeyError('k')\n`);
ERR('dict changed size', `d = {'a': 1}\nfor k in d:\n    d['b'] = 2\n`);
ERR('print sep type', `print(1, sep=5)\n`);
ERR('format unknown code', `print(format('a', '>5d'))\n`);
ERR('format int s', `print(format(1, 's'))\n`);
ERR('format None', `print(format(None, '5'))\n`);
ERR('percent not enough', `print('%s %s' % (1,))\n`);
ERR('percent too many', `print('%s' % (1, 2))\n`);
ERR('percent type', `print('%d' % 'x')\n`);
ERR('format index', `print('{} {}'.format(1))\n`);
ERR('method arg count', `'abc'.upper(1)\n`);
ERR('append no arg', `[].append()\n`);
ERR('insert arg count', `[].insert(1)\n`);
ERR('replace arg count', `'abc'.replace('a')\n`);
ERR('sort positional', `[3, 1].sort(len)\n`);
ERR('builtin arg counts', `len()\n`);
ERR('range no args', `range()\n`);
ERR('sum no args', `sum()\n`);
ERR('round no args', `round()\n`);
ERR('round str', `round('a')\n`);
ERR('isinstance one arg', `isinstance(1)\n`);
ERR('error after output', `for i in range(3):\n    print('fish', i)\nprint(fish)\n`);
ERR('error deep in call', `def a(x):\n    return b(x) + 1\ndef b(x):\n    return x / 0\nprint(a(5))\n`);
ERR('error multiline expr', `total = (1 +\n         'a')\n`);
ERR('next exhausted', `it = iter([])\nnext(it)\n`);
ERR('getitem on set', `s = {1, 2}\ns[0]\n`);
ERR('dict update seq', `dict([[1, 2, 3]])\n`);
ERR('float int conversion overflow', `int(float('inf'))\n`);
ERR('str repeat float', `print('ab' * 2.5)\n`);
ERR('ValueError slice step', `print([1, 2][::0])\n`);
ERR('range step zero', `range(1, 5, 0)\n`);
ERR('str index method', `'abc'.count()\n`);
ERR('zero division in comprehension', `print([10 // x for x in [2, 1, 0]])\n`);
ERR('key error in nested function', `def lookup(d, k):\n    return d[k]\nprices = {'cod': 4}\nprint(lookup(prices, 'crab'))\n`);
ERR('exception in lambda key', `print(sorted([1, 2], key=lambda x: x / 0))\n`);
ERR('negative shift', `print(1 << -1)\n`);
ERR('call str', `name = 'Rybka'\nname()\n`);
ERR('unbound in nested if', `def f(flag):\n    if flag:\n        result = 1\n    return result\nprint(f(False))\n`);
ERR('tuple index msg', `(1, 2).index(3)\n`);

// ---------------------------------------------------------------------------
// 15. syntax / indentation errors
// ---------------------------------------------------------------------------
const SYN = (name, src) => T('syntax: ' + name, src, { raw: true });
SYN('missing colon if', `x = 1\nif x == 1\n    print(x)\n`);
SYN('missing colon for', `for i in range(10)\n    print(i)\n`);
SYN('missing colon def', `def f()\n    pass\n`);
SYN('missing colon while', `while True\n    pass\n`);
SYN('missing colon else', `if x:\n    pass\nelse\n    pass\n`);
SYN('missing colon try', `try\n    pass\nexcept:\n    pass\n`);
SYN('unclosed paren', `print('hi'\n`);
SYN('unclosed paren next line', `print('hi'\nx = 5\n`);
SYN('unclosed bracket', `x = [1, 2, 3\n`);
SYN('unclosed call multi', `foo(a, b\nprint(1)\n`);
SYN('print statement', `print 'hi'\n`);
SYN('assign in if', `x = 1\nif x = 1:\n    pass\n`);
SYN('unterminated string', `print("hi)\n`);
SYN('unterminated string apostrophe', `x = 'it's'\n`);
SYN('unterminated triple', `x = '''abc\nprint(x)\n`);
SYN('expected indented block def', `def f():\nreturn 1\n`);
SYN('expected indented block if', `if True:\nprint(1)\n`);
SYN('expected indented block for', `for i in range(3):\nprint(i)\n`);
SYN('expected indented block eof', `while True:\n`);
SYN('unexpected indent', `x = 1\n    y = 2\n`);
SYN('unexpected indent first line', `  x = 1\n`);
SYN('unindent mismatch', `if True:\n    x = 1\n  y = 2\n`);
SYN('unindent mismatch else', `if x > 5:\n    print(x)\n  else:\n    pass\n`);
SYN('tab error', `if True:\n\tx = 1\n        y = 2\n`);
SYN('else without if', `else:\n    pass\n`);
SYN('elif without if', `elif x:\n    pass\n`);
SYN('else if', `if x:\n    pass\nelse if y:\n    pass\n`);
SYN('mismatched bracket', `x = (1, 2]\n`);
SYN('unmatched paren', `x = 10 + 5)\n`);
SYN('return outside function', `return 5\n`);
SYN('break outside loop', `x = 1\nbreak\n`);
SYN('continue outside loop', `if True:\n    continue\n`);
SYN('double equals assign', `x = = 3\n`);
SYN('assign to literal', `1 = x\n`);
SYN('assign to call', `f() = 3\n`);
SYN('assign to expression', `x + 1 = 2\n`);
SYN('assign to True', `True = 1\n`);
SYN('chained assign literal', `x = 1 = 2\n`);
SYN('forgot comma call', `print('a' x)\n`);
SYN('forgot comma list', `[1 2 3]\n`);
SYN('forgot comma dict', `x = {'a': 1 'b': 2}\n`);
SYN('forgot comma kwargs', `print('a', end='' sep='')\n`);
SYN('stray token', `x = 1 2\n`);
SYN('invalid character', `x = 5 × 3\n`);
SYN('smart quotes', `x = “hi”\n`);
SYN('non-printable', `x = 5 \u00a0\n`);
SYN('leading zero', `x = 08\n`);
SYN('invalid decimal', `x = 1abc\n`);
SYN('empty fstring expr', `print(f'{}')\n`);
SYN('fstring unclosed', `print(f'{x')\n`);
SYN('fstring bad conversion', `print(f'{x!z}')\n`);
SYN('keyword as name', `class = 5\n`);
SYN('def missing paren', `def f print(1)\n`);
SYN('augassign literal', `f() += 1\n`);
SYN('augassign tuple', `a, b += 1\n`);
SYN('for literal target', `for 5 in x:\n    pass\n`);
SYN('del literal', `del 5\n`);
SYN('dollar sign', `x = $5\n`);
SYN('trailing operator', `x = 5 +\n`);
SYN('empty operand', `print('a' + )\n`);
SYN('try without except', `try:\n    pass\nprint(1)\n`);
SYN('positional after keyword', `f(a=1, 2)\n`);
SYN('duplicate argument', `def f(x, x):\n    pass\n`);
SYN('default before non-default', `def f(a=1, b):\n    pass\n`);
SYN('dict missing colon', `{1: 2, 3}\n`);
SYN('ternary without else', `x = 5 if y\n`);
SYN('not without operand', `x = not\n`);
SYN('double semicolon', `a = 1; b = 2;; c = 3\n`);
SYN('triple equals', `x === 1\n`);
SYN('bad comparison op', `if x =! 1:\n  pass\n`);
SYN('dot number', `x.1\n`);
SYN('global after assign', `def f():\n    x = 1\n    global x\n`);
SYN('nonlocal module', `nonlocal x\n`);
SYN('import nothing', `import\n`);
SYN('syntax error after valid lines', `print('a')\nprint('b')\nfor x in range(3) print(x)\n`);

// ---------------------------------------------------------------------------
// run differential cases
// ---------------------------------------------------------------------------
let pass = 0, fail = 0;
const failures = [];
const t0 = Date.now();
for (const c of CASES) {
  if (FILTER && !c.name.includes(FILTER)) continue;
  const py = runCPython(c.src);
  const vm = new PyVM({ maxSteps: 5000000 });
  const r = vm.load(c.src);
  const problems = [];
  if (r.stdout !== py.stdout) problems.push(`stdout differs\n--- CPython ---\n${py.stdout}--- PyVM ---\n${r.stdout}`);
  if (py.error && r.ok) problems.push(`CPython raised ${py.error.type}: ${py.error.message} but PyVM succeeded`);
  if (!py.error && !r.ok) problems.push(`PyVM raised ${r.error.type}: ${r.error.message} (line ${r.error.line}) but CPython succeeded${r.error.internal ? '\n' + r.error.internal : ''}`);
  if (py.error && !r.ok) {
    if (py.error.type !== r.error.type || py.error.message !== r.error.message) {
      problems.push(`error differs\n  CPython: ${py.error.type}: ${py.error.message}\n  PyVM:    ${r.error.type}: ${r.error.message}`);
    }
    if (!c.opts.noLine && py.error.line !== null && py.error.line !== r.error.line) {
      problems.push(`error line differs: CPython ${py.error.line}, PyVM ${r.error.line}`);
    }
    if (!r.error.hint) problems.push('missing hint');
  }
  if (problems.length) { fail++; failures.push(`✗ ${c.name}\n  ${problems.join('\n  ')}`); }
  else { pass++; if (VERBOSE) console.log('✓', c.name); }
}
const diffMs = Date.now() - t0;

// ---------------------------------------------------------------------------
// API tests (no CPython needed)
// ---------------------------------------------------------------------------
let apiPass = 0, apiFail = 0;
function check(name, cond, detail = '') {
  if (FILTER && !('api ' + name).includes(FILTER)) return;
  if (cond) { apiPass++; if (VERBOSE) console.log('✓ api', name); }
  else { apiFail++; failures.push(`✗ api ${name}${detail ? '\n  ' + detail : ''}`); }
}
const J = (v) => JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x.toString() + 'n' : x instanceof Map ? [...x] : x instanceof Set ? [...x] : x));

{
  const vm = new PyVM();
  const r = vm.load(`
def add(a, b=10):
    return a + b
def stats(nums):
    return {'min': min(nums), 'max': max(nums), 'mean': sum(nums) / len(nums)}
def pair(x):
    return (x, [x, x * 2], None, True, 2.5)
def boom():
    return 1 / 0
greeting = "hello"
`);
  check('load ok', r.ok && r.error === null && Array.isArray(r.output), J(r));
  let c = vm.call('add', [2, 3]);
  check('call returns value', c.ok && c.value === 5, J(c));
  c = vm.call('add', [2]);
  check('call uses default', c.ok && c.value === 12, J(c));
  c = vm.call('stats', [[1, 2, 3, 6]]);
  check('call dict result', c.ok && J(c.value) === J({ min: 1, max: 6, mean: 3 }), J(c));
  c = vm.call('pair', [7]);
  check('call tuple/list/None/bool/float', c.ok && J(c.value) === J([7, [7, 14], null, true, 2.5]), J(c));
  c = vm.call('boom');
  check('call error', !c.ok && c.error.type === 'ZeroDivisionError' && c.error.message === 'division by zero' && c.error.line === 9 && c.error.hint, J(c));
  c = vm.call('missing', []);
  check('call missing function', !c.ok && c.error.type === 'NameError', J(c));
  check('has/get', vm.has('greeting') && !vm.has('nope') && vm.get('greeting') === 'hello' && vm.has('add'));
  vm.set('shards', ['abc', '#x', 'def']);
  const r2 = vm.load('print(len(shards), shards[0][::-1])\nresult = [s for s in shards if not s.startswith("#")]');
  check('set then use', r2.ok && r2.output[0] === '3 cba' && J(vm.get('result')) === J(['abc', 'def']), J(r2));
  vm.set('cfg', { speed: 2, name: 'cam', tags: ['a'] });
  const r3 = vm.load("print(cfg['speed'] * 2, cfg['name'], cfg['tags'])");
  check('set object becomes dict', r3.ok && r3.output[0] === "4 cam ['a']", J(r3));
}
{
  const sent = [];
  const vm = new PyVM();
  vm.defineNative('send', (code) => { sent.push(code); return 'ACK ' + code; }, { doc: 'send(code) — transmit the abort code over the dish.' });
  vm.defineNative('scale', (xs, factor) => xs.map((x) => x * factor), { params: ['xs', 'factor'] });
  vm.defineNative('fail', () => { throw new Error('dish offline'); });
  vm.defineNative('fussy', (x) => { const e = new Error('bad frame: ' + x); e.pyType = 'ValueError'; throw e; });
  const r = vm.load(`
reply = send("ROOT-KEY")
print(reply)
print(scale([1, 2, 3], factor=10))
try:
    fail()
except RuntimeError as e:
    print("caught", e)
try:
    fussy(7)
except ValueError as e:
    print("value error", e)
help(send)
`);
  check('defineNative call', r.ok && sent[0] === 'ROOT-KEY' && r.output[0] === 'ACK ROOT-KEY', J(r));
  check('defineNative kwargs', r.output[1] === '[10, 20, 30]', J(r.output));
  check('defineNative host error -> RuntimeError', r.output[2] === 'caught dish offline', J(r.output));
  check('defineNative pyType error', r.output[3] === 'value error bad frame: 7', J(r.output));
  check('help shows doc', r.output.some((l) => l.includes('transmit the abort code')), J(r.output));
  const r2 = vm.load('send(1, x=2)');
  check('defineNative rejects unknown kwargs', !r2.ok && r2.error.type === 'TypeError' && r2.error.message === 'send() takes no keyword arguments', J(r2));
}
{
  const vm = new PyVM();
  const log = [];
  const camera = {
    id: 'SL-07',
    fps: 2.5,
    frames: ['empty street', 'PERSON walking', 'empty street'],
    loop(frames) { log.push(frames); return frames.length; },
    status() { return { online: true, id: this.id }; },
  };
  vm.defineModuleObject('camera', camera);
  const r = vm.load(`
print(camera.id, camera.fps, len(camera.frames))
n = camera.loop([f for f in camera.frames if "PERSON" not in f])
print("looped", n, camera.status()["id"])
import camera as cam
print(cam.id)
camera.loop(["x"])
`);
  check('defineModuleObject attrs+methods', r.ok && r.output[0] === 'SL-07 2.5 3' && r.output[1] === 'looped 2 SL-07' && r.output[2] === 'SL-07', J(r));
  check('defineModuleObject host received JS arrays', log.length === 2 && J(log[0]) === J(['empty street', 'empty street']), J(log));
  const r2 = vm.load('camera.zoom(2)');
  check('module attribute error', !r2.ok && r2.error.type === 'AttributeError' && r2.error.message === "module 'camera' has no attribute 'zoom'", J(r2));
}
{
  const t = Date.now();
  const r = runPython('n = 0\nwhile True:\n    n += 1\n');
  const ms = Date.now() - t;
  check('infinite loop -> TimeoutError', !r.ok && r.error.type === 'TimeoutError' && r.error.message === 'your code ran for too long — is there a loop that never ends?' && r.error.line >= 2, J(r.error));
  check('timeout is fast', ms < 1500, `${ms} ms`);
  const r2 = runPython('while True:\n    try:\n        pass\n    except Exception:\n        pass\n');
  check('timeout cannot be caught', !r2.ok && r2.error.type === 'TimeoutError', J(r2.error));
  const r3 = runPython('xs = [x for x in range(10 ** 9)]');
  check('huge comprehension times out', !r3.ok && r3.error.type === 'TimeoutError', J(r3.error));
  const r4 = runPython('print(sum(range(10 ** 12)))');
  check('huge native loop times out', !r4.ok && r4.error.type === 'TimeoutError', J(r4.error));
  const r5 = runPython('for i in range(50):\n    pass\n', { maxSteps: 20 });
  check('maxSteps option', !r5.ok && r5.error.type === 'TimeoutError', J(r5.error));
  const r6 = runPython('def f(n):\n    return f(n + 1)\nf(0)\n');
  check('recursion -> RecursionError', !r6.ok && r6.error.type === 'RecursionError' && r6.error.message === 'maximum recursion depth exceeded', J(r6.error));
  const r7 = runPython('def f(n):\n    return 0 if n == 0 else 1 + f(n - 1)\nprint(f(140))\n');
  check('recursion within maxDepth ok', r7.ok && r7.output[0] === '140', J(r7));
  const r8 = runPython('def f(n):\n    return 0 if n == 0 else 1 + f(n - 1)\nprint(f(400))\n', { maxDepth: 500 });
  check('maxDepth option', r8.ok && r8.output[0] === '400', J(r8.error));
  const r9 = runPython('x = "a" * (10 ** 9)');
  check('huge string -> MemoryError', !r9.ok && r9.error.type === 'MemoryError', J(r9.error));
  const r10 = runPython('x = 2 ** (10 ** 9)');
  check('huge power -> MemoryError', !r10.ok && r10.error.type === 'MemoryError', J(r10.error));
}
{
  const lines = [];
  const r = runPython('print("a")\nprint("b", end="")\nprint("c")\nprint("d", end="")', { onPrint: (l) => lines.push(l) });
  check('onPrint per line', J(lines) === J(['a', 'bc', 'd']) && J(r.output) === J(['a', 'bc', 'd']) && r.stdout === 'a\nbc\nd', J(lines));
  const r2 = runPython('name = input("Name? ")');
  check('input raises friendly EOFError', !r2.ok && r2.error.type === 'EOFError' && /keyboard/.test(r2.error.message) && /input\(\)/.test(r2.error.hint), J(r2.error));
  const r3 = runPython('name = input("Name? ")\nprint("Hi", name)', { input: ['Rybka'] });
  check('input with opts.input', r3.ok && r3.output[1] === 'Hi Rybka', J(r3));
  const r4 = runPython('exit()\nprint("never")');
  check('exit() stops cleanly', r4.ok && r4.output.length === 0, J(r4));
  const r5 = runPython('x = 5\nprint(x.uper())');
  check('error has hint & location', !r5.ok && r5.error.line === 2 && r5.error.col >= 1 && typeof r5.error.hint === 'string' && r5.error.hint.length > 10, J(r5.error));
  const r6 = runPython('def a():\n    return b()\ndef b():\n    return 1 / 0\na()\n');
  check('error trace', !r6.ok && r6.error.line === 4 && r6.error.trace && r6.error.trace.length === 3 && r6.error.trace[1].line === 2, J(r6.error));
  const r7 = runPython('import random\nrandom.seed(1)\na = [random.randint(1, 6) for _ in range(5)]\nrandom.seed(1)\nb = [random.randint(1, 6) for _ in range(5)]\nprint(a == b, all(1 <= x <= 6 for x in a))');
  check('random module deterministic', r7.ok && r7.output[0] === 'True True', J(r7));
  check('pyRepr helper', pyRepr(['a', 1.5, null, true, { k: [1] }]) === "['a', 1.5, None, True, {'k': [1]}]");
  check('toPy floats', pyRepr(toPy(2.5)) === '2.5' && pyRepr(toPy(2)) === '2');
  const r8 = runPython('class Fish:\n    pass\n');
  check('class not supported, friendly', !r8.ok && r8.error.type === 'NotImplementedError' && /classes/.test(r8.error.message), J(r8.error));
}
{
  // performance: 200k simple iterations well under 1 s
  const src = 'total = 0\nfor i in range(200000):\n    total += i % 7\nprint(total)\n';
  const t = Date.now();
  const r = runPython(src, { maxSteps: 10000000 });
  const ms = Date.now() - t;
  check('perf 200k loop', r.ok && r.output[0] === String([...Array(200000).keys()].reduce((a, i) => a + (i % 7), 0)) && ms < 1000, `${ms} ms`);
  const src2 = 'def f(xs):\n    out = []\n    for x in xs:\n        if x % 2 == 0:\n            out.append(x * x)\n    return out\nr = f(list(range(200000)))\nprint(len(r), sum(r) % 1000)\n';
  const t2 = Date.now();
  const r2 = runPython(src2, { maxSteps: 10000000 });
  const ms2 = Date.now() - t2;
  check('perf function + list 200k', r2.ok && ms2 < 1000, `${ms2} ms ${J(r2.error)}`);
  const src3 = 'd = {}\nfor i in range(200000):\n    k = "k" + str(i % 100)\n    d[k] = d.get(k, 0) + 1\nprint(len(d), d["k7"])\n';
  const t3 = Date.now();
  const r3 = runPython(src3, { maxSteps: 10000000 });
  const ms3 = Date.now() - t3;
  check('perf dict counting 200k', r3.ok && r3.output[0] === '100 2000' && ms3 < 1000, `${ms3} ms`);
  if (VERBOSE) console.log(`perf: loop ${ms} ms, list ${ms2} ms, dict ${ms3} ms`);
}

for (const f of failures) console.log(f + '\n');
console.log(`differential: ${pass} passed, ${fail} failed (${CASES.filter((c) => !FILTER || c.name.includes(FILTER)).length} programs vs CPython, ${diffMs} ms)`);
console.log(`api:          ${apiPass} passed, ${apiFail} failed`);
process.exit(fail || apiFail ? 1 : 0);
