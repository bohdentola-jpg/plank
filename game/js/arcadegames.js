// arcadegames.js — the games inside the arcade cabinets, written in boxscript.
//
// These are real scripts, not engine code: place a cabinet in the editor and
// this is exactly what lands in its script box, ready to be bent into your own
// game. The screen is 100 wide and 75 tall, origin at the top left.

export const DOOR_SCRIPT = `# a door that opens when you click it
when start
  set open to no
end

when clicked
  if open then
    sound thud
    turn left 100
    solid on
    set open to no
  else
    sound tock
    turn right 100
    solid off
    set open to yes
  end
end
`;

// ---------------------------------------------------------------- SNAKE
export const SNAKE_GAME = `# SNAKE — arrows steer, space restarts
# the screen is 100 x 75, this game plays on a 20 x 15 grid of 5s

when start
  print title "SNAKE" at 34, 26 size 6 color "green"
  print hint "arrows to steer" at 28, 44 size 3 color "gray"
end

to reset
  clear screen "black"
  set bodyx to list 10, 9, 8
  set bodyy to list 7, 7, 7
  set dx to 1
  set dy to 0
  set nextdx to 1
  set nextdy to 0
  set alive to yes
  set points to 0
  dropfood
  redraw
  print score "0" at 2, 2 size 3 color "gray"
end

to dropfood
  set foodx to random 0 to 19
  set foody to random 2 to 14
  stamp food at foodx * 5 + 1, foody * 5 + 1 size 3, 3 color "red"
end

to redraw
  repeat with i from 1 to length of bodyx
    set shade to "green"
    if i = 1 then
      set shade to "white"
    end
    stamp "s" + i at (item i of bodyx) * 5, (item i of bodyy) * 5 size 4.4, 4.4 color shade
  end
end

when screen start
  reset
end

every 0.13 seconds
  if screen on and alive then
    set dx to nextdx
    set dy to nextdy
    set nx to (item 1 of bodyx) + dx
    set ny to (item 1 of bodyy) + dy
    # walls wrap around
    if nx < 0 then
      set nx to 19
    end
    if nx > 19 then
      set nx to 0
    end
    if ny < 2 then
      set ny to 14
    end
    if ny > 14 then
      set ny to 2
    end
    # bit yourself?
    repeat with i from 1 to length of bodyx
      if (item i of bodyx) = nx and (item i of bodyy) = ny then
        set alive to no
      end
    end
    if alive then
      insert nx at 1 in bodyx
      insert ny at 1 in bodyy
      if nx = foodx and ny = foody then
        sound pop
        change points by 1
        print score points at 2, 2 size 3 color "gray"
        dropfood
      else
        unstamp "s" + (length of bodyx)
        remove item (length of bodyx) of bodyx
        remove item (length of bodyy) of bodyy
      end
      redraw
    else
      sound crunch
      print over "game over" at 28, 30 size 5 color "red"
      print again "space to retry" at 26, 44 size 3 color "gray"
    end
  end
end

when key up
  if screen on and dy = 0 then
    set nextdx to 0
    set nextdy to -1
  end
end
when key down
  if screen on and dy = 0 then
    set nextdx to 0
    set nextdy to 1
  end
end
when key left
  if screen on and dx = 0 then
    set nextdx to -1
    set nextdy to 0
  end
end
when key right
  if screen on and dx = 0 then
    set nextdx to 1
    set nextdy to 0
  end
end
when key space
  if screen on and not alive then
    reset
  end
end
`;

// ---------------------------------------------------------------- PONG
export const PONG_GAME = `# PONG — up and down move your paddle, first to 5
when start
  print title "PONG" at 36, 26 size 6 color "white"
  print hint "up / down to move" at 25, 44 size 3 color "gray"
end

to serve
  set ballx to 50
  set bally to 37
  set bvx to 0 - bvx
  if bvx = 0 then
    set bvx to 0.9
  end
  set bvy to random -0.5 to 0.5
end

to reset
  clear screen "black"
  stamp net at 49.6, 4 size 0.8, 71 color "darkgray"
  set py to 30
  set ay to 30
  set myscore to 0
  set theirs to 0
  set bvx to 0
  serve
  print s1 "0" at 30, 3 size 4 color "gray"
  print s2 "0" at 66, 3 size 4 color "gray"
end

when screen start
  reset
end

when screen tick
  if key up down then
    change py by -1.4
  end
  if key down down then
    change py by 1.4
  end
  if py < 4 then
    set py to 4
  end
  if py > 57 then
    set py to 57
  end

  # the other paddle is a simple machine: it chases, capped
  if ay + 7 < bally then
    change ay by 0.85
  end
  if ay + 7 > bally then
    change ay by -0.85
  end

  change ballx by bvx
  change bally by bvy
  if bally < 4 or bally > 71 then
    set bvy to 0 - bvy
    sound tock
  end
  # your paddle (left)
  if ballx < 6 and ballx > 3 and bally > py - 2 and bally < py + 16 then
    set bvx to abs bvx + 0.04
    set bvy to (bally - py - 7) * 0.12
    sound tock
  end
  # their paddle (right)
  if ballx > 94 and ballx < 97 and bally > ay - 2 and bally < ay + 16 then
    set bvx to 0 - (abs bvx + 0.04)
    sound tock
  end
  # points
  if ballx < -3 then
    change theirs by 1
    print s2 theirs at 66, 3 size 4 color "gray"
    sound boop
    serve
  end
  if ballx > 103 then
    change myscore by 1
    print s1 myscore at 30, 3 size 4 color "gray"
    sound score
    serve
  end
  if myscore >= 5 or theirs >= 5 then
    if myscore >= 5 then
      print over "you win" at 32, 32 size 5 color "green"
    else
      print over "machine wins" at 22, 32 size 5 color "red"
    end
    set bvx to 0
    set bvy to 0
    set myscore to 0
    set theirs to 0
    wait 2.5
    reset
  end

  stamp me at 4, py size 2, 14 color "white"
  stamp them at 94, ay size 2, 14 color "silver"
  stamp ball at ballx, bally size 2.4, 2.4 color "yellow"
end
`;

// ---------------------------------------------------------------- BRICKS
export const BRICKS_GAME = `# BRICKS — left and right move the paddle, space serves
when start
  print title "BRICKS" at 30, 26 size 6 color "orange"
  print hint "break every brick" at 26, 44 size 3 color "gray"
end

to reset
  clear screen "black"
  set colors to list "red", "orange", "yellow", "green"
  set bricks to list
  repeat with r from 1 to 4
    repeat with c from 1 to 8
      add 1 to bricks
      stamp "b" + r + "_" + c at (c - 1) * 12.5 + 1, r * 5 + 2 size 10.5, 3.6 color item r of colors
    end
  end
  set px to 44
  set stuck to yes
  set lives to 3
  set points to 0
  print score "0" at 2, 2 size 3 color "gray"
  print hearts lives at 94, 2 size 3 color "red"
end

to launch
  set stuck to no
  set bvx to random -0.6 to 0.6
  set bvy to -1.1
end

when screen start
  reset
end

when key space
  if screen on and stuck then
    sound pip
    launch
  end
end

when screen tick
  if key left down then
    change px by -1.8
  end
  if key right down then
    change px by 1.8
  end
  if px < 0 then
    set px to 0
  end
  if px > 88 then
    set px to 88
  end

  if stuck then
    set ballx to px + 5
    set bally to 66
  else
    change ballx by bvx
    change bally by bvy
    if ballx < 1 or ballx > 98 then
      set bvx to 0 - bvx
      sound tock
    end
    if bally < 2 then
      set bvy to abs bvy
      sound tock
    end
    # the paddle
    if bally > 67 and bally < 70 and ballx > px - 2 and ballx < px + 12 then
      set bvy to 0 - abs bvy
      set bvx to (ballx - px - 5) * 0.22
      sound tock
    end
    # brick land: rows sit between y 7 and 27
    if bally > 6 and bally < 26 then
      set r to floor ((bally - 2) / 5)
      set c to floor (ballx / 12.5) + 1
      if r >= 1 and r <= 4 and c >= 1 and c <= 8 then
        set slot to (r - 1) * 8 + c
        if item slot of bricks = 1 then
          set item slot of bricks to 0
          unstamp "b" + r + "_" + c
          set bvy to 0 - bvy
          sound pop
          change points by 1
          print score points at 2, 2 size 3 color "gray"
          if points = 32 then
            print over "cleared!" at 30, 36 size 5 color "green"
            sound score
            wait 2.5
            reset
          end
        end
      end
    end
    # dropped it
    if bally > 74 then
      sound crunch
      change lives by -1
      print hearts lives at 94, 2 size 3 color "red"
      set stuck to yes
      if lives <= 0 then
        print over "game over" at 28, 36 size 5 color "red"
        wait 2.5
        reset
      end
    end
  end

  stamp paddle at px, 68 size 12, 2 color "white"
  stamp ball at ballx, bally size 2.2, 2.2 color "yellow"
end
`;

export const ARCADE_GAMES = {
  snake: SNAKE_GAME,
  pong: PONG_GAME,
  bricks: BRICKS_GAME,
};
