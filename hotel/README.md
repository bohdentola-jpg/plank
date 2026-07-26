# NO VACANCY 🛎

*Run the desk. Make the beds. Build the empire.*

You bought a three-room roadside motel and there is nobody else on shift. A hotel
management game you look into like a dollhouse — the front of every room is cut
away, so you watch the beds get stripped, the TVs flicker on, and guests flop onto
the mattress at 1am.

![The motel at dusk](../docs/hotel-title.png)

**Everything is your job.** The board down the left is every task waiting on you:
somebody at the desk about to give up and drive on, a room that needs turning over
before you can sell it again, the AC in 103, a guest on the phone asking for towels.
Click a job — or press its number — and you walk over and do it. Run out of clean
linen and your next cleaning job detours to the laundry room first.

**You decide who goes where.** Every arrival is provisionally given the cheapest room
that meets what they came for; click the room tag on their line to put them somewhere
else. Guests pay for the tier they *booked*, not the room they end up in, so a free
upgrade into a suite buys real goodwill and costs you the suite. Put a couple who came
for a suite into a standard and they will remember it in the guest book.

**Money buys rooms, rooms buy staff.** Open the boarded-up units one at a time, then
stack floors on top, up to thirty rooms across five storeys. Upgrade a standard into
a deluxe or a suite. Eighteen amenities, from a vending alcove to a lobby bar to a
spa, and each one shows up in the building: the pool fills in, the elevator car
actually rides the shaft, the chandelier lights the lobby at night.

| | |
| --- | --- |
| ![Working the board](../docs/hotel-play.png) | ![A hotel with a crew](../docs/hotel-build.png) |
| ![The lobby at check-in](../docs/hotel-lobby.png) | ![Choosing somebody's room](../docs/hotel-assign.png) |

**Then hire your way out of the job.** A front desk clerk, a housekeeper, a
maintenance tech and a bellhop cover the four core roles between them — at which
point the badge in the corner flips to **AUTOPILOT** and the hotel runs without you.

**And then leave.** The simulation is driven off the wall clock, not the render loop,
so a background tab keeps trading at full fidelity while you watch something else.
Close it entirely and the crew keeps the doors open: two hours' worth on a bare
crew, six with a **Night Auditor**, sixteen with a **General Manager** — and an hour
of wall clock is seventeen in-game days, so that is a long night's trading. You come
back to a *while you were out* report: nights sold, wages paid, what your standing
did, and who turned around in the lot because nobody was on the desk.

![Half past two, everyone asleep](../docs/hotel-night.png)

## How to play

| | |
| --- | --- |
| **click a job** / **1–9** | take it off the board — you walk over and do it |
| **space** | take the most urgent job |
| **A** | put yourself on auto and pick up jobs like staff do |
| **drag** / **wheel** | orbit and zoom the hotel |
| **click a room** | inspect it, upgrade it, or grab its job |
| **click the 🛏 tag** | on a check-in line, to put that guest in a different room |
| **click the linen room** | to go and top up your cart before you run dry |
| **1× 2× 4×** | speed · **P** pause · **M** mute · **Esc** menu |

Stars are the shop window — they decide how many cars pull off the road and how much
you can charge. You can't review your way to five of them out of a six-room motel:
the ceiling is set by the property itself, and good service only walks you up to it.
Everything auto-saves; **CONTINUE** picks up where you left off.

## QA

```bash
node tools/hotel-smoke.mjs               # the sim, the ledger, the guests — no browser
node tools/hotel-smoke.mjs --days 60     # sixty days of trading, economy printed per day
node tools/hotel-leakcheck.mjs           # object churn over a long session
node tools/hotel-uicheck.mjs             # the board and the panels in a real browser
```
