#!/usr/bin/env python3
"""Recompute reported statistics and check their internal consistency.

Input is a claims file: the printed statistics (value, df, reported P) and the
summary statistics (means, percentages with N) extracted from analysis
outputs or a manuscript table. The script recomputes two-sided P values from
t, F, chi2 and z statistics, compares each reported P against the rounding
envelope of the recomputation, and runs GRIM checks on means and percentages.
It never opens data files: the arithmetic runs on the printed numbers only.

Subcommand:
  check CLAIMS [--alpha A] [--out REPORT]

Exit codes: 0 no FAIL, 1 input error, 2 at least one FAIL.
"""

import argparse
import json
import math
import os
import sys


class InputError(Exception):
    """Raised for unreadable or unparseable input."""


EPS = 1e-12
OVERLAP_SLACK = 1e-9
STATISTICS = ("t", "F", "chi2", "z")


# ------------------------------------------------ incomplete beta and gamma


def betacf(a, b, x):
    """Continued fraction for the incomplete beta function (Lentz)."""
    tiny = 1e-300
    qab = a + b
    qap = a + 1.0
    qam = a - 1.0
    c = 1.0
    d = 1.0 - qab * x / qap
    if abs(d) < tiny:
        d = tiny
    d = 1.0 / d
    h = d
    for m in range(1, 300):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1.0 + aa * d
        if abs(d) < tiny:
            d = tiny
        c = 1.0 + aa / c
        if abs(c) < tiny:
            c = tiny
        d = 1.0 / d
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1.0 + aa * d
        if abs(d) < tiny:
            d = tiny
        c = 1.0 + aa / c
        if abs(c) < tiny:
            c = tiny
        d = 1.0 / d
        delta = d * c
        h *= delta
        if abs(delta - 1.0) < 1e-12:
            return h
    return h


def betainc(a, b, x):
    """Regularized incomplete beta function I_x(a, b)."""
    if x <= 0.0:
        return 0.0
    if x >= 1.0:
        return 1.0
    front = math.exp(
        math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b)
        + a * math.log(x) + b * math.log1p(-x)
    )
    if x < (a + 1.0) / (a + b + 2.0):
        return front * betacf(a, b, x) / a
    return 1.0 - front * betacf(b, a, 1.0 - x) / b


def gammq(a, x):
    """Regularized upper incomplete gamma function Q(a, x)."""
    if x < 0.0:
        raise InputError("x must be non-negative")
    if x == 0.0:
        return 1.0
    if x < a + 1.0:
        # Series for the lower P(a, x); Q = 1 - P.
        term = 1.0 / a
        total = term
        ap = a
        for _ in range(500):
            ap += 1.0
            term *= x / ap
            total += term
            if abs(term) < abs(total) * 1e-15:
                break
        lower = total * math.exp(-x + a * math.log(x) - math.lgamma(a))
        return 1.0 - lower
    # Continued fraction for Q(a, x).
    tiny = 1e-300
    b = x + 1.0 - a
    c = 1.0 / tiny
    d = 1.0 / b
    h = d
    for i in range(1, 500):
        an = -i * (i - a)
        b += 2.0
        d = an * d + b
        if abs(d) < tiny:
            d = tiny
        c = b + an / c
        if abs(c) < tiny:
            c = tiny
        d = 1.0 / d
        delta = d * c
        h *= delta
        if abs(delta - 1.0) < 1e-15:
            break
    return math.exp(-x + a * math.log(x) - math.lgamma(a)) * h


# ------------------------------------------------------------ distributions


def p_from_t(t, df):
    """Two-sided P for Student t."""
    return betainc(0.5 * df, 0.5, df / (df + t * t))


def p_from_f(f, df1, df2):
    """Upper-tail P for the F distribution."""
    return betainc(0.5 * df2, 0.5 * df1, df2 / (df2 + df1 * f))


def p_from_chi2(x, df):
    """Upper-tail P for the chi-square distribution."""
    return gammq(0.5 * df, 0.5 * x)


def p_from_z(z):
    """Two-sided P for the standard normal."""
    return math.erfc(abs(z) / math.sqrt(2.0))


# ------------------------------------------------------- printed rounding


def printed_decimals(value):
    """Decimal places a value was printed with, from its string form."""
    if isinstance(value, str):
        text = value.strip()
        if "." in text:
            return len(text.split(".", 1)[1])
        return 0
    if isinstance(value, int):
        return 0
    text = repr(float(value))
    if text.endswith(".0"):
        return 0
    if "." in text:
        return len(text.split(".", 1)[1])
    return 0


def half_ulp(value):
    """Half of the last printed digit: the rounding interval half-width."""
    return 0.5 * (10.0 ** -printed_decimals(value))


def as_number(value):
    """Parse a printed value into a float, or raise InputError."""
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        raise InputError("value %r is not a number" % (value,))


# ------------------------------------------------------------ P recomputation


def recompute_p(statistic, value, df):
    """Recompute the P value for one printed statistic."""
    if statistic == "t":
        if not isinstance(df, (int, float)) or isinstance(df, bool) or df <= 0:
            raise InputError("statistic t needs a positive scalar df")
        return p_from_t(abs(value), float(df))
    if statistic == "z":
        return p_from_z(value)
    if statistic == "chi2":
        if not isinstance(df, (int, float)) or isinstance(df, bool) or df <= 0:
            raise InputError("statistic chi2 needs a positive scalar df")
        if value < 0:
            raise InputError("statistic chi2 must be non-negative")
        return p_from_chi2(value, float(df))
    if statistic == "F":
        if not isinstance(df, (list, tuple)) or len(df) != 2:
            raise InputError("statistic F needs df1 and df2 as a two-item list")
        df1, df2 = df
        for name, number in (("df1", df1), ("df2", df2)):
            if not isinstance(number, (int, float)) or isinstance(number, bool) or number <= 0:
                raise InputError("statistic F needs positive %s" % name)
        if value < 0:
            raise InputError("statistic F must be non-negative")
        return p_from_f(value, float(df1), float(df2))
    raise InputError("unknown statistic %r (expected t, F, chi2, or z)" % (statistic,))


def p_envelope(statistic, value, df):
    """P interval the printed value's rounding can produce."""
    step = half_ulp(value)
    low = max(0.0, value - step)
    high = value + step
    endpoints = [recompute_p(statistic, low, df), recompute_p(statistic, high, df)]
    return min(endpoints), max(endpoints)


def check_p_item(item, alpha):
    """Verdict for one reported-statistic claim."""
    statistic = item.get("statistic")
    if statistic not in STATISTICS:
        raise InputError(
            "unknown statistic %r (expected t, F, chi2, or z)" % (statistic,)
        )
    value = as_number(item.get("value"))
    recomputed = recompute_p(statistic, value, item.get("df"))
    envelope = p_envelope(statistic, value, item.get("df"))
    record = {
        "check": "p_recompute",
        "statistic": statistic,
        "value": item.get("value"),
        "df": item.get("df"),
        "recomputed_p": recomputed,
        "envelope": [envelope[0], envelope[1]],
    }
    reported = item.get("reported_p")
    if reported is None:
        record["verdict"] = "PASS"
        record["reasons"] = ["no reported P to compare; recomputed P attached"]
        return record
    reported_p = as_number(reported)
    rstep = half_ulp(reported)
    reported_low = reported_p - rstep
    reported_high = reported_p + rstep
    record["reported_p"] = reported
    record["reported_interval"] = [reported_low, reported_high]

    overlaps = (
        reported_low <= envelope[1] + OVERLAP_SLACK
        and reported_high >= envelope[0] - OVERLAP_SLACK
    )
    if overlaps:
        record["verdict"] = "PASS"
        record["reasons"] = ["reported P is inside the recomputed rounding envelope"]
        return record

    envelope_below = envelope[1] < alpha
    envelope_above = envelope[0] >= alpha
    reported_below = reported_high < alpha
    reported_above = reported_low >= alpha
    if (envelope_below and reported_above) or (envelope_above and reported_below):
        record["verdict"] = "FAIL"
        record["reasons"] = [
            "reported P %s %s and recomputed P %s %s fall on opposite sides of alpha=%s"
            % (
                reported,
                _interval(reported_low, reported_high),
                _number(recomputed),
                _interval(envelope[0], envelope[1]),
                _number(alpha),
            ),
            "decision error: the reported and recomputed P values disagree on significance",
        ]
    else:
        record["verdict"] = "WARN"
        record["reasons"] = [
            "reported P %s %s is outside the recomputed rounding envelope %s"
            % (reported, _interval(reported_low, reported_high), _interval(envelope[0], envelope[1])),
            "inconsistent, but both stay on the same side of alpha=%s" % _number(alpha),
        ]
    return record


# ------------------------------------------------------------------- GRIM


def grim_solution(kind, value, n, granularity):
    """Return True when some integer count produces the printed value."""
    step = half_ulp(value)
    if kind == "mean":
        target = value * n / granularity
        unit = granularity / n
    elif kind == "percent":
        target = value * n / 100.0
        unit = 100.0 / n
    else:
        raise InputError("unknown grim kind %r (expected mean or percent)" % (kind,))
    base = int(round(target))
    for count in (base - 1, base, base + 1):
        if kind == "mean":
            if count < 0:
                continue
            produced = count * granularity / n
        else:
            if count < 0 or count > n:
                continue
            produced = 100.0 * count / n
        if abs(produced - value) <= step + EPS:
            return True
    return False


def check_grim_item(item, alpha):
    """Verdict for one GRIM claim (mean or percentage with N)."""
    kind = item.get("kind")
    if kind not in ("mean", "percent"):
        raise InputError("unknown grim kind %r (expected mean or percent)" % (kind,))
    n = item.get("n")
    if not isinstance(n, (int, float)) or isinstance(n, bool) or n <= 0:
        raise InputError("grim needs a positive integer n")
    n = int(n)
    value = as_number(item.get("value"))
    if kind == "mean":
        granularity = item.get("granularity", 1)
        if not isinstance(granularity, (int, float)) or isinstance(granularity, bool) or granularity <= 0:
            raise InputError("grim mean needs a positive granularity")
        granularity = float(granularity)
        source = item.get("granularity_source", "inferred")
    else:
        granularity = 1.0
        # A percentage's denominator is the printed N, so its arithmetic is
        # declared rather than assumed.
        source = item.get("granularity_source", "declared")
    record = {
        "check": "grim",
        "kind": kind,
        "value": item.get("value"),
        "n": n,
    }
    if kind == "mean":
        record["granularity"] = granularity
    record["granularity_source"] = source
    if grim_solution(kind, value, n, granularity):
        record["verdict"] = "PASS"
        record["reasons"] = ["an integer count reproduces the printed value at its rounding"]
        return record
    impossible = (
        "no integer count reproduces %s at n=%s within the printed rounding"
        % (item.get("value"), n)
    )
    if source == "declared":
        record["verdict"] = "FAIL"
        record["reasons"] = [impossible, "arithmetically impossible under the declared granularity"]
    else:
        record["verdict"] = "WARN"
        record["reasons"] = [
            impossible,
            "impossible only under the inferred granularity; confirm the scale before failing",
        ]
    return record


# --------------------------------------------------------------- reporting


def _number(value):
    return ("%.6g" % value)


def _interval(low, high):
    return "[%.6g, %.6g]" % (low, high)


def check_item(item, alpha):
    """Classify one claims item, failing closed on anything unusable."""
    if not isinstance(item, dict):
        return {
            "check": "malformed",
            "verdict": "FAIL",
            "reasons": ["claims item is not an object"],
        }
    record = dict(id=item.get("id"), location=item.get("location"))
    try:
        if "check" in item:
            if item["check"] == "grim":
                record.update(check_grim_item(item, alpha))
            else:
                raise InputError(
                    "unknown check %r (expected grim or a statistic)" % (item["check"],)
                )
        elif item.get("statistic"):
            record.update(check_p_item(item, alpha))
        else:
            raise InputError("no statistic or check given")
    except InputError as error:
        record.update({"check": "malformed", "verdict": "FAIL", "reasons": [str(error)]})
    return record


def summarize(items):
    """Count verdicts for the report envelope."""
    counts = {"PASS": 0, "WARN": 0, "FAIL": 0}
    for item in items:
        counts[item["verdict"]] = counts.get(item["verdict"], 0) + 1
    verdict = "FAIL" if counts["FAIL"] else ("WARN" if counts["WARN"] else "PASS")
    return {
        "verdict": verdict,
        "n_total": len(items),
        "n_pass": counts["PASS"],
        "n_warn": counts["WARN"],
        "n_fail": counts["FAIL"],
    }


def print_summary(summary, items):
    """Print a human-readable check summary."""
    print("Statistic recomputation check")
    print(
        "  total %d | pass %d | warn %d | fail %d"
        % (summary["n_total"], summary["n_pass"], summary["n_warn"], summary["n_fail"])
    )
    for item in items:
        if item["verdict"] == "PASS":
            continue
        label = item.get("id") or item.get("location") or "?"
        print("  %-4s %s" % (item["verdict"], label))
        for reason in item["reasons"]:
            print("       - %s" % reason)
    print("  verdict: %s" % summary["verdict"])


def main(argv=None) -> int:
    """Entry point. Returns a process exit code."""
    parser = argparse.ArgumentParser(
        description="Recompute reported statistics and check their internal consistency."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    check_parser = subparsers.add_parser(
        "check", help="classify a claims file of printed statistics"
    )
    check_parser.add_argument("path", help="JSON file of printed-statistic claims")
    check_parser.add_argument("--alpha", type=float, default=0.05)
    check_parser.add_argument("--out", default="qc/stat_check.json")

    args = parser.parse_args(argv)

    try:
        if not 0.0 < args.alpha < 1.0:
            raise InputError("alpha must be between 0 and 1")
        if not os.path.exists(args.path):
            raise InputError("no such file: %s" % args.path)
        with open(args.path, "r", encoding="utf-8") as handle:
            try:
                claims = json.load(handle)
            except ValueError as error:
                raise InputError("could not parse %s as JSON: %s" % (args.path, error))
        if not isinstance(claims, dict) or not isinstance(claims.get("items", []), list):
            raise InputError("claims must be an object with an items list")

        items = [check_item(item, args.alpha) for item in claims.get("items", [])]
        summary = summarize(items)
        report = {
            "alpha": args.alpha,
            "source": claims.get("source"),
            "summary": summary,
            "items": items,
        }
        directory = os.path.dirname(os.path.abspath(args.out))
        if directory:
            os.makedirs(directory, exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2, sort_keys=True)
            handle.write("\n")
        print_summary(summary, items)
        print("  report: %s" % args.out)
        if summary["n_fail"]:
            return 2
        return 0
    except InputError as error:
        sys.stderr.write("error: %s\n" % error)
        return 1


if __name__ == "__main__":
    sys.exit(main())
