// COLD BOOT — Lyosha's Night School: 14 Python lessons on the cabin laptop.
//
// LESSONS[i] = {
//   id: 'l01', day, title,
//   ru: { line, en },                 // Lyosha's spoken opener (voiced in Russian) + English subtitle
//   pages: [{ text, code? }],         // 3–5 pages, text in Lyosha's voice; code is runnable Python
//   exercises: [{ id, prompt, starter, check, hints: [3], solution }]
// }
// check: { kind: 'stdout', expected } | { kind: 'call', fn, cases: [{ args, expect }] }
// Grade with checkExercise() from ./check.js. tools/test_lessons.mjs proves every solution passes,
// every starter fails, and every example matches real CPython.

const dd = (s) => {
  const lines = s.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
  const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return lines.map((l) => l.slice(ind)).join('\n') + '\n';
};

const COUNCIL = [
  { name: 'Dolly Finch', votes: 312 },
  { name: 'Hank Brubaker', votes: 288 },
  { name: 'Ruth Aqpik', votes: 401 },
  { name: 'Ray Moody', votes: 175 },
  { name: 'Lyle Pruitt', votes: 290 },
];

export const LESSONS = [
  // -------------------------------------------------------------------------
  {
    id: 'l01',
    day: 1,
    title: 'Hello, Port Zarya',
    ru: { line: 'Сегодня, Рыбка, этот ноутбук впервые скажет тебе «привет».', en: 'Tonight, Rybka, this laptop says hello to you for the first time.' },
    pages: [
      {
        text: "Privet, Rybka. Pull up a stool, mind the tea: it's mostly sugar. This laptop runs Python, a language for telling a computer exactly what to do. Computers are fast but very literal. They do what you wrote, not what you meant. Our first command is print. Whatever you put inside its brackets appears on the screen. Text goes inside quotes, so Python knows it's text and not a command. Press Run and watch.",
        code: dd(`
          print("Hello, Port Zarya!")
        `),
      },
      {
        text: "Text in quotes is called a string. Single quotes or double quotes both work; just finish with the same kind you started with. If the text needs an apostrophe inside, wrap it in double quotes. One print makes one line. Two prints, two lines. Python reads your program from top to bottom, one line at a time, like Nadia reading a shopping list out loud.",
        code: dd(`
          print('Koshkin says hi.')
          print("It's minus thirty outside.")
          print("Lyosha's tea: too sweet")
        `),
      },
      {
        text: "Give print several things separated by commas and it puts one space between them. You can also glue strings together with +, but then you have to add the spaces yourself. \"Port\" + \"Zarya\" gives PortZarya. \"Port \" + \"Zarya\" gives Port Zarya. Strings are like rope: + ties two pieces end to end, no gap, no knot.",
        code: dd(`
          print("Signal", "is", "clear")
          print("Port" + "Zarya")
          print("Port " + "Zarya")
        `),
      },
      {
        text: "Anything after a # is a comment. Python ignores it completely; it's a note for humans. I use comments to explain tricky lines, and to switch a line off without deleting it. Nadia once found my comment '# this part is magic, do not touch'. She was not impressed. Write comments that help the next person, which is usually you, at three in the morning.",
        code: dd(`
          # This line is a note. Python skips it.
          print("Relay check")  # a comment can sit at the end of a line too
          # print("This line is switched off")
        `),
      },
    ],
    exercises: [
      {
        id: 'l01e1',
        prompt: 'Your first real message. Make the laptop print exactly: Hello, Port Zarya!  (capital H, a comma, an exclamation mark. Computers notice everything.)',
        starter: dd(`
          # Write your first line of code below this comment
        `),
        check: { kind: 'stdout', expected: 'Hello, Port Zarya!' },
        hints: [
          'Use print( ) with your message inside the brackets.',
          'Text needs quotes around it: print("...")',
          'print("Hello, Port Zarya!")',
        ],
        solution: dd(`
          print("Hello, Port Zarya!")
        `),
      },
      {
        id: 'l01e2',
        prompt: "Radio check for Nadia. She wants ONE line: Rybka here, signal clear  — but the starter prints two lines. Put both strings into a single print, separated by a comma.",
        starter: dd(`
          # Put both pieces into ONE print, separated by a comma
          print("Rybka here,")
          print("signal clear")
        `),
        check: { kind: 'stdout', expected: 'Rybka here, signal clear' },
        hints: [
          'Each print starts a new line. You need just one print.',
          'Inside one print( ), put the two strings with a comma between them. print adds the space for you.',
          'print("Rybka here,", "signal clear")',
        ],
        solution: dd(`
          print("Rybka here,", "signal clear")
        `),
      },
      {
        id: 'l01e3',
        prompt: 'My relay test script has one line switched off by a comment. Switch it back on so all three lines print in order: RELAY ONLINE, BELL TOWER, ALL QUIET.',
        starter: dd(`
          print("RELAY ONLINE")
          # print("BELL TOWER")
          print("ALL QUIET")
        `),
        check: { kind: 'stdout', expected: 'RELAY ONLINE\nBELL TOWER\nALL QUIET' },
        hints: [
          'A line that starts with # is a comment, and Python skips it.',
          'Delete the # (and the space after it) at the start of the middle line.',
          'The middle line should read: print("BELL TOWER")',
        ],
        solution: dd(`
          print("RELAY ONLINE")
          print("BELL TOWER")
          print("ALL QUIET")
        `),
      },
    ],
  },
  // -------------------------------------------------------------------------
  {
    id: 'l02',
    day: 2,
    title: 'Counting Fish',
    ru: { line: 'Компьютер — это просто очень быстрый калькулятор, так что давай посчитаем рыбу.', en: "A computer is just a very fast calculator, so let's count some fish." },
    pages: [
      {
        text: "A variable is a name with a value attached, like a label on a jar in Koshkin's back room. You make one with a single equals sign: catch = 40. From then on, catch means 40. You can change it whenever you like. Names can use letters, digits and underscores, but can't start with a digit, and capitals matter: Catch and catch are two different jars.",
        code: dd(`
          catch = 40
          print(catch)
          catch = 55
          print(catch)
          boat_name = "Margaret Rose"
          print(boat_name)
        `),
      },
      {
        text: "+, - and * work like on paper. / is division, and it always gives an answer with a decimal point: 7 / 2 is 3.5, and even 8 / 2 is 4.0. Brackets work as you'd expect, and * and / happen before + and -, just like at school. Python happily does the arithmetic you're too tired for at two in the morning.",
        code: dd(`
          crates = 12
          fish_per_crate = 25
          print(crates * fish_per_crate)
          print(7 / 2)
          print(8 / 2)
          print((3 + 4) * 2)
        `),
      },
      {
        text: "Two operators are pure gold for us. // divides and throws away the leftovers: 17 // 5 is 3, three full crates. % gives only the leftovers: 17 % 5 is 2 fish left over. Together they answer 'how many full ones, and what's left?'. And ** is power: 2 ** 10 is 1024. Hackers love powers of two. Don't ask why; the answer is a very long story about zeros and ones.",
        code: dd(`
          fish = 17
          print(fish // 5)   # full crates
          print(fish % 5)    # fish left over
          print(2 ** 10)
        `),
      },
      {
        text: "A variable can use its own old value: catch = catch + 5 means 'take the old catch, add 5, store it back'. The short way is catch += 5. Now a trap: you can't glue a number onto text with +. 'Total: ' + 40 is an error. Turn the number into text first with str(40), or let print do the work with a comma.",
        code: dd(`
          catch = 40
          catch = catch + 5
          catch += 10
          print("Total: " + str(catch))
          print("Total:", catch)
        `),
      },
    ],
    exercises: [
      {
        id: 'l02e1',
        prompt: "Hank's hardware sells rope at 3 dollars a metre. Father Gabriel's bell rope must be 14 metres long. Print the total cost using the two variables.",
        starter: dd(`
          price_per_metre = 3
          metres = 14
          # print the total cost here
        `),
        check: { kind: 'stdout', expected: '42' },
        hints: [
          'Cost is price times length. Multiplication is *.',
          'Use the variable names, not the numbers: price_per_metre * metres',
          'print(price_per_metre * metres)',
        ],
        solution: dd(`
          price_per_metre = 3
          metres = 14
          print(price_per_metre * metres)
        `),
      },
      {
        id: 'l02e2',
        prompt: "Today's catch is 137 salmon, and Koshkin packs them 12 to a crate. Print how many FULL crates he can fill, then on the next line how many salmon are left over.",
        starter: dd(`
          salmon = 137
          per_crate = 12
        `),
        check: { kind: 'stdout', expected: '11\n5' },
        hints: [
          '// gives the number of whole crates; % gives the leftovers.',
          'Two prints: one with salmon // per_crate, one with salmon % per_crate.',
          'print(salmon // per_crate)\nprint(salmon % per_crate)',
        ],
        solution: dd(`
          salmon = 137
          per_crate = 12
          print(salmon // per_crate)
          print(salmon % per_crate)
        `),
      },
      {
        id: 'l02e3',
        prompt: "Dolly's diner sold 23 bowls of fish soup at 7 dollars each. The starter crashes. Fix it so it prints exactly: Soup money: 161",
        starter: dd(`
          bowls = 23
          price = 7
          total = bowls * price
          print("Soup money: " + total)
        `),
        check: { kind: 'stdout', expected: 'Soup money: 161' },
        hints: [
          "Read the error: you can't add a number to a string.",
          'Turn the number into text with str( ) before gluing it.',
          'print("Soup money: " + str(total))',
        ],
        solution: dd(`
          bowls = 23
          price = 7
          total = bowls * price
          print("Soup money: " + str(total))
        `),
      },
    ],
  },
  // -------------------------------------------------------------------------
  {
    id: 'l03',
    day: 3,
    title: 'Numbers, Text and F-strings',
    ru: { line: 'Число и текст — разные звери, и сегодня мы учимся их различать.', en: 'Numbers and text are different animals, and tonight we learn to tell them apart.' },
    pages: [
      {
        text: "Every value in Python has a type. 42 is an int, a whole number. 4.5 is a float, a number with a decimal point. \"42\" in quotes is a str: text that happens to look like a number. True and False are bools. type(x) tells you what you're holding. Half of all bugs are a value being a different type than you thought it was.",
        code: dd(`
          print(type(42))
          print(type(4.5))
          print(type("42"))
          print(type(True))
        `),
      },
      {
        text: "You can convert between types. int(\"42\") turns text into a whole number, float(\"4.5\") into a decimal, and str(42) back into text. int() of a float chops the decimals off: int(9.99) is 9. No rounding; Hank would hate it. Data from cameras, ledgers and forms almost always arrives as text, so you'll be converting a lot.",
        code: dd(`
          count = int("42")
          print(count + 1)
          price = float("4.5")
          print(price * 2)
          print(int(9.99))
          print(str(7) + "7")
        `),
      },
      {
        text: "Gluing strings with + and str() gets ugly fast. Meet the f-string: put an f right before the opening quote, then write any variable or even a small calculation inside curly braces. Python fills them in for you. It's the cleanest way to build a message, and the one I use every single day.",
        code: dd(`
          name = "Rybka"
          fish = 12
          print(f"{name} caught {fish} fish")
          print(f"Double that is {fish * 2}")
        `),
      },
      {
        text: "Inside the braces you can add a colon and a format. {price:.2f} shows exactly two decimals, perfect for money. {n:>5} pads to a width of 5 lined up on the right, {n:<5} on the left, and {n:04d} pads with zeros, like a door code. Every receipt from NORTHSTAR 24 uses .2f. So will ours.",
        code: dd(`
          price = 4.5
          print(f"Cod: \${price:.2f}")
          n = 7
          print(f"[{n:>5}] [{n:<5}] [{n:04d}]")
        `),
      },
    ],
    exercises: [
      {
        id: 'l03e1',
        prompt: 'A camera log gives the frame count as text. At 4 frames per second, how many minutes of video is that? The starter crashes. Convert frames to a number so it prints 7.5',
        starter: dd(`
          frames = "1800"
          seconds = frames / 4
          print(seconds / 60)
        `),
        check: { kind: 'stdout', expected: '7.5' },
        hints: [
          "frames is text (it has quotes). You can't divide text.",
          'int(frames) turns "1800" into the number 1800.',
          'seconds = int(frames) / 4',
        ],
        solution: dd(`
          frames = "1800"
          seconds = int(frames) / 4
          print(seconds / 60)
        `),
      },
      {
        id: 'l03e2',
        prompt: "Make Koshkin's price tag with an f-string. Print exactly: Herring: $2.50 per kg",
        starter: dd(`
          item = "Herring"
          price = 2.5
          # print: Herring: $2.50 per kg
        `),
        check: { kind: 'stdout', expected: 'Herring: $2.50 per kg' },
        hints: [
          'Start the string with f, and put item and price inside { }.',
          'Use :.2f after price to get exactly two decimals. The $ is just a normal character.',
          'print(f"{item}: ${price:.2f} per kg")',
        ],
        solution: dd(`
          item = "Herring"
          price = 2.5
          print(f"{item}: \${price:.2f} per kg")
        `),
      },
      {
        id: 'l03e3',
        prompt: 'The keypad at City Hall wants a 4-digit code with leading zeros. I found code = 73. Print exactly: CODE 0073',
        starter: dd(`
          code = 73
        `),
        check: { kind: 'stdout', expected: 'CODE 0073' },
        hints: [
          'An f-string can pad numbers with zeros.',
          '{code:04d} means: at least 4 digits, fill with zeros.',
          'print(f"CODE {code:04d}")',
        ],
        solution: dd(`
          code = 73
          print(f"CODE {code:04d}")
        `),
      },
    ],
  },
  // -------------------------------------------------------------------------
  {
    id: 'l04',
    day: 4,
    title: 'If the Camera Is Watching',
    ru: { line: 'Программа умеет выбирать: если камера смотрит — молчим, иначе — работаем.', en: 'A program can choose: if the camera is watching, we keep quiet; otherwise, we work.' },
    pages: [
      {
        text: "Comparisons ask a question and answer True or False. == means 'is equal to', with two equals signs, because a single = is for storing values. != means 'is not equal'. <, >, <= and >= work like at school. True and False are called booleans, after George Boole, who never saw a computer but would have loved this one.",
        code: dd(`
          print(5 > 3)
          print(5 == 5)
          print("Hank" == "hank")
          print(10 != 10)
        `),
      },
      {
        text: "if runs a block of code only when its condition is True. The if line ends with a colon, and the block underneath is indented by four spaces. That indentation isn't decoration: it's how Python knows which lines belong to the if. When the indentation stops, the if is over, and the next line runs no matter what.",
        code: dd(`
          attention = 72
          if attention > 60:
              print("Lie low today.")
              print("Go to church, fix a fence.")
          print("This line always runs.")
        `),
      },
      {
        text: "else catches everything the if didn't. elif, short for 'else if', adds more checks in between. Python tries them from top to bottom, runs only the first one that's True, and skips the rest. So order matters: put the most specific check first, or it will never get its turn.",
        code: dd(`
          temp = -28
          if temp < -30:
              print("Stay inside")
          elif temp < -10:
              print("Wear the big coat")
          else:
              print("Practically summer")
        `),
      },
      {
        text: "Combine conditions with and (both must be True), or (at least one is True) and not (flips True and False). We go to the vault only if it's night and the camera is off. One more: in asks whether something is inside a string, so \"PERSON\" in frame is True when the word appears anywhere in frame.",
        code: dd(`
          night = True
          camera_on = False
          if night and not camera_on:
              print("Go")
          frame = "street PERSON lamp"
          if "PERSON" in frame:
              print("Someone is there")
        `),
      },
    ],
    exercises: [
      {
        id: 'l04e1',
        prompt: "Koshkin's two freezers must stay at -18 degrees or colder. For each freezer print FREEZER OK if its temperature is -18 or colder, otherwise FREEZER WARM.",
        starter: dd(`
          temp = -21
          # check the first freezer here

          temp = -5
          # check the second freezer here
        `),
        check: { kind: 'stdout', expected: 'FREEZER OK\nFREEZER WARM' },
        hints: [
          '"-18 or colder" means temp <= -18.',
          'Write the same if/else twice, once after each temp line.',
          'if temp <= -18:\n    print("FREEZER OK")\nelse:\n    print("FREEZER WARM")',
        ],
        solution: dd(`
          temp = -21
          if temp <= -18:
              print("FREEZER OK")
          else:
              print("FREEZER WARM")

          temp = -5
          if temp <= -18:
              print("FREEZER OK")
          else:
              print("FREEZER WARM")
        `),
      },
      {
        id: 'l04e2',
        prompt: "Northstar's attention meter: under 30 print Invisible, 30 up to 69 print Noticed, 70 or more print BURNED SOON. Write the if/elif/else for the attention value in the starter.",
        starter: dd(`
          attention = 45
          # Invisible / Noticed / BURNED SOON
        `),
        check: { kind: 'stdout', expected: 'Noticed' },
        hints: [
          'Three possibilities means if, elif, else.',
          'Check the lowest range first: if attention < 30: ... elif attention < 70: ...',
          'if attention < 30:\n    print("Invisible")\nelif attention < 70:\n    print("Noticed")\nelse:\n    print("BURNED SOON")',
        ],
        solution: dd(`
          attention = 45
          if attention < 30:
              print("Invisible")
          elif attention < 70:
              print("Noticed")
          else:
              print("BURNED SOON")
        `),
      },
      {
        id: 'l04e3',
        prompt: "Nadia's tailing rule: follow Gideon Shaw if it's dark AND he's more than 20 metres ahead, OR if Mr. Grey is not around. Print FOLLOW or WAIT.",
        starter: dd(`
          dark = True
          distance = 15
          grey_nearby = False
          # print FOLLOW or WAIT
        `),
        check: { kind: 'stdout', expected: 'FOLLOW' },
        hints: [
          'Build the condition from the rule: (dark and distance > 20) or not grey_nearby',
          'Brackets make the and-part happen first, so it reads like the rule.',
          'if (dark and distance > 20) or not grey_nearby:\n    print("FOLLOW")\nelse:\n    print("WAIT")',
        ],
        solution: dd(`
          dark = True
          distance = 15
          grey_nearby = False
          if (dark and distance > 20) or not grey_nearby:
              print("FOLLOW")
          else:
              print("WAIT")
        `),
      },
    ],
  },
  // -------------------------------------------------------------------------
  {
    id: 'l05',
    day: 5,
    title: 'Loops That Wait',
    ru: { line: 'Цикл — это когда компьютер делает скучную работу вместо тебя.', en: 'A loop is when the computer does the boring work instead of you.' },
    pages: [
      {
        text: "while is like if, but stubborn: as long as its condition is True, it runs the block again, and again. Each pass is called an iteration. Here we count down for Tommy's snowmobile race. Look at the line n = n - 1. Without it, n stays 3 forever and the loop never ends. Something inside the loop must move it toward the exit.",
        code: dd(`
          n = 3
          while n > 0:
              print(n)
              n = n - 1
          print("Go!")
        `),
      },
      {
        text: "Loops shine when you add things up. Make a total variable before the loop, start it at 0, and add to it on every pass. Here we load the truck crate by crate until the next one won't fit. This pattern, start at zero, add inside the loop, print after it, is half of all the code I write.",
        code: dd(`
          load = 0
          crates = 0
          while load + 40 <= 300:
              load += 40
              crates += 1
          print(crates, "crates,", load, "kg")
        `),
      },
      {
        text: "If the condition never becomes False, the loop runs forever. This laptop will stop it after a while and complain: that's the TimeoutError you may meet. Sometimes forever is on purpose: while True with a break inside. break jumps out of the loop immediately, and the program carries on after it.",
        code: dd(`
          tries = 0
          while True:
              tries += 1
              if tries == 4:
                  break
          print("Lock picked after", tries, "tries")
        `),
      },
      {
        text: "continue skips the rest of this pass and jumps straight back to the condition. It means 'not this one, next please'. Careful: whatever moves the loop forward, like n += 1, must happen before the continue, or you've built an infinite loop. Ask me how I know. Actually, don't. Grisha still tells the story.",
        code: dd(`
          n = 0
          while n < 6:
              n += 1
              if n % 2 == 0:
                  continue
              print("odd:", n)
        `),
      },
    ],
    exercises: [
      {
        id: 'l05e1',
        prompt: "Grisha's engine test needs a countdown: print 5, 4, 3, 2, 1 on separate lines, then Ignition. Use a while loop.",
        starter: dd(`
          n = 5
        `),
        check: { kind: 'stdout', expected: '5\n4\n3\n2\n1\nIgnition' },
        hints: [
          'Loop while n > 0, print n, then make n one smaller.',
          'The Ignition print goes after the loop, not inside it (no indentation).',
          'while n > 0:\n    print(n)\n    n -= 1\nprint("Ignition")',
        ],
        solution: dd(`
          n = 5
          while n > 0:
              print(n)
              n -= 1
          print("Ignition")
        `),
      },
      {
        id: 'l05e2',
        prompt: 'Koshkin puts away 35 dollars every week. How many weeks until he has at least 500? Print the number of weeks.',
        starter: dd(`
          savings = 0
          weeks = 0
        `),
        check: { kind: 'stdout', expected: '15' },
        hints: [
          'Keep looping while savings < 500.',
          'Inside the loop: add 35 to savings and 1 to weeks.',
          'while savings < 500:\n    savings += 35\n    weeks += 1\nprint(weeks)',
        ],
        solution: dd(`
          savings = 0
          weeks = 0
          while savings < 500:
              savings += 35
              weeks += 1
          print(weeks)
        `),
      },
      {
        id: 'l05e3',
        prompt: "My relay starts at 1000 milliwatts and loses half its power at every hop. While the power is above 20: print it, halve it with //, and count the hop. The last line of the starter then prints the number of hops.",
        starter: dd(`
          power = 1000
          hops = 0
          # while the power is above 20: print it, halve it with //, count the hop

          print("hops:", hops)
        `),
        check: { kind: 'stdout', expected: '1000\n500\n250\n125\n62\n31\nhops: 6' },
        hints: [
          'while power > 20: then three indented lines.',
          'power = power // 2 halves it and keeps it a whole number. hops += 1 counts.',
          'while power > 20:\n    print(power)\n    power = power // 2\n    hops += 1',
        ],
        solution: dd(`
          power = 1000
          hops = 0
          while power > 20:
              print(power)
              power = power // 2
              hops += 1

          print("hops:", hops)
        `),
      },
    ],
  },
  // -------------------------------------------------------------------------
  {
    id: 'l06',
    day: 6,
    title: 'Shelves',
    ru: { line: 'Список — как полка в магазине Кошкина: всё стоит по порядку.', en: "A list is like a shelf in Koshkin's store: everything stands in order." },
    pages: [
      {
        text: "A list holds many values in order: square brackets, items separated by commas. One variable, a whole shelf of stuff. Lists can hold strings, numbers, anything, even other lists. Koshkin's is yours now, so let's stock the shelf. len(shelf) tells you how many items are on it.",
        code: dd(`
          shelf = ["tea", "matches", "herring", "candles"]
          print(shelf)
          print(len(shelf))
        `),
      },
      {
        text: "Every item has a position number called its index. Counting starts at 0, not 1. Programmers argued about it for years, and 0 won. shelf[0] is the first item. Negative numbers count from the end: shelf[-1] is the last item, shelf[-2] the one before it. Ask for a position that doesn't exist and you get an IndexError.",
        code: dd(`
          shelf = ["tea", "matches", "herring", "candles"]
          print(shelf[0])
          print(shelf[2])
          print(shelf[-1])
          print(shelf[-2])
        `),
      },
      {
        text: "Lists can change. Assign to an index to replace an item. .append(x) adds x to the end, so the shelf grows. len(shelf) always tells you how many items there are right now, and the last index is always len(shelf) - 1. That minus one has caught every programmer alive at least once.",
        code: dd(`
          shelf = ["tea", "matches"]
          shelf.append("salt")
          shelf[0] = "sweet tea"
          print(shelf, len(shelf))
          print(shelf[len(shelf) - 1])
        `),
      },
      {
        text: "A few more tools. x in shelf asks whether x is on the shelf. .remove(x) takes the first x off. On a list of numbers, sum(), min() and max() do what they say. sorted(prices) gives you a new sorted copy and leaves the original alone. Evan at NORTHSTAR 24 has a whole computer for this. Now so do you.",
        code: dd(`
          prices = [4, 12, 2, 7]
          print(sum(prices), min(prices), max(prices))
          print(sorted(prices))
          print(12 in prices)
          prices.remove(12)
          print(prices)
        `),
      },
    ],
    exercises: [
      {
        id: 'l06e1',
        prompt: 'Print the first item and the last item on the shelf, each on its own line. Use indexes, not the words themselves: the shelf will change tomorrow.',
        starter: dd(`
          shelf = ["tea", "matches", "herring", "candles", "rope"]
        `),
        check: { kind: 'stdout', expected: 'tea\nrope' },
        hints: [
          'The first item is at index 0.',
          'The last item is at index -1.',
          'print(shelf[0])\nprint(shelf[-1])',
        ],
        solution: dd(`
          shelf = ["tea", "matches", "herring", "candles", "rope"]
          print(shelf[0])
          print(shelf[-1])
        `),
      },
      {
        id: 'l06e2',
        prompt: "A delivery came in. Append 'kerosene' and then 'flour' to the stock list, then print the list, and on the next line its length.",
        starter: dd(`
          stock = ["tea", "salt"]
        `),
        check: { kind: 'stdout', expected: "['tea', 'salt', 'kerosene', 'flour']\n4" },
        hints: [
          'stock.append("kerosene") adds one item to the end.',
          'Append twice, then print(stock) and print(len(stock)).',
          'stock.append("kerosene")\nstock.append("flour")\nprint(stock)\nprint(len(stock))',
        ],
        solution: dd(`
          stock = ["tea", "salt"]
          stock.append("kerosene")
          stock.append("flour")
          print(stock)
          print(len(stock))
        `),
      },
      {
        id: 'l06e3',
        prompt: "Today's sales at Koshkin's, in dollars. Print the total, then the biggest single sale, then the average sale (the total divided by the number of sales).",
        starter: dd(`
          sales = [12, 40, 7, 23, 18]
        `),
        check: { kind: 'stdout', expected: '100\n40\n20.0' },
        hints: [
          'sum(sales) adds them up and max(sales) finds the biggest.',
          'The number of sales is len(sales). Divide with /.',
          'print(sum(sales))\nprint(max(sales))\nprint(sum(sales) / len(sales))',
        ],
        solution: dd(`
          sales = [12, 40, 7, 23, 18]
          print(sum(sales))
          print(max(sales))
          print(sum(sales) / len(sales))
        `),
      },
    ],
  },
  // -------------------------------------------------------------------------
  {
    id: 'l07',
    day: 7,
    title: 'One Loop, Every Item',
    ru: { line: 'Сегодня один цикл пройдёт по всему списку за нас.', en: 'Tonight one loop walks through the whole list for us.' },
    pages: [
      {
        text: "for item in my_list: runs its block once for every item, and each time the variable holds the next one. No counter to manage, no n += 1 to forget. It's my favourite loop. The name after for is yours to choose, so pick one that says what the thing is: for place in houses reads almost like English.",
        code: dd(`
          houses = ["church", "diner", "hardware", "cabin"]
          for place in houses:
              print("Checking", place)
        `),
      },
      {
        text: "range(n) gives the numbers 0 up to n - 1, ready for a for loop. range(a, b) runs from a up to b - 1. range(a, b, step) jumps by step, and a negative step counts down. The end number is never included: same rule as list indexes, and just as annoying on the first day.",
        code: dd(`
          for i in range(3):
              print(i)
          for km in range(0, 10, 5):
              print(km)
          for t in range(3, 0, -1):
              print(t)
        `),
      },
      {
        text: "Same trick as with while: make a total before the loop, add to it inside, print it after. Here we add up the crab traps. You can count things the same way: start a counter at 0 and add 1 whenever an item passes a test. Total and counter, the two oldest tools in the box.",
        code: dd(`
          traps = [3, 0, 5, 2, 0, 4]
          total = 0
          empty = 0
          for crabs in traps:
              total += crabs
              if crabs == 0:
                  empty += 1
          print(total, "crabs,", empty, "empty traps")
        `),
      },
      {
        text: "You can build a new list inside a loop: start with an empty list [] and append to it. If you need the position as well, enumerate(my_list) hands you pairs: for i, item in enumerate(my_list). Two names, separated by a comma. Remember both tools; the camera job needs them.",
        code: dd(`
          temps = [-12, -30, -8]
          cold = []
          for t in temps:
              if t < -10:
                  cold.append(t)
          print(cold)
          for i, t in enumerate(temps):
              print(i, t)
        `),
      },
    ],
    exercises: [
      {
        id: 'l07e1',
        prompt: "Sasha Koshkin's great-nephew has homework: the 7 times table. Print 7 x 1 = 7 up to 7 x 10 = 70, one line each. Use a for loop and range.",
        starter: dd(`
          # 7 x 1 = 7 ... 7 x 10 = 70
        `),
        check: { kind: 'stdout', expected: Array.from({ length: 10 }, (_, i) => `7 x ${i + 1} = ${7 * (i + 1)}`).join('\n') },
        hints: [
          'range(1, 11) gives the numbers 1 to 10.',
          'Inside the loop, an f-string builds each line: f"7 x {i} = {7 * i}"',
          'for i in range(1, 11):\n    print(f"7 x {i} = {7 * i}")',
        ],
        solution: dd(`
          for i in range(1, 11):
              print(f"7 x {i} = {7 * i}")
        `),
      },
      {
        id: 'l07e2',
        prompt: "The cannery's fish counts for the week are in a list. Print the total for the week, then on the next line how many days were over 500.",
        starter: dd(`
          counts = [420, 615, 380, 702, 510, 299, 640]
        `),
        check: { kind: 'stdout', expected: '3566\n4' },
        hints: [
          'Two variables before the loop: total = 0 and busy = 0.',
          'Inside the loop add each count to total, and add 1 to busy when the count is over 500.',
          'total = 0\nbusy = 0\nfor c in counts:\n    total += c\n    if c > 500:\n        busy += 1\nprint(total)\nprint(busy)',
        ],
        solution: dd(`
          counts = [420, 615, 380, 702, 510, 299, 640]
          total = 0
          busy = 0
          for c in counts:
              total += c
              if c > 500:
                  busy += 1
          print(total)
          print(busy)
        `),
      },
      {
        id: 'l07e3',
        prompt: "A streetlight camera reports brightness readings. Build a new list with only the readings above 50 (50 itself doesn't count) and print it.",
        starter: dd(`
          readings = [12, 88, 51, 50, 97, 3, 64]
          bright = []
        `),
        check: { kind: 'stdout', expected: '[88, 51, 97, 64]' },
        hints: [
          'Loop over readings and test each one with if r > 50:',
          'Inside the if, bright.append(r). Print after the loop.',
          'for r in readings:\n    if r > 50:\n        bright.append(r)\nprint(bright)',
        ],
        solution: dd(`
          readings = [12, 88, 51, 50, 97, 3, 64]
          bright = []
          for r in readings:
              if r > 50:
                  bright.append(r)
          print(bright)
        `),
      },
    ],
  },
  // -------------------------------------------------------------------------
  {
    id: 'l08',
    day: 8,
    title: 'Cutting Strings',
    ru: { line: 'Строку можно резать, переворачивать и склеивать — прямо как колбасу.', en: 'You can slice a string, flip it and glue it back together, just like sausage.' },
    pages: [
      {
        text: "A string is a sequence of characters, so it behaves a lot like a list. s[0] is the first character, s[-1] the last. A slice s[a:b] cuts out the characters from position a up to, but not including, b. Leave out a to start at the beginning; leave out b to go all the way to the end.",
        code: dd(`
          code = "ZARYA-1822"
          print(code[0], code[-1])
          print(code[0:5])
          print(code[6:])
          print(code[:5])
        `),
      },
      {
        text: "A slice can take a third number, the step. s[::2] takes every second character. A step of -1 walks backwards, so s[::-1] is the whole string reversed. Northstar's engineers love storing things backwards and calling it security. It isn't. Remember this one, Rybka; it comes back on a very important night.",
        code: dd(`
          word = "AURORA"
          print(word[::2])
          print(word[::-1])
          print("droffats"[::-1])
        `),
      },
      {
        text: "Strings have methods, little functions you call with a dot. .upper() and .lower() change case, .title() capitalises each word, .strip() cuts spaces off both ends, .replace(old, new) swaps text. .startswith(x) and .endswith(x) answer True or False. A method never changes the original string; it hands you a new one, so store it.",
        code: dd(`
          name = "  hank brubaker  "
          clean = name.strip().title()
          print(clean)
          print(clean.upper(), clean.lower())
          print("frame 12: PERSON at lamp".replace("PERSON", "nobody"))
          print("#x9".startswith("#"))
        `),
      },
      {
        text: ".split() chops a string into a list of words; .split(\",\") chops at commas instead. The opposite is join: \" / \".join(names) glues a list of strings into one, with \" / \" between them. Split, fix, join: that's how we read Northstar's logs and put them back without anyone noticing.",
        code: dd(`
          line = "Dolly,Hank,Ruth,Ray,Lyle"
          names = line.split(",")
          print(names)
          print(len(names))
          print(" / ".join(names))
        `),
      },
    ],
    exercises: [
      {
        id: 'l08e1',
        prompt: "Mr. Grey dropped a page from his notebook. He writes backwards. Print it the right way round.",
        starter: dd(`
          page = ".thgin ta rewot lleb eht stisiv tcejbuS"
        `),
        check: { kind: 'stdout', expected: 'Subject visits the bell tower at night.' },
        hints: [
          'A slice with a step of -1 reverses a string.',
          'page[::-1]',
          'print(page[::-1])',
        ],
        solution: dd(`
          page = ".thgin ta rewot lleb eht stisiv tcejbuS"
          print(page[::-1])
        `),
      },
      {
        id: 'l08e2',
        prompt: 'A camera log line has four parts separated by spaces. Print just the camera name (the third part), then on the next line YES if the line mentions PERSON, otherwise NO.',
        starter: dd(`
          line = "DAY08 03:14 CAM07 PERSON"
        `),
        check: { kind: 'stdout', expected: 'CAM07\nYES' },
        hints: [
          'line.split() gives a list of the four parts. The third part is at index 2.',
          'For the second line, use if "PERSON" in line:',
          'parts = line.split()\nprint(parts[2])\nif "PERSON" in line:\n    print("YES")\nelse:\n    print("NO")',
        ],
        solution: dd(`
          line = "DAY08 03:14 CAM07 PERSON"
          parts = line.split()
          print(parts[2])
          if "PERSON" in line:
              print("YES")
          else:
              print("NO")
        `),
      },
      {
        id: 'l08e3',
        prompt: "Koshkin's old ledger shouts the names in capitals, separated by commas. Print them neatly: each name in Title Case, joined with ' | ' between them.",
        starter: dd(`
          raw = "DOLLY FINCH,HANK BRUBAKER,RUTH AQPIK"
        `),
        check: { kind: 'stdout', expected: 'Dolly Finch | Hank Brubaker | Ruth Aqpik' },
        hints: [
          '.title() fixes the capitals and .split(",") makes a list of names.',
          'Then " | ".join(the_list) glues them back together.',
          'names = raw.title().split(",")\nprint(" | ".join(names))',
        ],
        solution: dd(`
          raw = "DOLLY FINCH,HANK BRUBAKER,RUTH AQPIK"
          names = raw.title().split(",")
          print(" | ".join(names))
        `),
      },
    ],
  },
  // -------------------------------------------------------------------------
  {
    id: 'l09',
    day: 9,
    title: 'Recipes',
    ru: { line: 'Функция — это рецепт: написал один раз — готовишь сколько хочешь.', en: 'A function is a recipe: write it once, cook it as often as you like.' },
    pages: [
      {
        text: "A function is a named block of code you can run whenever you like. def name(): starts it, and the indented block underneath is its body. Defining a function doesn't run it; calling it does: name(). Write it once, use it everywhere. Koshkin's pelmeni recipe works the same way, and it's been in use since 1911.",
        code: dd(`
          def radio_check():
              print("Rybka here.")
              print("Signal clear.")

          radio_check()
          radio_check()
        `),
      },
      {
        text: "Parameters are the ingredients: names inside the brackets that receive values when the function is called. greet(\"Dolly\") runs the body with name set to \"Dolly\". You can have several parameters, separated by commas, and give one a default value with =, which is used when the caller leaves it out.",
        code: dd(`
          def greet(name, greeting="Hi"):
              print(f"{greeting}, {name}!")

          greet("Dolly")
          greet("Hank", "Morning")
        `),
      },
      {
        text: "print only shows a value on the screen. return hands the value back to whoever called the function, so they can store it and keep working with it. A function without return gives back None. This is the big one, Rybka: most bugs I see at Night School are a print where a return should be.",
        code: dd(`
          def crates_needed(fish, per_crate):
              full = fish // per_crate
              if fish % per_crate > 0:
                  full += 1
              return full

          n = crates_needed(137, 12)
          print(n, n * 2)
        `),
      },
      {
        text: "Variables made inside a function are local: they exist only while it runs, then vanish. That's good. Functions can't trample each other's variables. Give a function everything it needs through parameters, and take the result out with return. Clean pipes, no leaks, like one of Grisha's engines.",
        code: dd(`
          def total_price(prices):
              total = 0
              for p in prices:
                  total += p
              return total

          print(total_price([4, 12, 2]))
          print(total_price([]))
        `),
      },
    ],
    exercises: [
      {
        id: 'l09e1',
        prompt: 'Write crates(fish): return how many crates of 12 you need for that many fish. A partly filled crate still counts as a crate, and 0 fish need 0 crates.',
        starter: dd(`
          def crates(fish):
              # return the number of crates of 12
              pass
        `),
        check: { kind: 'call', fn: 'crates', cases: [{ args: [137], expect: 12 }, { args: [144], expect: 12 }, { args: [0], expect: 0 }, { args: [1], expect: 1 }, { args: [25], expect: 3 }] },
        hints: [
          'fish // 12 counts the full crates. fish % 12 is what is left over.',
          'If there are leftovers (fish % 12 > 0), you need one more crate.',
          'def crates(fish):\n    n = fish // 12\n    if fish % 12 > 0:\n        n += 1\n    return n',
        ],
        solution: dd(`
          def crates(fish):
              n = fish // 12
              if fish % 12 > 0:
                  n += 1
              return n
        `),
      },
      {
        id: 'l09e2',
        prompt: "Write sign(name, votes) for the petition table. It returns a line like 'Ruth Aqpik: 412 votes'. Grammar matters to Ruth: exactly 1 vote is '1 vote'.",
        starter: dd(`
          def sign(name, votes):
              return name + ": " + votes + " votes"
        `),
        check: { kind: 'call', fn: 'sign', cases: [{ args: ['Ruth Aqpik', 412], expect: 'Ruth Aqpik: 412 votes' }, { args: ['Ray Moody', 1], expect: 'Ray Moody: 1 vote' }, { args: ['Lyle Pruitt', 0], expect: 'Lyle Pruitt: 0 votes' }] },
        hints: [
          "votes is a number, so + can't glue it to text. An f-string can.",
          'Use if votes == 1: to choose between "vote" and "votes".',
          'def sign(name, votes):\n    if votes == 1:\n        return f"{name}: 1 vote"\n    return f"{name}: {votes} votes"',
        ],
        solution: dd(`
          def sign(name, votes):
              if votes == 1:
                  return f"{name}: 1 vote"
              return f"{name}: {votes} votes"
        `),
      },
      {
        id: 'l09e3',
        prompt: "Write is_clean(frame): return True if a camera frame does NOT contain PERSON, and False if it does. The starter has the classic Night School bug. Find it.",
        starter: dd(`
          def is_clean(frame):
              if "PERSON" in frame:
                  print(False)
              else:
                  print(True)
        `),
        check: { kind: 'call', fn: 'is_clean', cases: [{ args: ['street empty 03:00'], expect: true }, { args: ['PERSON at lamp'], expect: false }, { args: ['dog PERSON dog'], expect: false }, { args: [''], expect: true }] },
        hints: [
          'The function shows the answer but never hands it back.',
          'Replace print with return.',
          'def is_clean(frame):\n    return "PERSON" not in frame',
        ],
        solution: dd(`
          def is_clean(frame):
              if "PERSON" in frame:
                  return False
              else:
                  return True
        `),
      },
    ],
  },
  // -------------------------------------------------------------------------
  {
    id: 'l10',
    day: 10,
    title: 'Whose Is This?',
    ru: { line: 'Словарь знает ответ на вопрос «чьё это?», а в нашем деле это очень полезно.', en: "A dictionary knows the answer to 'whose is this?', and in our line of work that's very useful." },
    pages: [
      {
        text: "A dictionary stores pairs: a key and its value. Curly braces, key: value, commas between the pairs. You look things up by key, not by position: phone[\"Dolly\"]. Keys are usually strings; values can be anything at all. It's a phone book, a price list, a who-owns-what. Assigning to a new key adds a new pair.",
        code: dd(`
          phone = {"Dolly": "555-0142", "Hank": "555-0177"}
          print(phone["Dolly"])
          phone["Ruth"] = "555-0101"
          print(phone)
          print(len(phone))
        `),
      },
      {
        text: "Ask for a key that isn't there and you get a KeyError. Two safe ways around it: check first with if key in d, or use d.get(key, default), which returns the default instead of crashing. .get is my favourite word in all of Python. Well, after 'tea'.",
        code: dd(`
          prices = {"cod": 5, "crab": 12}
          print("eel" in prices)
          print(prices.get("eel", 0))
          print(prices.get("crab", 0))
        `),
      },
      {
        text: "for key in d loops over the keys. for key, value in d.items() gives you both at once. Dictionaries remember the order in which things were added. Want them alphabetical instead? Loop over sorted(d). Need just the values? d.values(), for example inside sum(d.values()).",
        code: dd(`
          stock = {"tea": 12, "salt": 3, "rope": 7}
          for item, qty in stock.items():
              print(item, qty)
          for item in sorted(stock):
              print(item)
          print(sum(stock.values()))
        `),
      },
      {
        text: "The classic dictionary job is counting. For each thing: counts[x] = counts.get(x, 0) + 1. The first time, get gives 0, so the count becomes 1; after that it just keeps adding. This one line has uncovered more secrets than any spy camera ever made. Learn it by heart.",
        code: dd(`
          votes = ["Ruth", "Lyle", "Ruth", "Ruth", "Lyle", "Ray"]
          counts = {}
          for v in votes:
              counts[v] = counts.get(v, 0) + 1
          print(counts)
        `),
      },
    ],
    exercises: [
      {
        id: 'l10e1',
        prompt: "Write price_of(item): return Koshkin's price for the item from PRICES, or 0 if he doesn't sell it. The starter crashes on anything exotic.",
        starter: dd(`
          PRICES = {"tea": 4, "salt": 2, "kerosene": 9, "herring": 3}

          def price_of(item):
              return PRICES[item]
        `),
        check: { kind: 'call', fn: 'price_of', cases: [{ args: ['tea'], expect: 4 }, { args: ['kerosene'], expect: 9 }, { args: ['caviar'], expect: 0 }] },
        hints: [
          'PRICES[item] crashes with KeyError when the item is missing.',
          '.get(key, default) returns the default instead of crashing.',
          'def price_of(item):\n    return PRICES.get(item, 0)',
        ],
        solution: dd(`
          PRICES = {"tea": 4, "salt": 2, "kerosene": 9, "herring": 3}

          def price_of(item):
              return PRICES.get(item, 0)
        `),
      },
      {
        id: 'l10e2',
        prompt: 'Write count_words(text): return a dictionary that says how many times each word appears in the text.',
        starter: dd(`
          def count_words(text):
              counts = {}
              # split the text into words and count them
              return counts
        `),
        check: { kind: 'call', fn: 'count_words', cases: [{ args: ['the dome the gala the end'], expect: { the: 3, dome: 1, gala: 1, end: 1 } }, { args: [''], expect: {} }, { args: ['Halloran'], expect: { Halloran: 1 } }] },
        hints: [
          'text.split() gives you the list of words.',
          'For each word: counts[word] = counts.get(word, 0) + 1',
          'def count_words(text):\n    counts = {}\n    for word in text.split():\n        counts[word] = counts.get(word, 0) + 1\n    return counts',
        ],
        solution: dd(`
          def count_words(text):
              counts = {}
              for word in text.split():
                  counts[word] = counts.get(word, 0) + 1
              return counts
        `),
      },
      {
        id: 'l10e3',
        prompt: "Write total_by_customer(sales). Each sale from Koshkin's till is a pair [name, amount]. Return a dictionary of name -> total spent.",
        starter: dd(`
          def total_by_customer(sales):
              totals = {}
              return totals
        `),
        check: { kind: 'call', fn: 'total_by_customer', cases: [{ args: [[['Dolly', 12], ['Hank', 5], ['Dolly', 3], ['Ruth', 20]]], expect: { Dolly: 15, Hank: 5, Ruth: 20 } }, { args: [[]], expect: {} }, { args: [[['Tommy', 7]]], expect: { Tommy: 7 } }] },
        hints: [
          'Loop with two names, like enumerate taught you: for name, amount in sales:',
          'Add to the total the counting way: totals[name] = totals.get(name, 0) + amount',
          'for name, amount in sales:\n    totals[name] = totals.get(name, 0) + amount',
        ],
        solution: dd(`
          def total_by_customer(sales):
              totals = {}
              for name, amount in sales:
                  totals[name] = totals.get(name, 0) + amount
              return totals
        `),
      },
    ],
  },
  // -------------------------------------------------------------------------
  {
    id: 'l11',
    day: 11,
    title: 'Matryoshka Data',
    ru: { line: 'Данные «Нортстара» — как матрёшка: список, в нём словари, а в них ещё что-то.', en: "Northstar's data is like a matryoshka: a list, dictionaries inside it, and more inside those." },
    pages: [
      {
        text: "Real data is nested. A list of dictionaries is the most common shape on Earth: each dictionary is one record, a person, a payment, a camera frame, and the list holds them all. Read a field in two steps: council[0][\"name\"] means first take position 0, then key \"name\".",
        code: dd(`
          council = [
              {"name": "Dolly Finch", "votes": 312},
              {"name": "Lyle Pruitt", "votes": 290},
          ]
          print(council[0]["name"])
          print(council[1]["votes"])
        `),
      },
      {
        text: "Loop over the list and each item is a whole dictionary. Pull out the field you need, and keep the records that pass a test. This is how we sift Northstar's paperwork: loop, check, collect. Nothing fancy. Fancy gets you caught.",
        code: dd(`
          council = [
              {"name": "Dolly Finch", "votes": 312},
              {"name": "Lyle Pruitt", "votes": 290},
              {"name": "Ray Moody", "votes": 175},
          ]
          strong = []
          for m in council:
              if m["votes"] > 200:
                  strong.append(m["name"])
          print(strong)
        `),
      },
      {
        text: "sorted() sorts numbers and strings without help, but how should it sort dictionaries? Tell it what to look at with key=: a function that takes one item and returns the value to sort by. Add reverse=True to put the biggest first.",
        code: dd(`
          council = [
              {"name": "Dolly Finch", "votes": 312},
              {"name": "Ruth Aqpik", "votes": 401},
              {"name": "Ray Moody", "votes": 175},
          ]

          def by_votes(m):
              return m["votes"]

          for m in sorted(council, key=by_votes, reverse=True):
              print(m["name"], m["votes"])
        `),
      },
      {
        text: "Writing a whole def just for a key is a lot of typing. lambda makes a tiny one-line function on the spot: key=lambda f: f[\"kg\"] means 'given f, use f[\"kg\"]'. Same result, less tea spilled. max() and min() take key= as well, and hand you the whole record that won.",
        code: dd(`
          fish = [
              {"kind": "cod", "kg": 4.5},
              {"kind": "halibut", "kg": 21.0},
              {"kind": "char", "kg": 2.25},
          ]
          for f in sorted(fish, key=lambda f: f["kg"]):
              print(f["kind"], f["kg"])
          heaviest = max(fish, key=lambda f: f["kg"])
          print(heaviest["kind"])
        `),
      },
    ],
    exercises: [
      {
        id: 'l11e1',
        prompt: 'Write names_over(members, limit): return a list of the names of council members with MORE than limit votes, in their original order.',
        starter: dd(`
          def names_over(members, limit):
              result = []
              return result
        `),
        check: { kind: 'call', fn: 'names_over', cases: [{ args: [COUNCIL, 289], expect: ['Dolly Finch', 'Ruth Aqpik', 'Lyle Pruitt'] }, { args: [COUNCIL, 500], expect: [] }, { args: [COUNCIL, 288], expect: ['Dolly Finch', 'Ruth Aqpik', 'Lyle Pruitt'] }, { args: [[], 0], expect: [] }] },
        hints: [
          'Loop over members; each m is a dictionary with "name" and "votes".',
          'if m["votes"] > limit: append m["name"] to result.',
          'for m in members:\n    if m["votes"] > limit:\n        result.append(m["name"])\nreturn result',
        ],
        solution: dd(`
          def names_over(members, limit):
              result = []
              for m in members:
                  if m["votes"] > limit:
                      result.append(m["name"])
              return result
        `),
      },
      {
        id: 'l11e2',
        prompt: 'Write ranking(members): return the list of names sorted by votes, highest first.',
        starter: dd(`
          def ranking(members):
              return sorted(members)
        `),
        check: { kind: 'call', fn: 'ranking', cases: [{ args: [COUNCIL], expect: ['Ruth Aqpik', 'Dolly Finch', 'Lyle Pruitt', 'Hank Brubaker', 'Ray Moody'] }, { args: [[{ name: 'Nina Kowalczyk', votes: 17 }]], expect: ['Nina Kowalczyk'] }, { args: [[]], expect: [] }] },
        hints: [
          'Dictionaries can only be sorted with key=lambda m: m["votes"]. Add reverse=True.',
          'Then loop over the sorted list and collect just the names.',
          'ordered = sorted(members, key=lambda m: m["votes"], reverse=True)\nnames = []\nfor m in ordered:\n    names.append(m["name"])\nreturn names',
        ],
        solution: dd(`
          def ranking(members):
              ordered = sorted(members, key=lambda m: m["votes"], reverse=True)
              names = []
              for m in ordered:
                  names.append(m["name"])
              return names
        `),
      },
      {
        id: 'l11e3',
        prompt: "Write total_for(payments, payee): payments is a list of dictionaries with 'payee' and 'amount'. Return the total amount paid to that payee (0 if none).",
        starter: dd(`
          def total_for(payments, payee):
              total = 0
              return total
        `),
        check: {
          kind: 'call',
          fn: 'total_for',
          cases: [
            { args: [[{ payee: 'Lyle Pruitt', amount: 5000 }, { payee: 'Gideon Shaw', amount: 800 }, { payee: 'Lyle Pruitt', amount: 2500 }], 'Lyle Pruitt'], expect: 7500 },
            { args: [[{ payee: 'Lyle Pruitt', amount: 5000 }, { payee: 'Gideon Shaw', amount: 800 }], 'Gideon Shaw'], expect: 800 },
            { args: [[{ payee: 'Lyle Pruitt', amount: 5000 }], 'Walt Hennessey'], expect: 0 },
            { args: [[], 'Lyle Pruitt'], expect: 0 },
          ],
        },
        hints: [
          'Loop over payments and look at p["payee"].',
          'When it equals the payee you were asked about, add p["amount"] to total.',
          'for p in payments:\n    if p["payee"] == payee:\n        total += p["amount"]\nreturn total',
        ],
        solution: dd(`
          def total_for(payments, payee):
              total = 0
              for p in payments:
                  if p["payee"] == payee:
                      total += p["amount"]
              return total
        `),
      },
    ],
  },
  // -------------------------------------------------------------------------
  {
    id: 'l12',
    day: 12,
    title: "Baba Valya's Codes",
    ru: { line: 'Сегодня урок ведёт Баба Валя, так что слушай внимательно: она шифровала, когда меня ещё на свете не было.', en: 'Tonight Baba Valya teaches, so listen closely: she was encrypting before I was even born.' },
    pages: [
      {
        text: "Lyosha here, typing while Baba Valya talks, so these notes are mostly her words. 'Every letter is secretly a number, Rybka.' ord(\"A\") gives 65, the character's code. chr(65) turns the number back into \"A\". Letters in a row have codes in a row: B is 66, C is 67. 'In 1974 we did this with paper tables,' she says. 'You have it easy.'",
        code: dd(`
          print(ord("A"), ord("B"), ord("a"))
          print(chr(72) + chr(105))
          print(chr(ord("A") + 2))
        `),
      },
      {
        text: "'Julius Caesar shifted every letter three places. The Romans thought it was clever. So does Northstar.' To shift a letter, take its code, add the shift, turn it back: chr(ord(c) + 3). To undo it, subtract. Do it for every character in a loop and build a new string with +=.",
        code: dd(`
          secret = ""
          for c in "DOME":
              secret += chr(ord(c) + 3)
          print(secret)
          plain = ""
          for c in secret:
              plain += chr(ord(c) - 3)
          print(plain)
        `),
      },
      {
        text: "'Z plus three is not a letter. Fix it.' Find the position inside the alphabet: ord(c) - ord(\"A\") gives 0 for A up to 25 for Z. Add the shift, use % 26 to wrap past Z back to A, then add ord(\"A\") again. Valya calls % 'the clock trick': after 25 comes 0, like hours after midnight.",
        code: dd(`
          def shift(c, k):
              pos = ord(c) - ord("A")
              return chr((pos + k) % 26 + ord("A"))

          print(shift("Y", 3), shift("Z", 3), shift("C", -3))
        `),
      },
      {
        text: "'Now the real thing.' ^ is XOR: it compares two numbers bit by bit. The magic is that XOR with the same key twice gives back what you started with: 65 ^ 23 is 86, and 86 ^ 23 is 65 again. So the same code locks and unlocks. 'One key, two doors,' Valya says, and knits a little faster. That means she's pleased.",
        code: dd(`
          print(65 ^ 23, 86 ^ 23)
          key = 23
          locked = chr(ord("A") ^ key)
          print(locked)
          print(chr(ord(locked) ^ key))
        `),
      },
    ],
    exercises: [
      {
        id: 'l12e1',
        prompt: 'Write codes(word): return a list of the character codes of the word, in order.',
        starter: dd(`
          def codes(word):
              result = []
              return result
        `),
        check: { kind: 'call', fn: 'codes', cases: [{ args: ['ABC'], expect: [65, 66, 67] }, { args: ['hi'], expect: [104, 105] }, { args: [''], expect: [] }] },
        hints: [
          'Loop over the characters: for c in word:',
          'Append ord(c) for each one.',
          'for c in word:\n    result.append(ord(c))\nreturn result',
        ],
        solution: dd(`
          def codes(word):
              result = []
              for c in word:
                  result.append(ord(c))
              return result
        `),
      },
      {
        id: 'l12e2',
        prompt: "Write caesar(text, k): shift every UPPERCASE letter k places, wrapping around past Z (k can be negative). Leave everything else, spaces, digits, dashes, exactly as it is.",
        starter: dd(`
          def caesar(text, k):
              result = ""
              for c in text:
                  result += chr(ord(c) + k)
              return result
        `),
        check: { kind: 'call', fn: 'caesar', cases: [{ args: ['ATTACK AT DAWN', 3], expect: 'DWWDFN DW GDZQ' }, { args: ['XYZ', 3], expect: 'ABC' }, { args: ['DWWDFN', -3], expect: 'ATTACK' }, { args: ['GALA-14', 1], expect: 'HBMB-14' }] },
        hints: [
          'Only shift when the character is a capital letter: if "A" <= c <= "Z":',
          'Use the clock trick: pos = ord(c) - ord("A"), then chr((pos + k) % 26 + ord("A")).',
          'for c in text:\n    if "A" <= c <= "Z":\n        pos = ord(c) - ord("A")\n        result += chr((pos + k) % 26 + ord("A"))\n    else:\n        result += c',
        ],
        solution: dd(`
          def caesar(text, k):
              result = ""
              for c in text:
                  if "A" <= c <= "Z":
                      pos = ord(c) - ord("A")
                      result += chr((pos + k) % 26 + ord("A"))
                  else:
                      result += c
              return result
        `),
      },
      {
        id: 'l12e3',
        prompt: "Baba Valya's lock: write xor_text(text, key). XOR every character's code with key and return the new string. Running it twice with the same key must give back the original.",
        starter: dd(`
          def xor_text(text, key):
              return text
        `),
        check: { kind: 'call', fn: 'xor_text', cases: [{ args: ['VAULT', 23], expect: 'AVB[C' }, { args: ['AVB[C', 23], expect: 'VAULT' }, { args: ['Rybka', 1], expect: 'Sxcj`' }, { args: ['', 5], expect: '' }] },
        hints: [
          'Build a new string in a loop, one character at a time.',
          'Each new character is chr(ord(c) ^ key).',
          'result = ""\nfor c in text:\n    result += chr(ord(c) ^ key)\nreturn result',
        ],
        solution: dd(`
          def xor_text(text, key):
              result = ""
              for c in text:
                  result += chr(ord(c) ^ key)
              return result
        `),
      },
    ],
  },
  // -------------------------------------------------------------------------
  {
    id: 'l13',
    day: 13,
    title: 'Reading Errors',
    ru: { line: 'Ошибка — не враг, Рыбка, а записка о том, где искать.', en: "An error isn't the enemy, Rybka. It's a note telling you where to look." },
    pages: [
      {
        text: "When Python stops with an error, read the last line first: it names the type of error and what went wrong. Then look at the line number. The mistake is usually on that line, or just above it if a bracket or quote never closed. Don't panic and don't change things at random. Read, think, fix one thing, run again.",
        code: dd(`
          # NameError: name 'totl' is not defined. Did you mean: 'total'?
          #   -> a typo. The variable is called total.
          total = 10
          print(total)
        `),
      },
      {
        text: "The usual suspects. NameError: a typo, or a name used before it got a value. TypeError: mixing types, like \"3\" + 4. IndexError: a position past the end of a list. KeyError: a missing dictionary key. IndentationError: spaces out of line. SyntaxError: Python can't even read the line, usually a missing colon, bracket or quote.",
        code: dd(`
          prices = {"cod": 5}
          print(prices.get("crab", "no crab today"))
          items = ["tea", "salt"]
          print(items[len(items) - 1])
          print("3" + str(4), int("3") + 4)
        `),
      },
      {
        text: "When the output is wrong but there's no error, print is your torch. Print the variables inside the loop and watch where reality and your plan part ways. And test the edge cases on purpose: an empty list, a single item, zero, negative numbers. Northstar's code breaks on edge cases. Ours won't.",
        code: dd(`
          def average(nums):
              if len(nums) == 0:
                  return 0
              return sum(nums) / len(nums)

          print(average([4, 8]))
          print(average([]))
        `),
      },
      {
        text: "Sometimes you expect trouble. try: runs some code, and if a particular error happens, except ValueError: runs instead of crashing. Use it for messy input, like a camera log where some readings are garbage. Don't use it to hide your own bugs. Valya will know. She always knows.",
        code: dd(`
          readings = ["12", "x7", "40", ""]
          good = []
          for r in readings:
              try:
                  good.append(int(r))
              except ValueError:
                  print("skipping", repr(r))
          print(good)
        `),
      },
    ],
    exercises: [
      {
        id: 'l13e1',
        prompt: "last_item(items) should return the last item of a list, or None if the list is empty. It won't even start. Fix every bug: read each error message.",
        starter: dd(`
          def last_item(items)
              # return the last item, or None if the list is empty
              return items[len(items)]
        `),
        check: { kind: 'call', fn: 'last_item', cases: [{ args: [['tea', 'salt', 'rope']], expect: 'rope' }, { args: [[42]], expect: 42 }, { args: [[]], expect: null }] },
        hints: [
          'First error: SyntaxError: expected \':\'. Every def line ends with a colon.',
          'Next: positions go up to len(items) - 1, so items[len(items)] is one past the end. items[-1] is the last item. An empty list has no last item at all.',
          'def last_item(items):\n    if len(items) == 0:\n        return None\n    return items[-1]',
        ],
        solution: dd(`
          def last_item(items):
              if len(items) == 0:
                  return None
              return items[-1]
        `),
      },
      {
        id: 'l13e2',
        prompt: 'count_vowels(text) should count the vowels a, e, i, o, u in any case. It runs, but the answers are wrong. There are two bugs.',
        starter: dd(`
          def count_vowels(text):
              count = 0
              for c in text:
                  if c in "aeiou":
                      count = 1
              return count
        `),
        check: { kind: 'call', fn: 'count_vowels', cases: [{ args: ['Aurora'], expect: 4 }, { args: ['xyz'], expect: 0 }, { args: ['OKAFOR'], expect: 3 }, { args: [''], expect: 0 }] },
        hints: [
          'Print count inside the loop and watch it. Does it ever go above 1?',
          'count = 1 sets it to one; you want count += 1. And "A" in "aeiou" is False: compare c.lower() instead.',
          'for c in text:\n    if c.lower() in "aeiou":\n        count += 1',
        ],
        solution: dd(`
          def count_vowels(text):
              count = 0
              for c in text:
                  if c.lower() in "aeiou":
                      count += 1
              return count
        `),
      },
      {
        id: 'l13e3',
        prompt: 'average_price(prices) should return the average of the prices rounded DOWN to a whole number (use //), and 0 for an empty list. It has three bugs. Find them all.',
        starter: dd(`
          def average_price(prices):
              total = 0
              for p in prices:
                  total + p
              return total / len(prices)
        `),
        check: { kind: 'call', fn: 'average_price', cases: [{ args: [[4, 5, 9]], expect: 6 }, { args: [[10]], expect: 10 }, { args: [[]], expect: 0 }, { args: [[1, 2]], expect: 1 }] },
        hints: [
          'total + p calculates something and throws it away. It needs to be stored.',
          'The task says rounded down to a whole number: that is //, not /. And an empty list means dividing by zero.',
          'def average_price(prices):\n    if len(prices) == 0:\n        return 0\n    total = 0\n    for p in prices:\n        total += p\n    return total // len(prices)',
        ],
        solution: dd(`
          def average_price(prices):
              if len(prices) == 0:
                  return 0
              total = 0
              for p in prices:
                  total += p
              return total // len(prices)
        `),
      },
    ],
  },
  // -------------------------------------------------------------------------
  {
    id: 'l14',
    day: 14,
    title: 'Dress Rehearsal',
    ru: { line: 'Скоро у тебя будет всего десять минут, поэтому сегодня у нас репетиция.', en: "Soon you'll have just ten minutes, so tonight we rehearse." },
    pages: [
      {
        text: "Here's what we know about the drive. The Root Key is split into shards: a list of strings. Some shards are decoys. Every real shard is stored backwards, and every character in it is shifted. On the night the rules will be different, because Halloran isn't stupid, but the shape will be the same. Tonight, my rules: decoys end with \"!\", and every character is shifted up by 1.",
        code: dd(`
          shards = ["NPE", "GO!", ".F", "OP"]
          print(len(shards), "shards")
          print(shards[1].endswith("!"))
        `),
      },
      {
        text: "Break the problem into small steps and check each one before the next. Step one: keep only the real shards. A loop, an if and .endswith() build a new list. Never delete from a list while you're looping over it; build a new one instead. Step two: flip each real shard with [::-1] and glue them together in order.",
        code: dd(`
          shard = "CBA"
          print(shard[::-1])
          glued = ""
          for piece in ["ab", "cd"]:
              glued += piece
          print(glued)
        `),
      },
      {
        text: "Step three: walk through the glued string and shift every character back down: chr(ord(c) - 1). Build the answer in a new string. Then return it; don't print it. The dish only listens to return. Print is for you to peek while you work. Take the peeks out before the end.",
        code: dd(`
          word = "EPNF"
          plain = ""
          for c in word:
              plain += chr(ord(c) - 1)
          print(plain)
        `),
      },
      {
        text: "On the night: breathe. Read the rules twice. Write the function in small steps and run it after each step. Check the edge cases: no decoys at all, only one real shard. If an error appears, read the last line. And if for some reason I'm not on the radio, you won't need me, Rybka. You've done every piece of this already.",
      },
    ],
    exercises: [
      {
        id: 'l14e1',
        prompt: 'Step one. Write keep_real(shards): return a new list with only the real shards. Decoys end with "!".',
        starter: dd(`
          def keep_real(shards):
              real = []
              return real
        `),
        check: { kind: 'call', fn: 'keep_real', cases: [{ args: [['NPE', 'GO!', '.F', 'OP']], expect: ['NPE', '.F', 'OP'] }, { args: [['A!', 'B!']], expect: [] }, { args: [['ABC']], expect: ['ABC'] }, { args: [[]], expect: [] }] },
        hints: [
          'Loop over shards and check each one with .endswith("!").',
          'Append only the shards that do NOT end with "!".',
          'for s in shards:\n    if not s.endswith("!"):\n        real.append(s)\nreturn real',
        ],
        solution: dd(`
          def keep_real(shards):
              real = []
              for s in shards:
                  if not s.endswith("!"):
                      real.append(s)
              return real
        `),
      },
      {
        id: 'l14e2',
        prompt: 'Step two. Write glue(shards): reverse every shard and join them, in order, into one string. (No decoys in this step.)',
        starter: dd(`
          def glue(shards):
              joined = ""
              return joined
        `),
        check: { kind: 'call', fn: 'glue', cases: [{ args: [['NPE', '.F', 'OP']], expect: 'EPNF.PO' }, { args: [['CBA']], expect: 'ABC' }, { args: [['21', '43']], expect: '1234' }, { args: [[]], expect: '' }] },
        hints: [
          'Loop over shards. s[::-1] is a shard reversed.',
          'Add each reversed shard to joined with +=.',
          'for s in shards:\n    joined += s[::-1]\nreturn joined',
        ],
        solution: dd(`
          def glue(shards):
              joined = ""
              for s in shards:
                  joined += s[::-1]
              return joined
        `),
      },
      {
        id: 'l14e3',
        prompt: 'The full rehearsal. Write unwrap(shards): drop the decoys (they end with "!"), reverse each real shard, join them in order, then shift every character DOWN by 1. Return the code.',
        starter: dd(`
          def unwrap(shards):
              code = ""
              return code
        `),
        check: { kind: 'call', fn: 'unwrap', cases: [{ args: [['NPE', 'GO!', '.F', 'OP']], expect: 'DOME-ON' }, { args: [['BMBH', 'JO.', 'UIH']], expect: 'GALA-NIGHT' }, { args: [['DECOY!', 'UMVBW', 'X!', '!!']], expect: 'VAULT' }, { args: [['!', 'L', '.ZF!', '.ZF', '52']], expect: 'KEY-14' }] },
        hints: [
          'Do it in two loops. First loop: skip decoys and glue the reversed real shards into one string.',
          'Second loop: go through the glued string and add chr(ord(c) - 1) for each character.',
          'joined = ""\nfor s in shards:\n    if not s.endswith("!"):\n        joined += s[::-1]\ncode = ""\nfor c in joined:\n    code += chr(ord(c) - 1)\nreturn code',
        ],
        solution: dd(`
          def unwrap(shards):
              joined = ""
              for s in shards:
                  if not s.endswith("!"):
                      joined += s[::-1]
              code = ""
              for c in joined:
                  code += chr(ord(c) - 1)
              return code
        `),
      },
    ],
  },
];

/** Find a lesson by id ('l07') or by day (7). */
export function lessonFor(idOrDay) {
  return LESSONS.find((l) => l.id === idOrDay || l.day === idOrDay) || null;
}
