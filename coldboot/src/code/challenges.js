// COLD BOOT — field hacks and the finale.
//
// CHALLENGES[id] = {
//   id, day, title,
//   briefing,              // what Nadia / Lyosha say before the hack (English)
//   timeLimit,             // seconds, or null for no clock
//   natives: [names],      // host functions the game injects for this mission (documented in NATIVES)
//   data: { name: value }, // globals the game injects (vm.set) — the "real" mission data
//   live,                  // Python the game runs after the checks pass, with natives + data in place
//   prompt, starter, check, hints: [3], solution   // same shape as a lesson exercise
// }
//
// Flow in the game:
//   1. Player edits `starter`. On "Run tests": checkExercise(ch, code, { natives, data }) from ./check.js.
//   2. When it passes: vm = new PyVM(); define natives; vm.set(...data); vm.load(code); vm.load(ch.live).
//      The natives receive the player's real results (e.g. send(code) gets the abort code).
// The checks only look at return values; the natives are what make the world react.

const dd = (s) => {
  const lines = s.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
  const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return lines.map((l) => l.slice(ind)).join('\n') + '\n';
};

/** Host functions the game injects. `call` is how Python sees it; the game implements the behaviour. */
export const NATIVES = {
  report: {
    call: 'report(value)',
    doc: "Sends a value to Nadia's earpiece display (shown in the HUD). Returns None.",
  },
  'camera.feed': {
    call: 'camera.feed()',
    doc: 'Returns the live frames of the Bering Street streetlight camera as a list of strings, oldest first.',
  },
  'camera.loop': {
    call: 'camera.loop(frames)',
    doc: 'Uploads a list of frames for the camera to replay instead of the live picture. Returns how many frames were accepted.',
  },
  submit: {
    call: 'submit(names)',
    doc: 'Files the cleaned petition (a list of names) at the post office. Returns the number of signatures filed.',
  },
  publish: {
    call: 'publish(evidence)',
    doc: 'Puts a dict of payee -> total on the town hall projector during Debate Night. Returns None.',
  },
  'vault.insert_key': {
    call: 'vault.insert_key(key)',
    doc: 'Feeds the combined continuity-card key to the vault terminal. Returns True if the vault accepts it.',
  },
  'vault.screen': {
    call: 'vault.screen()',
    doc: 'Returns the (XOR-scrambled) text currently shown on the vault terminal.',
  },
  send: {
    call: 'send(code)',
    doc: 'Transmits the abort code through the troposcatter dish at Bely Mys. Returns "TRANSMITTED". This is the end of the game.',
  },
};

const COUNCIL_NAMES = ['Dolly Finch', 'Hank Brubaker', 'Ruth Aqpik', 'Ray Moody', 'Lyle Pruitt'];

export const CHALLENGES = {
  // -------------------------------------------------------------------------
  faces: {
    id: 'faces',
    day: 2,
    title: 'Faces in the Crowd',
    briefing: "Nadia: \"Council meeting, seven o'clock, back row. Your phone turned every face it saw into a name; Lyosha's matcher did the hard part. I need to know how many of the five council members actually showed up. Lyosha wrote most of the code. One line is missing.\"\nLyosha: \"matches is a box with a number in it. When a name is on the council list, the box should get one bigger. That's the whole job, Rybka.\"",
    timeLimit: null,
    natives: ['report'],
    data: {
      crowd: ['Dolly Finch', 'Pearl Jessup', 'Hank Brubaker', 'Lou Amarok', 'Ruth Aqpik', 'Father Gabriel Popov', 'Lyle Pruitt', 'Nina Kowalczyk', 'Gideon Shaw'],
      council: COUNCIL_NAMES,
    },
    live: 'report(count_council(crowd, council))',
    prompt: 'Finish count_council(crowd, council): it must return how many names in crowd are on the council list. Fill in the TODO line.',
    starter: dd(`
      # Lyosha: the phone already turned faces into names.
      # I wrote the loop for you (loops come later). Your job is the TODO line.

      def count_council(crowd, council):
          matches = 0
          for name in crowd:
              if name in council:
                  # TODO: add one to matches
                  pass
          return matches
    `),
    check: {
      kind: 'call',
      fn: 'count_council',
      cases: [
        { args: [['Dolly Finch', 'Pearl Jessup', 'Hank Brubaker', 'Lou Amarok', 'Ruth Aqpik', 'Ray Moody', 'Father Gabriel Popov', 'Lyle Pruitt', 'Nina Kowalczyk'], COUNCIL_NAMES], expect: 5 },
        { args: [['Evan Pike', 'Tommy Aqpik'], COUNCIL_NAMES], expect: 0 },
        { args: [['Ray Moody', 'Wade Tolliver', 'Ruth Aqpik', 'Doc Ellen Haverford', 'Lyle Pruitt'], COUNCIL_NAMES], expect: 3 },
        { args: [[], COUNCIL_NAMES], expect: 0 },
      ],
    },
    hints: [
      'Replace the line that says pass. Keep the same indentation as the comment above it.',
      'To make a number one bigger, take the old value and add 1: matches + 1. Then store it back into matches.',
      'matches = matches + 1',
    ],
    solution: dd(`
      def count_council(crowd, council):
          matches = 0
          for name in crowd:
              if name in council:
                  matches = matches + 1
          return matches
    `),
  },
  // -------------------------------------------------------------------------
  keypad: {
    id: 'keypad',
    day: 3,
    title: 'Ears Everywhere',
    briefing: "Nadia: \"While you mopped City Hall, the bug on the keypad logged every code anyone typed today. People fat-finger it, so the log is noisy. The real door code is the one typed most often.\"\nLyosha: \"I count the codes in a dictionary, you'll learn those on day ten. Then we walk through the counts and keep the biggest. That second loop is yours. If two codes tie, keep the one we met first.\"",
    timeLimit: null,
    natives: ['report'],
    data: { codes: ['4471', '0000', '4471', '1822', '4471', '0000', '7777', '4471', '1822'] },
    live: 'report(most_common(codes))',
    prompt: 'Finish most_common(codes): return the code that appears most often in the list. Fill in the TODO in the second loop.',
    starter: dd(`
      def most_common(codes):
          # Lyosha: this first loop counts each code in a dictionary.
          # (Dictionaries are lesson 10. For now, trust me.)
          counts = {}
          for code in codes:
              if code in counts:
                  counts[code] = counts[code] + 1
              else:
                  counts[code] = 1

          best = None
          best_count = 0
          for code in counts:
              # TODO: if counts[code] is bigger than best_count,
              # remember this code in best and its count in best_count
              pass
          return best
    `),
    check: {
      kind: 'call',
      fn: 'most_common',
      cases: [
        { args: [['4471', '0000', '4471', '1822', '4471', '0000']], expect: '4471' },
        { args: [['9001']], expect: '9001' },
        { args: [['1111', '2222', '2222', '1111']], expect: '1111' },
        { args: [['0420', '1822', '1822', '1822', '0420']], expect: '1822' },
      ],
    },
    hints: [
      'Inside the loop you need an if that compares counts[code] with best_count.',
      'When it is bigger, two things must change: best becomes code, and best_count becomes counts[code]. Use > (not >=) so a tie keeps the first code.',
      'if counts[code] > best_count:\n    best = code\n    best_count = counts[code]',
    ],
    solution: dd(`
      def most_common(codes):
          counts = {}
          for code in codes:
              if code in counts:
                  counts[code] = counts[code] + 1
              else:
                  counts[code] = 1

          best = None
          best_count = 0
          for code in counts:
              if counts[code] > best_count:
                  best = code
                  best_count = counts[code]
          return best
    `),
  },
  // -------------------------------------------------------------------------
  camloop: {
    id: 'camloop',
    day: 3,
    title: 'Counter-Surveillance',
    briefing: "Lyosha: \"The streetlight on Bering Street points straight at your cabin. I can't switch it off without Northstar noticing, but I can feed it a loop. Every frame with a PERSON in it gets swapped for the last clean frame before it, so the picture just shows an empty street for a bit longer. The first frame is always clean; I checked. Def and return are tomorrow's lesson; everything between them is yours.\"",
    timeLimit: null,
    natives: ['camera.feed', 'camera.loop'],
    data: {},
    live: 'camera.loop(clean_feed(camera.feed()))',
    prompt: 'Write the body of clean_feed(frames): return a new list where every frame containing "PERSON" is replaced by the most recent clean frame before it.',
    starter: dd(`
      def clean_feed(frames):
          result = []
          last_clean = frames[0]
          # TODO: loop over frames.
          #   - if a frame contains "PERSON", append last_clean instead of it
          #   - otherwise append the frame, and remember it as last_clean
          return result
    `),
    check: {
      kind: 'call',
      fn: 'clean_feed',
      cases: [
        {
          args: [['street empty 03:00', 'street empty 03:01', 'PERSON at lamp 03:02', 'PERSON near truck 03:03', 'street empty 03:04']],
          expect: ['street empty 03:00', 'street empty 03:01', 'street empty 03:01', 'street empty 03:01', 'street empty 03:04'],
        },
        { args: [['fox', 'snow']], expect: ['fox', 'snow'] },
        { args: [['lamp only']], expect: ['lamp only'] },
        { args: [['snow', 'PERSON', 'PERSON', 'snow 2', 'PERSON']], expect: ['snow', 'snow', 'snow', 'snow 2', 'snow 2'] },
      ],
    },
    hints: [
      'for frame in frames: then an if/else inside it.',
      'if "PERSON" in frame: append last_clean. else: append frame AND set last_clean = frame.',
      'for frame in frames:\n    if "PERSON" in frame:\n        result.append(last_clean)\n    else:\n        result.append(frame)\n        last_clean = frame',
    ],
    solution: dd(`
      def clean_feed(frames):
          result = []
          last_clean = frames[0]
          for frame in frames:
              if "PERSON" in frame:
                  result.append(last_clean)
              else:
                  result.append(frame)
                  last_clean = frame
          return result
    `),
  },
  // -------------------------------------------------------------------------
  petition: {
    id: 'petition',
    day: 4,
    title: 'The Vacant Seat',
    briefing: "Nadia: \"Ruth's petition to put you on the ballot. Half the town signed twice, some in capitals, Tommy signed three times. Pearl won't file it like that, and Lyle Pruitt would love an excuse to throw it out. One signature per person, capitals don't make a different person, keep the spelling they used first, and sort it alphabetically.\"",
    timeLimit: null,
    natives: ['submit'],
    data: {
      signatures: ['Ruth Aqpik', 'Tommy Aqpik', 'Dolly Finch', 'tommy aqpik', 'Lou Amarok', 'Pearl Jessup', 'RUTH AQPIK', 'Hank Brubaker', 'Tommy Aqpik', 'Nina Kowalczyk', 'Father Gabriel Popov', 'dolly finch', 'Wade Tolliver', 'Sasha Koshkin'],
    },
    live: 'submit(clean_petition(signatures))',
    prompt: 'Write clean_petition(signatures): drop duplicate names (ignoring upper/lower case), keep the first spelling of each, and return the list sorted alphabetically.',
    starter: dd(`
      def clean_petition(signatures):
          seen = []     # lowercase versions of names we've already met
          result = []   # the first spelling of each name
          for name in signatures:
              # TODO
              pass
          return result
    `),
    check: {
      kind: 'call',
      fn: 'clean_petition',
      cases: [
        {
          args: [['Ruth Aqpik', 'Tommy Aqpik', 'ruth aqpik', 'Dolly Finch', 'RUTH AQPIK', 'Lou Amarok', 'dolly finch']],
          expect: ['Dolly Finch', 'Lou Amarok', 'Ruth Aqpik', 'Tommy Aqpik'],
        },
        { args: [[]], expect: [] },
        { args: [['pearl jessup', 'Pearl Jessup']], expect: ['pearl jessup'] },
        { args: [['Wade Tolliver', 'Nina Kowalczyk', 'Doc Ellen Haverford']], expect: ['Doc Ellen Haverford', 'Nina Kowalczyk', 'Wade Tolliver'] },
      ],
    },
    hints: [
      'Compare names in lowercase: key = name.lower(). A name is new if key is not in seen.',
      'When it is new, append key to seen and the original name to result. At the end, return sorted(result).',
      'for name in signatures:\n    key = name.lower()\n    if key not in seen:\n        seen.append(key)\n        result.append(name)\nreturn sorted(result)',
    ],
    solution: dd(`
      def clean_petition(signatures):
          seen = []
          result = []
          for name in signatures:
              key = name.lower()
              if key not in seen:
                  seen.append(key)
                  result.append(name)
          return sorted(result)
    `),
  },
  // -------------------------------------------------------------------------
  ledger: {
    id: 'ledger',
    day: 4,
    title: 'Debate Night',
    briefing: "Lyosha: \"Ivan photographed Northstar's payment ledger. Tonight Lyle Pruitt will stand up in the town hall and swear Northstar never paid him a cent. Each row is a dictionary: payer, payee, amount, memo. I want, for every payee, the total Northstar Dynamics paid them, counting only payments over 1000 dollars. Small stuff is lunches. Big stuff is bribes. Then we put it on the projector.\"",
    timeLimit: null,
    natives: ['publish'],
    data: {
      ledger: [
        { payer: 'Northstar Dynamics', payee: 'Lyle Pruitt', amount: 5000, memo: 'consulting' },
        { payer: 'Northstar Dynamics', payee: 'Gideon Shaw', amount: 800, memo: 'lunch' },
        { payer: 'Dolly Finch', payee: 'Hank Brubaker', amount: 1200, memo: 'propane' },
        { payer: 'Northstar Dynamics', payee: 'Walt Hennessey', amount: 25000, memo: 'campaign support' },
        { payer: 'Northstar Dynamics', payee: 'Lyle Pruitt', amount: 2500, memo: 'retainer' },
        { payer: 'Northstar Dynamics', payee: 'Gideon Shaw', amount: 4100, memo: 'advisory' },
        { payer: 'Northstar Dynamics', payee: 'KZRY 88.9', amount: 300, memo: 'sponsorship' },
        { payer: 'Northstar Dynamics', payee: 'Lyle Pruitt', amount: 12000, memo: 'land survey' },
      ],
    },
    live: 'publish(northstar_payments(ledger))',
    prompt: 'Write northstar_payments(ledger): return a dict of payee -> total amount paid by "Northstar Dynamics", counting only payments with an amount over 1000.',
    starter: dd(`
      def northstar_payments(ledger):
          totals = {}
          # TODO: for each row paid by "Northstar Dynamics" with an amount over 1000,
          #       add the amount to totals[payee]
          return totals
    `),
    check: {
      kind: 'call',
      fn: 'northstar_payments',
      cases: [
        {
          args: [[
            { payer: 'Northstar Dynamics', payee: 'Lyle Pruitt', amount: 5000, memo: 'consulting' },
            { payer: 'Northstar Dynamics', payee: 'Gideon Shaw', amount: 800, memo: 'lunch' },
            { payer: 'Dolly Finch', payee: 'Hank Brubaker', amount: 1200, memo: 'propane' },
            { payer: 'Northstar Dynamics', payee: 'Lyle Pruitt', amount: 2500, memo: 'retainer' },
            { payer: 'Northstar Dynamics', payee: 'Gideon Shaw', amount: 4100, memo: 'advisory' },
          ]],
          expect: { 'Lyle Pruitt': 7500, 'Gideon Shaw': 4100 },
        },
        {
          args: [[
            { payer: 'Northstar Dynamics', payee: 'Walt Hennessey', amount: 1000, memo: 'exactly a thousand' },
            { payer: 'Northstar Dynamics', payee: 'Walt Hennessey', amount: 1001, memo: 'one more' },
          ]],
          expect: { 'Walt Hennessey': 1001 },
        },
        { args: [[]], expect: {} },
        { args: [[{ payer: 'Ruth Aqpik', payee: 'Holy Transfiguration', amount: 2000, memo: 'roof' }]], expect: {} },
      ],
    },
    hints: [
      'Loop over the rows: for row in ledger: and check row["payer"] and row["amount"] in one if with and.',
      'Add like you count: totals[payee] = totals.get(payee, 0) + row["amount"]. "Over 1000" means > 1000.',
      'for row in ledger:\n    if row["payer"] == "Northstar Dynamics" and row["amount"] > 1000:\n        payee = row["payee"]\n        totals[payee] = totals.get(payee, 0) + row["amount"]',
    ],
    solution: dd(`
      def northstar_payments(ledger):
          totals = {}
          for row in ledger:
              if row["payer"] == "Northstar Dynamics" and row["amount"] > 1000:
                  payee = row["payee"]
                  totals[payee] = totals.get(payee, 0) + row["amount"]
          return totals
    `),
  },
  // -------------------------------------------------------------------------
  shares: {
    id: 'shares',
    day: 5,
    title: 'Continuity Cards',
    briefing: "Baba Valya, on speaker: \"Shamir's trick. Five cards, any three open the door. Each card holds a share like '3:7F1A': the number of the card, a colon, a piece of the key. Put the pieces in the order of the numbers and glue them. Numbers, Rybka, not letters: ten comes after nine.\"\nLyosha: \"Halloran also printed spare cards. They go above ten. She's right.\"",
    timeLimit: null,
    natives: ['vault.insert_key'],
    data: { shares: ['4:B7E2', '1:C0DE', '2:9F31'] },
    live: 'vault.insert_key(combine(shares))',
    prompt: 'Write combine(shares): each share looks like "3:7F1A". Sort the shares by the number before the colon (as a number) and return their pieces joined together in that order.',
    starter: dd(`
      def combine(shares):
          # each share looks like "3:7F1A": number, colon, piece
          # sort by the number, then join the pieces in that order
          return ""
    `),
    check: {
      kind: 'call',
      fn: 'combine',
      cases: [
        { args: [['3:7F1A', '1:C0DE', '5:99B2']], expect: 'C0DE7F1A99B2' },
        { args: [['2:AA', '1:BB', '4:CC', '3:DD']], expect: 'BBAADDCC' },
        { args: [['10:Z', '9:Y', '2:X']], expect: 'XYZ' },
        { args: [['12:F0', '3:0D', '7:E1', '11:9A']], expect: '0DE19AF0' },
      ],
    },
    hints: [
      'share.split(":") gives [number, piece] as strings. int() turns the number into a real number.',
      'Write a small helper def card_number(share): return int(share.split(":")[0]), then sorted(shares, key=card_number).',
      'def card_number(share):\n    return int(share.split(":")[0])\n\ndef combine(shares):\n    key = ""\n    for share in sorted(shares, key=card_number):\n        key += share.split(":")[1]\n    return key',
    ],
    solution: dd(`
      def card_number(share):
          return int(share.split(":")[0])

      def combine(shares):
          key = ""
          for share in sorted(shares, key=card_number):
              key += share.split(":")[1]
          return key
    `),
  },
  // -------------------------------------------------------------------------
  vault: {
    id: 'vault',
    day: 5,
    title: 'The Vault Terminal',
    briefing: "Nadia, whispering: \"You're in. The terminal is showing gibberish. Valya says Halloran's people XOR everything with 23 and call it encryption. Decode the screen so we know what it's asking for. Quickly, Rybka. The Gala speech ends in six minutes.\"",
    timeLimit: 360,
    natives: ['vault.screen'],
    data: {},
    live: 'print(decode(vault.screen()))',
    prompt: 'Write decode(prompt): every character of the prompt was XORed with 23. Undo it: XOR each character code with 23 again and return the plain text.',
    starter: dd(`
      def decode(prompt):
          # every character was XORed with 23. Undo it.
          return prompt
    `),
    check: {
      kind: 'call',
      fn: 'decode',
      cases: [
        { args: ['RYCRE7ZBY^T^GV[7\\RN'], expect: 'ENTER MUNICIPAL KEY' },
        { args: ['^YDREC7$7TXYC^YB^CN7TVESD'], expect: 'INSERT 3 CONTINUITY CARDS' },
        { args: ['@R[TXZR;7ZE97_V[[XEVY'], expect: 'WELCOME, MR. HALLORAN' },
        { args: [''], expect: '' },
      ],
    },
    hints: [
      'XOR with the same key undoes itself. Go through the prompt one character at a time.',
      'Each plain character is chr(ord(c) ^ 23). Build the result with +=.',
      'def decode(prompt):\n    plain = ""\n    for c in prompt:\n        plain += chr(ord(c) ^ 23)\n    return plain',
    ],
    solution: dd(`
      def decode(prompt):
          plain = ""
          for c in prompt:
              plain += chr(ord(c) ^ 23)
          return plain
    `),
  },
  // -------------------------------------------------------------------------
  final: {
    id: 'final',
    day: 6,
    title: 'Cold Boot',
    briefing: "Bely Mys. The warehouse is empty: chairs knocked over, Lyosha's tea still warm. The border guards took them all. The drive is in the laptop and Grisha's dish is humming on the roof. Dawn in ten minutes. On the screen, a note in Lyosha's handwriting font: \"Halloran's rules: decoy shards START with #. Every real shard is written backwards. Every character is shifted UP by 3. You know this shape, Rybka. Write unwrap(shards), then send(unwrap(shards)).\"",
    timeLimit: 600,
    natives: ['send'],
    data: { shards: ['#HALLORAN', 'RUXD', 'D0DU', '#ROOT', '0WURE', '8473', '#0000'] },
    live: 'send(unwrap(shards))',
    prompt: 'Write unwrap(shards): drop the decoys (they start with "#"), reverse each real shard, join them in order, then shift every character DOWN by 3 (chr(ord(c) - 3)). Return the abort code.',
    starter: dd(`
      # The drive gives you shards. Halloran's rules:
      #   - decoy shards START with "#"
      #   - every real shard is written backwards
      #   - every character is shifted UP by 3
      # Return the abort code. Then the dish sends it: send(unwrap(shards))

      def unwrap(shards):
          code = ""
          return code
    `),
    check: {
      kind: 'call',
      fn: 'unwrap',
      cases: [
        { args: [['#NORTHSTAR', 'PURZ', '#K3Y', 'GRRZ', 'WODK0', '#DECOY', '4:770']], expect: 'WORMWOOD-HALT-4471' },
        { args: [['0WURED', 'DURUXD', 'ZRQ0']], expect: 'ABORT-AURORA-NOW' },
        { args: [['#AAAA', '#BBB', 'SRWV', '#C']], expect: 'STOP' },
        { args: [['#', 'J', '#40R', '40R', '55;', '#J']], expect: 'GO-1822' },
      ],
    },
    hints: [
      'Same shape as the rehearsal. First loop: skip shards that start with "#" and glue the reversed real ones.',
      'Second loop over the glued string: add chr(ord(c) - 3) for every character. Return the result, don\'t print it.',
      'joined = ""\nfor s in shards:\n    if not s.startswith("#"):\n        joined += s[::-1]\ncode = ""\nfor c in joined:\n    code += chr(ord(c) - 3)\nreturn code',
    ],
    solution: dd(`
      def unwrap(shards):
          joined = ""
          for s in shards:
              if not s.startswith("#"):
                  joined += s[::-1]
          code = ""
          for c in joined:
              code += chr(ord(c) - 3)
          return code
    `),
  },
};

/** Challenge ids in story order. */
// the field hacks the five-day story runs, in order (keypad, petition and vault stay
// in CHALLENGES for the laptop's practice list but no mission asks for them)
export const CHALLENGE_ORDER = ['faces', 'camloop', 'ledger', 'shares', 'final'];
