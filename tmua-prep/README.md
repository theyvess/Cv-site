# TMUA prep

A working folder for the Test of Mathematics for University Admission, set
up so that Claude Code acts as a tutor rather than an answer machine.

## Do this first

**Check the registration deadline and test date on the official TMUA site,
and confirm with your school's exams officer.** In recent cycles
registration has closed in late September for a mid-October test. Nothing
else in this folder matters if that deadline passes. Also check on each
university's own course page that TMUA is required for the courses you're
applying to — requirements change year to year.

## What's here

```
CLAUDE.md                  the tutor rules — read this, it's the whole trick
plan/six-week-plan.md      week-by-week schedule and daily rhythm
plan/paper2-reasoning.md   logic and proof, the underrated half of the test
log/errors.md              every wrong answer goes here, same day
drill/drill.py             spaced-repetition flashcards (python, no deps)
explorations/conjecture.py worked example: using code to check a conjecture
```

## Getting started

```bash
cd tmua-prep
claude                      # CLAUDE.md loads automatically

python3 drill/drill.py review    # today's cards
python3 drill/drill.py add       # add your own
python3 drill/drill.py stats     # see what's sticking

python3 explorations/conjecture.py
```

## How to actually use the tutor

`CLAUDE.md` tells Claude to refuse answers, ask questions first, and give
hints one level at a time. It will hold that line — but it only helps if
the order of operations is right:

**Attempt the problem alone, on paper, timed. Then bring Claude in.**

Claude is for reviewing your method after the fact, closing gaps it
exposes, and drilling the reasoning patterns. Not for getting unstuck in
the moment. The struggle before the hint is the part that trains anything.

Things worth asking for:

- "Give me 10 statements to negate."
- "Show me a flawed proof and make me find the bad line."
- "I got Q14 wrong — don't tell me the answer, tell me which step to recheck."
- "I solved this in 6 minutes. What's the 2-minute route?"
- "Quiz me on necessary vs sufficient until I stop getting them backwards."

## Learning to code alongside

`drill/drill.py` is deliberately short enough to read in one sitting, and
the comments at the bottom list five extensions in increasing difficulty.
Build those. A tool you use every day beats a tutorial project you abandon.

`explorations/conjecture.py` shows the workflow that makes coding genuinely
useful for the maths: conjecture, brute-force test, then prove by hand. The
code doesn't replace the proof — it tells you whether a proof is worth
looking for.
