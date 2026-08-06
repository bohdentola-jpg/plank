# boxscript

boxscript is the little language inside **game**. Every object in a map can
carry a script; every model you paint can carry one too. The goal: read it out
loud and it does what it says.

```
when touched
  say "ouch!"
  wait 1
  vanish
end
```

## how a script is shaped

- A script is a list of **event blocks**. Each starts with `when …` (or
  `every … seconds`) and closes with `end`.
- Inside a block, one command per line.
- `#` starts a comment.
- `if`, `repeat`, `while` and `forever` also close with `end`.
- Capitals don't matter. `SAY "HI"` works.

## positions

- `x` grows to the **right**, `y` grows **up**. `y 0` is the ground line.
- An object's `x, y` is the middle of its **feet** — `goto 100, 0` stands it
  on the ground, 100 to the right of the start point.
- Screen text and buttons use **percent of the screen** instead:
  `write "hi" at 50, 10` is top-middle, `at 50, 90` is bottom-middle.

## events

| block | fires when |
| --- | --- |
| `when start` | the map loads |
| `when tick` | every frame (~60×/second) |
| `when touched` | the player walks into me |
| `when clicked` | the player clicks me |
| `when hit` | a blaster bolt hits me |
| `when key e` | that key goes down (`space up down left right enter a`–`z` `0`–`9`) |
| `when message go` | someone ran `broadcast go` |
| `when button "play"` | the screen button with that label is clicked |
| `every 2 seconds` | on a timer, forever |

A script can have many blocks, even several of the same kind.

## commands

**moving me**

```
move up 10            # also down / left / right
goto 100, 0           # jump straight there
set x to 50           # or set y / change x by 5
push up 200           # physics shove (makes me physical)
grow 25               # size is percent; set size to 200 doubles me
```

**being seen and heard**

```
say "hello" for 2 seconds     # speech bubble over me
color red                     # gray darkgray lightgray silver white black
                              # cardboard red blue green yellow purple
                              # orange pink brown
show      hide
solid on  solid off           # whether players bump into me
sound pop                     # pop bigpop blast beep boop ding crunch
                              # tock score pip thud pickup
```

**making and unmaking**

```
spawn box at 100, 0          # any built-in or painted model
vanish                       # remove me (stops my script)
```

**the player**

```
teleport player to 0, 40
freeze player                # and unfreeze player
shake 0.5                    # camera shake
```

**screen UI** (percent coordinates)

```
write "score: 0" at 50, 8 size 4 as hud    # 'as hud' names it for updates
unwrite hud                                 # or: unwrite all
button "start" at 50, 60
remove button "start"
```

**variables**

```
set lives to 3
change lives by -1
set shared score to 0        # shared = every object in the map sees it
change shared score by 1
```

Plain variables belong to one object. `shared` ones are map-wide.
Unset variables read as `0`.

**flow**

```
wait 0.5
if lives = 0
  say "game over"
else
  say lives + " left"
end
repeat 10 … end
while lives > 0 … end
forever … end                # runs once per frame, forever
stop                         # end this block right here
broadcast levelup            # wake up `when message levelup` on every object
broadcast go to everyone     # …on every PLAYER'S copy of the map, over the net
```

## values you can read

```
my x     my y     my size    my name
player x           player y            player name
mouse x            mouse y
distance to player
touching player    touching box       # any model name works
key space down
random 1 to 10                        # whole numbers if both ends are whole
count of box                          # how many boxes exist right now
shared score
time                                  # seconds since the map started
yes  no                               # booleans
```

Math: `+ - * / %`, comparisons `= != < > <= >=`, logic `and or not`,
grouping with `( )`, helpers `round abs floor`. `+` glues strings:
`say "hp: " + hp`.

## multiplayer semantics (worth knowing)

Each player runs their **own copy** of a map's scripts — like everyone gets a
private copy of the puzzle. Players, chat, blasters and plain boxes are shared;
scripted objects are per-player. To make a moment happen for *everyone*, use
`broadcast go to everyone` and catch it with `when message go`.

## recipes

**a door that opens**

```
when message open
  solid off
  hide
end
```

**lava**

```
when touched
  sound crunch
  say "ow ow ow"
  teleport player to 0, 0
end
```

**a lurker for a backrooms map**

```
every 3 seconds
  if distance to player < 120
    move left 10
  end
  if distance to player < 30
    shake 1
    sound bigpop
    teleport player to 0, 0
    broadcast caught
  end
end
```

**a clicker game on a sign**

```
when start
  write "clicks: 0" at 50, 10 size 4 as hud
end
when clicked
  sound pop
  change shared clicks by 1
  write "clicks: " + shared clicks at 50, 10 size 4 as hud
end
```

**block blast, the small version** — paint a `tile` model, give the *model*
this script, then `spawn` a grid of them from a controller object:

```
# on the tile model
when clicked
  sound pop
  change shared score by 1
  write "score: " + shared score at 50, 6 size 4 as hud
  vanish
end
```

```
# on a hidden controller object
when start
  hide
  set shared score to 0
  button "new board" at 50, 90
end
when button "new board"
  set row to 0
  repeat 5
    set col to 0
    repeat 8
      spawn tile at (col * 20) - 80, (row * 20) + 20
      change col by 1
    end
    change row by 1
  end
end
```

That's the whole language. If you can say it, you can probably script it.
