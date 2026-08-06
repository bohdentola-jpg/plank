# boxscript

boxscript is the language inside **game**. Every object can carry one, and so
can every model you make. It reads like English, but it's a real language:
variables, lists, your own functions, recursion, loops, and a 3D world to
command.

```
to tower with n
  repeat with i from 1 to n
    spawn box at my x, i * 1.5, my z
  end
end

when clicked
  tower with 8
  say "there you go"
end
```

## how a script is shaped

- A script is a list of **`when` blocks** (things that happen) and **`to`
  functions** (things you can call). Both close with `end`.
- One command per line. `#` or `//` starts a comment.
- `if`, `repeat`, `while`, `forever` and `for each` close with `end` too.
- Capitals don't matter.

## where things are

The world is 3D: **x** runs east, **z** runs south, **y** is up. An object's
position is the middle of its base, so `goto 20, 0, 40` stands it on the ground.

Terrain is hilly, so ask it how high the ground is:

```
set gy to height at 40, 40
goto 40, gy, 40
```

Two numbers instead of three means "ground coordinates" and keeps the current
height: `goto 20, 40` is x 20, z 40. Same for `spawn` and `teleport player`.

`write` and `button` use **percent of the screen** instead — `at 50, 10` is top
middle, `at 50, 90` is bottom middle.

## events

| block | fires when |
| --- | --- |
| `when start` | the map loads |
| `when tick` | every frame |
| `when touched` | the player walks into me |
| `when clicked` | the player clicks me |
| `when hit` | a blaster bolt hits me |
| `when key e` | that key goes down (`space up down left right shift`, `a`–`z`, `0`–`9`) |
| `when message go` | someone ran `broadcast go` |
| `when button "play"` | that screen button is clicked |
| `when player near 10` | each time they come within 10 |
| `every 2 seconds` | on a timer, forever |

`t`, `enter`, `tab` and `escape` belong to the game (chat and menus), so scripts
can't listen for them — the editor will tell you.

## your own functions

```
to greet with who
  say "hi " + who
end

greet with "world"
```

Parameters come after `with`; `return` hands a value back. Call one as a command
or use it as a value, either style:

```
to add2 with a, b
  return a + b
end

say add2 with 3, 4
say add2(3, 4)
```

They can call each other and themselves. Parameters are private to each call, so
recursion is safe:

```
to fib with n
  if n < 2 then
    return n
  end
  return fib(n - 1) + fib(n - 2)
end
```

Calls can appear before the definition. If a function calls itself forever the
game stops it with a friendly error instead of freezing.

## variables

```
set score to 0
change score by 1
local tmp to 5            # private to this function call
set shared score to 0     # every object in the map can see it
change shared score by 1
say shared score
```

Plain `set` writes the object's own variable, shared by every block in that
object. Unset variables read as `0`.

## lists

```
set l to list 1, 2, 3         # or: set l to [1, 2, 3]
set empty to list
add 4 to l
insert 0 at 1 in l
remove item 2 of l
remove all of l
say item 2 of l
say length of l
set item 1 of l to 99
if l contains 3 then … end
say index of 3 in l
say join l with ", "
for each x in l
  say x
end
```

Lists hold anything, including other lists — that's a grid:

```
set grid to list
repeat with row from 1 to 8
  set line to list
  repeat with col from 1 to 8
    add 0 to line
  end
  add line to grid
end
set item 3 of item 5 of grid to "x"
```

## moving and turning

```
move forward 5        # forward back left right up down (my own facing)
move north 5          # north south east west up down (the world's)
turn right 90
turn to 180
face player
face 10, 20
goto 10, 0, 20
set my y to 4
change my x by 2
grow 25               # size is a percent
spin 90               # degrees per second, forever
push up 300           # a physics shove
```

## doing things

```
say "hi" for 2 seconds
color red             # gray darkgray lightgray silver white black cardboard
                      # tape red blue green yellow orange purple pink brown
                      # sand grass leaf stone lava ash snow ice water
show    hide
solid on   solid off      # whether players bump into me
physical on               # falls, and can be picked up and thrown
glow on                   # ignore the light, glow flat
light on                  # cast light around me
spawn box at 10, 0, 20    # any built-in or model you made
vanish
sound pop                 # pop bigpop blast beep boop ding crunch tock pip
                          # thud pickup jump land step score whoosh hurt
wait 0.5
broadcast go               # wakes `when message go` on my objects
broadcast go to everyone    # …and on every other player's copy of the map
teleport player to 0, 0
freeze player    unfreeze player
shake 0.5
write "score: 0" at 50, 8 size 5 as hud
unwrite hud                 # or: unwrite all
button "play" at 50, 60
remove button "play"
```

## control

```
if a > b then … else if c then … else … end
repeat 10 times … end
repeat with i from 1 to 10 … end
repeat with i from 10 to 1 … end
repeat with i from 0 to 100 by 5 … end
for each thing in things … end
while a < b … end
forever … end               # one pass per frame
break        continue       # or: stop repeating
stop                        # end this block now
```

## values you can read

```
my x   my y   my z   my yaw   my size   my name
player x   player y   player z   player name
mouse x   mouse y          # where you're looking, on the ground
distance to player
distance to tree           # the nearest one
touching player            # touching box, touching anything by name
key space down
random 1 to 10             # whole numbers when both ends are whole
count of box
height at 10, 20           # the ground level anywhere
biome                      # void meadow forest desert snow volcano ash outer
shared score
time                       # seconds since the map started
yes   no   nothing
```

Maths: `+ - * / %`, comparisons `= != < > <= >=` (`is` and `is not` work too),
logic `and or not`, brackets, and `round abs floor ceil sqrt sin cos tan`
(degrees) plus `min of a, b` / `max of a, b`.

Text: `length of s`, `letter 1 of s`, `uppercase of s`, `lowercase of s`,
`text of 5`, `number of "5"`, `s contains "ab"`, and `+` glues things together.

## multiplayer

Each player runs their **own copy** of the map's scripts, so puzzles and
counters are personal. Players, chat, loose boxes, blasters and pong are shared
by the host. When something should happen for *everyone*, send it over the wire:

```
broadcast doorsopen to everyone
```

```
when message doorsopen
  solid off
  hide
end
```

## things to build

**a door**

```
when message open
  solid off
  hide
end
```

**lava that sends you home**

```
when touched
  sound crunch
  shake 0.4
  teleport player to 0, 0
end
```

**something that hunts you**

```
when tick
  if distance to player < 40 then
    face player
    move forward 0.08
  end
end
when player near 3
  sound bigpop
  say "got you"
  teleport player to 0, 0
end
```

**a clicker with a screen counter**

```
when start
  set shared clicks to 0
  write "clicks: 0" at 50, 8 size 5 as hud
end
when clicked
  sound pop
  change shared clicks by 1
  write "clicks: " + shared clicks at 50, 8 size 5 as hud
end
```

**a block-blast board.** Model a `tile`, give the *model* the first script so
every copy has it, then put the second on a hidden controller object:

```
# on the tile model
when clicked
  sound pop
  change shared score by 1
  write "score: " + shared score at 50, 6 size 5 as hud
  vanish
end
```

```
# on the controller
to board with cols, rows
  repeat with r from 1 to rows
    repeat with c from 1 to cols
      spawn tile at c * 2 - cols, 1, r * 2 - rows
    end
  end
end

when start
  hide
  set shared score to 0
  button "new board" at 50, 90
end

when button "new board"
  board with 8, 5
end
```

**a backrooms maze.** Make the map with the landscape switched off (the
white-void kind), model a wall panel, and lay it out with a function:

```
to corridor with n, dx, dz
  repeat with i from 1 to n
    spawn panel at my x + i * dx, 0, my z + i * dz
  end
end

when start
  corridor with 20, 4, 0
  corridor with 20, 0, 4
end
```

If you can say it, you can probably script it.
