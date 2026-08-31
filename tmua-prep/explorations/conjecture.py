"""Worked example: how to use code as a proof-checker.

The workflow, every time:

    1. State the conjecture precisely.
    2. Test it in code over a few thousand cases.
    3. If it FAILS  -> you have a counterexample, and where it first fails
                       usually tells you why.
       If it SURVIVES -> now go prove it by hand, knowing it's true.

The code never replaces the proof. It tells you which of those two jobs
you should be doing, so you don't spend 40 minutes trying to prove
something false. That saved time is the whole point.

Run: python conjecture.py
"""


def is_prime(n):
    if n < 2:
        return False
    d = 2
    while d * d <= n:
        if n % d == 0:
            return False
        d += 1
    return True


def test(claim, check, limit=2000):
    """Check a claim for n = 0..limit. Report the first failure, if any."""
    for n in range(limit + 1):
        if not check(n):
            print(f"FALSE  {claim}")
            print(f"       first counterexample: n = {n}\n")
            return n
    print(f"holds for n = 0..{limit}  {claim}")
    print("       -> go and prove it\n")
    return None


# ---------------------------------------------------------------------
# Conjecture 1: n^2 + n + 41 is prime for every non-negative integer n.
#
# It's prime for n = 0, 1, 2, ... and stays prime for a suspiciously long
# time. Plenty of people have convinced themselves it's a theorem. Test it
# before you try to prove it.
# ---------------------------------------------------------------------

first_fail = test(
    "n^2 + n + 41 is always prime",
    lambda n: is_prime(n * n + n + 41),
)

if first_fail is not None:
    n = first_fail
    print(f"  Look at n = {n}:  {n}^2 + {n} + 41 = {n*n + n + 41}")
    print(f"  Factor it: {n*n + n + 41} = 41 x 41")
    print("  Why: n^2 + n + 41 = n(n+1) + 41, so at n = 40 that is")
    print("  40x41 + 41 = 41(40 + 1) = 41^2. Every term carries a factor")
    print("  of 41. That is the proof, and the search handed it to you.\n")

# ---------------------------------------------------------------------
# Conjecture 2: every odd number > 1 is the difference of two squares.
# ---------------------------------------------------------------------

def is_difference_of_squares(m):
    a = 1
    while a * a <= m + a * a:      # search b = a + k for small k
        for b in range(a + 1, a + 200):
            if b * b - a * a == m:
                return True
            if b * b - a * a > m:
                break
        a += 1
        if a > m:
            return False
    return False


test(
    "every odd n > 1 is a difference of two squares",
    lambda n: is_difference_of_squares(2 * n + 3),
    limit=300,
)
print("  Survived. So prove it: an odd number is 2k+1, and")
print("  (k+1)^2 - k^2 = 2k+1. One line. But you only knew it was")
print("  worth looking for a one-liner because the search said so.\n")


# ---------------------------------------------------------------------
# Your turn. Write the conjecture as a comment, then a check() for it.
#
# Good ones to start with:
#   - the sum of any three consecutive integers is divisible by 3
#   - n^3 - n is always divisible by 6
#   - 2^n > n^2 for all n
#   - every prime > 3 is of the form 6k +/- 1
#
# For each: predict true or false FIRST, then run it, then prove it.
# Being wrong about your prediction is the most useful outcome.
# ---------------------------------------------------------------------
