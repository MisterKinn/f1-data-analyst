"""Report-only reproduction; requires SciPy, never imported by model/runtime.

ASSUMED: independent normal track-level paired harms, SD .2 pp, alpha .05,
power .80. Gap = noninferiority margin minus the assumed true mean harm.
"""
import json
from math import ceil, sqrt

from scipy import __version__
from scipy.optimize import brentq
from scipy.stats import nct, norm, t


def power(n, gap, sd=0.2):
    return float(nct.cdf(-t.ppf(.95, n - 1), n - 1, -gap * sqrt(n) / sd))


def report():
    plans = []
    for gap in (.10, .069, .05):
        n = next(n for n in range(2, 10001) if power(n, gap) >= .80)
        plans.append({"gapPp": gap, "normalApproxN": ceil(
            ((norm.ppf(.95) + norm.ppf(.80)) * .2 / gap) ** 2),
            "exactN": n, "powerAtNMinus1": power(n - 1, gap), "powerAtN": power(n, gap)})
    return {"mode": "report-only", "scipy": __version__, "assumptions": {
        "alpha": .05, "power": .80, "independentTrackSdPp": .2}, "plans": plans,
        "fixedN": [{"tracks": n, "powerAtGapPoint1": power(n, .1),
                    "mde80Pp": brentq(lambda gap: power(n, gap) - .8, 1e-8, 3)}
                   for n in (6, 11, 18, 35)]}


if __name__ == "__main__":
    print(json.dumps(report(), indent=2, allow_nan=False))
