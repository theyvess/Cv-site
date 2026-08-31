# Paper 2: reasoning, and why it's also programming

Paper 2 is the half most people neglect, which makes it the cheapest marks
available. It's also the half that overlaps almost exactly with thinking
like a programmer — so the coding practice and the exam practice are the
same practice.

## The core vocabulary

Get these cold. Most Paper 2 errors are one of these confused for another.

| Statement | Meaning | Code analogue |
|---|---|---|
| P ⟹ Q | If P then Q | `if p: assert q` |
| Q ⟹ P | The **converse**. *Not* implied by P ⟹ Q | swapping your condition |
| ¬Q ⟹ ¬P | The **contrapositive**. Always equivalent to P ⟹ Q | early-return guard |
| ¬P ⟹ ¬Q | The **inverse**. Also not implied | negating the wrong side |
| P ⟺ Q | Both directions hold | `p == q` |

**Necessary vs sufficient.** If P ⟹ Q, then P is *sufficient* for Q, and Q
is *necessary* for P. People flip these constantly under time pressure.
Rain is sufficient for wet ground; it is not necessary.

## Negation — the highest-yield drill

Negating a quantified statement flips every quantifier and negates the core:

- ¬(∀x, P(x)) becomes ∃x such that ¬P(x)
- ¬(∃x, P(x)) becomes ∀x, ¬P(x)
- ¬(P ⟹ Q) becomes P **and** ¬Q — *not* P ⟹ ¬Q

That last one is the single most common trap on the paper. To disprove "if
P then Q" you do not prove "if P then not Q" — you find one case where P
holds and Q fails. One counterexample. That's it.

This is exactly writing a failing test case: you're not proving the function
always wrong, you're finding one input where the claim breaks.

## Proof techniques to recognise on sight

- **Direct / deduction** — chain of implications from givens to conclusion.
- **Exhaustion** — finitely many cases, check them all. (Literally a loop.)
- **Counterexample** — to *disprove* a universal claim. One is enough.
- **Contradiction** — assume the negation, derive something impossible.

The exam often asks *which technique is being used* or *where a given proof
goes wrong*. Practise reading a flawed proof and locating the bad step —
that's debugging, and it's a different skill from producing proofs yourself.

## Common flawed-proof patterns to spot

- Dividing by something that could be zero
- Squaring both sides (introduces spurious roots) without checking back
- Assuming the converse midway through
- "Proof" by example of a universal claim
- Losing a ± when taking a root
- Assuming the thing being proved (circularity)

## The code-as-checker workflow

For any conjecture you're unsure of, before you try to prove it:

1. Write ten lines of Python that test it over a few thousand cases.
2. If it fails — you have your counterexample, and the search taught you
   *where* it fails, which usually tells you why.
3. If it survives — now go prove it by hand, with confidence it's true.

The code never replaces the proof. It tells you which of the two things you
should be spending your time on. See `explorations/` for a worked example.

## Drills to run with the tutor

Ask for these by name; the tutor rules keep them Socratic:

- "Give me 10 statements to negate."
- "Give me 5 implications; ask me for converse and contrapositive of each."
- "Show me a flawed proof and ask me to find the bad line."
- "Give me 5 necessary/sufficient questions."
- "Give me a universal claim that's false and make me find the counterexample."
