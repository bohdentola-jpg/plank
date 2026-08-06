// docs.js — the in-game language reference (the sidebar in the script editor
// and the full help panel). Kept here so index.html stays tiny.

export const CHEATSHEET_HTML = `
<b>events</b>
<pre>when start
when tick
when touched
when clicked
when hit
when key e
when message go
when button "play"
when player near 10
every 2 seconds</pre>
<b>your own functions</b>
<pre>to greet with who
  say "hi " + who
end
greet with "world"

to add2 with a, b
  return a + b
end
say add2(3, 4)</pre>
<b>variables &amp; lists</b>
<pre>set score to 0
change score by 1
local tmp to 5
set shared score to 0

set l to list 1, 2, 3
add 4 to l
say item 2 of l
say length of l
set item 1 of l to 9
remove item 2 of l
if l contains 3 then … end
say index of 3 in l
for each x in l
  say x
end</pre>
<b>moving (3d)</b>
<pre>move forward 5
move up 2   move north 5
turn right 90
turn to 180
face player
goto 10, 0, 20
set my y to 4
grow 25   spin 90</pre>
<b>doing things</b>
<pre>say "hi" for 2 seconds
color red
show   hide
solid off   physical on
glow on   light on
spawn box at 10, 0, 20
vanish
push up 300
sound pop
wait 0.5
broadcast go
broadcast go to everyone
teleport player to 0, 0
freeze player   shake 0.5
write "score" at 50, 10 size 4 as hud
button "play" at 50, 60</pre>
<b>control</b>
<pre>if a > b then … else … end
repeat 10 times … end
repeat with i from 1 to 10 … end
while a < b … end
forever … end
break   continue   stop</pre>
<b>values</b>
<pre>my x, my y, my z, my yaw, my size
player x, player y, player z
mouse x, mouse y
distance to player
distance to tree
touching player
key space down
random 1 to 10
count of box
height at 10, 20
biome
shared score
time · yes · no
round abs floor ceil sqrt
sin cos min of a, b
length of "hi"  letter 1 of "hi"
uppercase of  text of  number of
join l with ", "</pre>`;

export const HELP_HTML = `
<p><b>boxscript</b> is the language inside game. every object can carry one, and
so can every model you make. a script is a list of <b>when</b> blocks and your own
<b>to</b> functions. blocks close with <b>end</b>. <b>#</b> starts a comment.</p>
<pre>when touched
  say "ouch!"
  wait 1
  vanish
end</pre>

<h4>where things are</h4>
<p>the world is 3D: <b>x</b> runs east, <b>z</b> runs south, <b>y</b> is up. an object's
position is the middle of its base, so <code>goto 20, 0, 40</code> stands it on the
ground. terrain is hilly — use <code>height at x, z</code> to find the ground:</p>
<pre>set gy to height at 40, 40
goto 40, gy, 40</pre>
<p>two numbers instead of three means "ground coordinates":
<code>goto 20, 40</code> is x 20, z 40, keeping the current height. same for
<code>spawn</code> and <code>teleport player</code>.</p>
<p><code>write</code> and <code>button</code> use percent of the screen instead —
<code>at 50, 10</code> is top middle.</p>

<h4>events</h4>
<p><code>when start</code> · <code>when tick</code> (every frame) ·
<code>when touched</code> (the player walks into me) · <code>when clicked</code> ·
<code>when hit</code> (a blaster bolt) · <code>when key e</code> ·
<code>when message NAME</code> · <code>when button "label"</code> ·
<code>when player near 10</code> (fires each time they come inside that distance) ·
<code>every 2 seconds</code>.</p>

<h4>functions</h4>
<p>write your own with <code>to</code>. parameters are listed after <code>with</code>,
and <code>return</code> hands a value back. they can call each other, and
themselves:</p>
<pre>to tower with n
  repeat with i from 1 to n
    spawn box at my x, i * 1.4, my z
  end
end

to fib with n
  if n < 2 then
    return n
  end
  return fib(n - 1) + fib(n - 2)
end</pre>
<p>parameters are private to each call, so recursion is safe. <code>local x to 1</code>
makes another private variable; plain <code>set</code> writes the object's own
variable, which every block in that object shares.</p>

<h4>lists</h4>
<p>lists hold anything, including other lists — that's how you make a grid:</p>
<pre>set grid to list
repeat with row from 1 to 8
  set line to list
  repeat with col from 1 to 8
    add 0 to line
  end
  add line to grid
end
set item 3 of item 5 of grid to "x"</pre>

<h4>sharing between objects and players</h4>
<p><code>shared</code> variables are visible to every object in the map:
<code>set shared score to 0</code>, read with <code>shared score</code>.</p>
<p>each player runs their own copy of the map's scripts, so puzzles are personal.
when something should happen for <i>everyone</i>, send it over the wire:</p>
<pre>broadcast doorsopen to everyone</pre>
<pre>when message doorsopen
  solid off
  hide
end</pre>

<h4>the world</h4>
<p><code>biome</code> tells you what you're standing in — <code>void</code>,
<code>meadow</code>, <code>forest</code>, <code>desert</code>, <code>snow</code>,
<code>volcano</code>, <code>ash</code>, <code>outer</code>. <code>height at x, z</code>
is the ground level anywhere. between those two you can grow things that fit
wherever they land.</p>

<h4>a few whole things to build</h4>
<pre># a door that opens for everyone
when message open
  solid off
  hide
end</pre>
<pre># lava that puts you back
when touched
  sound crunch
  shake 0.4
  teleport player to 0, 0
end</pre>
<pre># something that follows you
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
end</pre>
<pre># a clicker, with a screen counter
when start
  set shared clicks to 0
  write "clicks: 0" at 50, 8 size 5 as hud
end
when clicked
  sound pop
  change shared clicks by 1
  write "clicks: " + shared clicks at 50, 8 size 5 as hud
end</pre>
<pre># a block-blast board, built by a function
to board with cols, rows
  repeat with r from 1 to rows
    repeat with c from 1 to cols
      spawn tile at c * 2 - cols, 1, r * 2 - rows
    end
  end
end
when start
  button "new board" at 50, 90
end
when button "new board"
  board with 8, 5
end</pre>
<p>make a backrooms maze out of walls with the landscape switched off. make a
volcano obstacle course. make a shop, a race, a game of tag. if you can say it,
you can probably script it.</p>`;
