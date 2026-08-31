"""A Leitner-box flashcard drill for the facts you keep forgetting.

No dependencies — python 3 and nothing else. Run it:

    python drill.py review     # do today's cards
    python drill.py add        # add a card
    python drill.py stats      # see where you stand

Cards live in cards.json next to this file. A card you get right moves up a
box and comes back later; a card you get wrong drops to box 1 and comes back
tomorrow. Boxes are spaced 1, 2, 4, 8, 16 days.

This is deliberately small enough to read in one sitting. Read it, then
change it — that's the actual exercise. Ideas at the bottom.
"""

import json
import random
import sys
from datetime import date, timedelta
from pathlib import Path

CARDS_FILE = Path(__file__).parent / "cards.json"
INTERVALS = {1: 1, 2: 2, 3: 4, 4: 8, 5: 16}
TOP_BOX = 5


def load():
    if not CARDS_FILE.exists():
        return []
    return json.loads(CARDS_FILE.read_text())


def save(cards):
    CARDS_FILE.write_text(json.dumps(cards, indent=2))


def due(cards):
    today = date.today().isoformat()
    return [c for c in cards if c["due"] <= today]


def schedule(card, correct):
    """Move the card up or down a box and set its next due date."""
    if correct:
        card["box"] = min(card["box"] + 1, TOP_BOX)
    else:
        card["box"] = 1
    card["due"] = (date.today() + timedelta(days=INTERVALS[card["box"]])).isoformat()


def review():
    cards = load()
    todays = due(cards)
    if not todays:
        print("Nothing due today. Add some cards, or go do a past paper.")
        return

    random.shuffle(todays)
    right = 0
    print(f"{len(todays)} cards due.\n")

    for i, card in enumerate(todays, 1):
        print(f"[{i}/{len(todays)}] {card['front']}")
        input("  ...press enter for the answer ")
        print(f"  -> {card['back']}\n")
        got_it = input("  Did you get it? [y/n] ").strip().lower().startswith("y")
        schedule(card, got_it)
        right += got_it
        print()

    save(cards)
    print(f"Done. {right}/{len(todays)} correct.")


def add():
    cards = load()
    print("Blank front to stop.\n")
    while True:
        front = input("Front: ").strip()
        if not front:
            break
        back = input("Back:  ").strip()
        cards.append({
            "front": front,
            "back": back,
            "box": 1,
            "due": date.today().isoformat(),
        })
        print("  added\n")
    save(cards)


def stats():
    cards = load()
    if not cards:
        print("No cards yet. Run: python drill.py add")
        return
    print(f"{len(cards)} cards, {len(due(cards))} due today\n")
    for box in range(1, TOP_BOX + 1):
        n = sum(1 for c in cards if c["box"] == box)
        print(f"  box {box} (every {INTERVALS[box]:>2}d)  {'#' * n} {n}")
    print("\nCards stuck in box 1 are the ones to worry about.")


COMMANDS = {"review": review, "add": add, "stats": stats}

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "review"
    if cmd not in COMMANDS:
        print(f"Usage: python drill.py [{' | '.join(COMMANDS)}]")
        sys.exit(1)
    COMMANDS[cmd]()


# Things to build next, roughly in order of difficulty:
#
#  1. Tag cards by topic, and add `python drill.py review --topic trig`.
#  2. Track how many times each card has been wrong, and show the worst 10.
#  3. Cap a session at 20 cards so a big backlog isn't demoralising.
#  4. Add a `--timed` mode that gives you 15 seconds per card.
#  5. Store the history of every review and plot your accuracy over time.
