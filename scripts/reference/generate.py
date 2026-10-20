"""Independent reference values for the statistics engine (PRD sections 3 to 9).

Standard library only. Shares no code with src/stats: the TypeScript engine is tested
against this output, so a formula slip in either side shows up as a mismatch.

    npm run reference   # writes src/stats/__fixtures__/reference.json
"""

import json
import math
from statistics import NormalDist

ND = NormalDist()
SQRT2 = math.sqrt(2.0)


def upper_tail(x):
    return 0.5 * math.erfc(x / SQRT2)


def z_upper(q):
    """z such that P(Z > z) = q, accurate for tiny q."""
    return -ND.inv_cdf(q)


def pdf(x):
    return math.exp(-0.5 * x * x) / math.sqrt(2.0 * math.pi)


# ------------------------------------------------------------------ settings (PRD section 2)

def effective_alpha(confidence, groups, bonferroni):
    alpha = 1.0 - confidence
    return alpha / (groups - 1) if bonferroni and groups >= 3 else alpha


def z_alpha(alpha, two_sided):
    return z_upper(alpha / 2.0 if two_sided else alpha)


# ------------------------------------------------------------------ sample size (PRD section 3)

def sample_size(p, lift, alpha, power, two_sided):
    p1 = p
    p2 = p * (1.0 + lift)
    pbar = (p1 + p2) / 2.0
    za = z_alpha(alpha, two_sided)
    zb = ND.inv_cdf(power)
    num = za * math.sqrt(2.0 * pbar * (1.0 - pbar)) + zb * math.sqrt(p1 * (1.0 - p1) + p2 * (1.0 - p2))
    return num * num / (p2 - p1) ** 2


def mde(p, n, alpha, power, two_sided):
    """Relative lift whose sample size is exactly n. Bisection on log(lift), 200 steps."""
    top = 1.0 / p - 1.0
    if sample_size(p, top, alpha, power, two_sided) > n:
        return None
    lo, hi = math.log(1e-9), math.log(top)
    for _ in range(200):
        mid = (lo + hi) / 2.0
        if sample_size(p, math.exp(mid), alpha, power, two_sided) > n:
            lo = mid
        else:
            hi = mid
    return math.exp(hi)


# ------------------------------------------------------------------ group sequential (PRD section 4)
# Lan-DeMets O'Brien-Fleming spending per side, as in gsDesign sfLDOF and ldbounds:
# a two-sided test of level alpha spends alpha/2 on each side.

def side_alpha(alpha, two_sided):
    return alpha / 2.0 if two_sided else alpha


def obf_cumulative_spend(alpha, two_sided, t):
    a = side_alpha(alpha, two_sided)
    per_side = 2.0 * upper_tail(z_upper(a / 2.0) / math.sqrt(t))
    return 2.0 * per_side if two_sided else per_side


class Recursion:
    """Armitage-McPherson-Rowe recursion on the score scale S_k = Z_k * sqrt(t_k)."""

    def __init__(self, t, two_sided, theta=0.0):
        self.t = t
        self.two_sided = two_sided
        self.theta = theta
        self.nodes = None  # list of (s, weight * density) at the previous look

    def _increment(self, k):
        return self.t[k] - (self.t[k - 1] if k else 0.0)

    def crossing(self, k, b):
        """(upper, lower) probability of stopping exactly at look k with boundary b."""
        tk = self.t[k]
        hi = b * math.sqrt(tk)
        if k == 0:
            sd = math.sqrt(tk)
            mu = self.theta * tk
            upper = upper_tail((hi - mu) / sd)
            lower = upper_tail((hi + mu) / sd) if self.two_sided else 0.0
            return upper, lower
        d = self._increment(k)
        sd = math.sqrt(d)
        drift = self.theta * d
        upper = lower = 0.0
        for u, wg in self.nodes:
            upper += wg * upper_tail((hi - u - drift) / sd)
            if self.two_sided:
                lower += wg * upper_tail((hi + u + drift) / sd)
        return upper, lower

    def advance(self, k, b):
        tk = self.t[k]
        hi = b * math.sqrt(tk)
        lo = -hi if self.two_sided else self.theta * tk - 12.0 * math.sqrt(tk)
        d = self._increment(k)
        d_next = self.t[k + 1] - tk if k + 1 < len(self.t) else d
        h = min(math.sqrt(d), math.sqrt(d_next)) / 12.0
        m = max(2, int(math.ceil((hi - lo) / h)))
        m += m % 2
        h = (hi - lo) / m
        new = []
        for i in range(m + 1):
            s = lo + i * h
            w = (1.0 if i in (0, m) else (4.0 if i % 2 else 2.0)) * h / 3.0
            if k == 0:
                g = pdf((s - self.theta * tk) / math.sqrt(tk)) / math.sqrt(tk)
            else:
                sd = math.sqrt(d)
                drift = self.theta * d
                g = 0.0
                for u, wg in self.nodes:
                    g += wg * pdf((s - u - drift) / sd)
                g /= sd
            new.append((s, w * g))
        self.nodes = new


def boundaries(t, cumulative, two_sided):
    rec = Recursion(t, two_sided)
    out = []
    spent = 0.0
    for k in range(len(t)):
        target = cumulative[k] - spent
        lo, hi = 0.0, 40.0
        for _ in range(80):
            mid = (lo + hi) / 2.0
            u, l = rec.crossing(k, mid)
            if u + l > target:
                lo = mid
            else:
                hi = mid
        b = (lo + hi) / 2.0
        out.append(b)
        spent = cumulative[k]
        if k + 1 < len(t):
            rec.advance(k, b)
    return out


def power_at(t, b, two_sided, theta):
    rec = Recursion(t, two_sided, theta)
    total = 0.0
    for k in range(len(t)):
        total += rec.crossing(k, b[k])[0]
        if k + 1 < len(t):
            rec.advance(k, b[k])
    return total


def spent_alpha(t, b, two_sided):
    """Total type I error of the boundaries: P(stop at any look) with no drift."""
    rec = Recursion(t, two_sided)
    total = 0.0
    for k in range(len(t)):
        total += sum(rec.crossing(k, b[k]))
        if k + 1 < len(t):
            rec.advance(k, b[k])
    return total


def inflation_factor(t, b, alpha, power, two_sided):
    theta_fixed = z_upper(side_alpha(alpha, two_sided)) + ND.inv_cdf(power)
    lo, hi = theta_fixed, theta_fixed * 1.5
    for _ in range(45):
        mid = (lo + hi) / 2.0
        if power_at(t, b, two_sided, mid) < power:
            lo = mid
        else:
            hi = mid
    return ((lo + hi) / 2.0 / theta_fixed) ** 2


def equally_spaced(k):
    return [(j + 1) / k for j in range(k)]


def design(alpha, power, two_sided, looks):
    t = equally_spaced(looks)
    b = boundaries(t, [obf_cumulative_spend(alpha, two_sided, x) for x in t], two_sided)
    return t, b, inflation_factor(t, b, alpha, power, two_sided)


# ------------------------------------------------------------------ Beta posteriors (PRD section 7)
# Exact quantities by quadrature on a shared grid, not by simulation.

class Posteriors:
    def __init__(self, groups, points=40000):
        params = [(1.0 + c, 1.0 + n - c) for n, c in groups]
        lo, hi = 1.0, 0.0
        for a, b in params:
            mean = a / (a + b)
            sd = math.sqrt(a * b / ((a + b) ** 2 * (a + b + 1.0)))
            lo = min(lo, mean - 14.0 * sd)
            hi = max(hi, mean + 14.0 * sd)
        lo, hi = max(lo, 0.0), min(hi, 1.0)
        self.h = (hi - lo) / points
        self.x = [lo + i * self.h for i in range(points + 1)]
        self.f, self.F = [], []
        for a, b in params:
            lbeta = math.lgamma(a) + math.lgamma(b) - math.lgamma(a + b)
            dens = []
            for x in self.x:
                if x <= 0.0 or x >= 1.0:
                    edge = (a == 1.0 and x <= 0.0) or (b == 1.0 and x >= 1.0)
                    dens.append(math.exp(-lbeta) if edge else 0.0)
                else:
                    dens.append(math.exp((a - 1.0) * math.log(x) + (b - 1.0) * math.log1p(-x) - lbeta))
            cdf = [0.0]
            for i in range(1, len(dens)):
                cdf.append(cdf[-1] + (dens[i - 1] + dens[i]) * self.h / 2.0)
            total = cdf[-1]
            self.f.append([d / total for d in dens])
            self.F.append([c / total for c in cdf])

    def _trapz(self, ys):
        return self.h * (sum(ys) - (ys[0] + ys[-1]) / 2.0)

    def p_beats(self, v, c):
        return self._trapz([fv * Fc for fv, Fc in zip(self.f[v], self.F[c])])

    def p_best(self, i):
        ys = []
        for j in range(len(self.x)):
            prod = self.f[i][j]
            for g in range(len(self.f)):
                if g != i:
                    prod *= self.F[g][j]
            ys.append(prod)
        return self._trapz(ys)

    def expected_loss(self, v, c):
        """E[max(c - v, 0)] = integral of f_v(x) * (E[c; c > x] - x * P(c > x))."""
        n = len(self.x)
        tail_mass = [0.0] * n
        tail_moment = [0.0] * n
        for j in range(n - 2, -1, -1):
            fc0, fc1 = self.f[c][j], self.f[c][j + 1]
            tail_mass[j] = tail_mass[j + 1] + (fc0 + fc1) * self.h / 2.0
            tail_moment[j] = tail_moment[j + 1] + (self.x[j] * fc0 + self.x[j + 1] * fc1) * self.h / 2.0
        return self._trapz([self.f[v][j] * (tail_moment[j] - self.x[j] * tail_mass[j]) for j in range(n)])

    def _cdf_at(self, g, x):
        if x <= self.x[0]:
            return 0.0
        if x >= self.x[-1]:
            return 1.0
        pos = (x - self.x[0]) / self.h
        j = int(pos)
        frac = pos - j
        return self.F[g][j] * (1.0 - frac) + self.F[g][j + 1] * frac

    def lift_quantile(self, v, c, q):
        """Quantile of (v - c) / c: solve P(v <= (1 + r) c) = q."""
        step = 10
        idx = range(0, len(self.x), step)
        w = self.h * step

        def cdf(r):
            return w * sum(self.f[c][j] * self._cdf_at(v, (1.0 + r) * self.x[j]) for j in idx)

        lo, hi = -1.0, 10.0
        for _ in range(60):
            mid = (lo + hi) / 2.0
            if cdf(mid) < q:
                lo = mid
            else:
                hi = mid
        return (lo + hi) / 2.0


# ------------------------------------------------------------------ SRM (PRD section 8)

def gamma_q(a, x):
    """Regularized upper incomplete gamma Q(a, x), series or Lentz continued fraction."""
    if x <= 0.0:
        return 1.0
    gln = math.lgamma(a)
    if x < a + 1.0:
        term = total = 1.0 / a
        ap = a
        for _ in range(10000):
            ap += 1.0
            term *= x / ap
            total += term
            if abs(term) < abs(total) * 1e-16:
                break
        return 1.0 - total * math.exp(-x + a * math.log(x) - gln)
    tiny = 1e-300
    b = x + 1.0 - a
    c = 1.0 / tiny
    d = 1.0 / b
    h = d
    for i in range(1, 10000):
        an = -i * (i - a)
        b += 2.0
        d = an * d + b
        d = tiny if abs(d) < tiny else d
        c = b + an / c
        c = tiny if abs(c) < tiny else c
        d = 1.0 / d
        delta = d * c
        h *= delta
        if abs(delta - 1.0) < 1e-16:
            break
    return math.exp(-x + a * math.log(x) - gln) * h


def srm(users, split):
    total = sum(users)
    chi = sum((o - total * s) ** 2 / (total * s) for o, s in zip(users, split))
    return chi, gamma_q((len(users) - 1) / 2.0, chi / 2.0)


# ------------------------------------------------------------------ scenarios

def verdict_z(significant, diff, two_sided, achieved_mde, reference):
    if significant and diff > 0:
        return "winner"
    if significant and diff < 0 and two_sided:
        return "loser"
    return "no-difference" if achieved_mde is not None and achieved_mde <= reference else "underpowered"


def verdict_bayes(p_beat, confidence, achieved_mde, reference):
    if p_beat >= confidence:
        return "winner"
    if p_beat <= 1.0 - confidence:
        return "loser"
    return "no-difference" if achieved_mde is not None and achieved_mde <= reference else "underpowered"


def analysis(name, groups, days, settings, reference_lift=0.10, split=None, revenue=None, sequential=None, share=1.0):
    confidence, power, two_sided, bonferroni = settings
    k = len(groups)
    split = split or [1.0 / k] * k
    alpha = effective_alpha(confidence, k, bonferroni)
    za = z_alpha(alpha, two_sided)
    nc, cc = groups[0]
    pc = cc / nc
    post = Posteriors(groups)
    tail = (1.0 - confidence) / 2.0
    required = math.ceil(sample_size(pc, reference_lift, alpha, power, two_sided))
    variants = []
    for i in range(1, k):
        nv, cv = groups[i]
        pv = cv / nv
        diff = pv - pc
        se = math.sqrt(pc * (1 - pc) / nc + pv * (1 - pv) / nv)
        z = diff / se
        p_value = 2.0 * upper_tail(abs(z)) if two_sided else upper_tail(z)
        ci = [diff - za * se, diff + za * se] if two_sided else [diff - za * se, None]
        achieved = mde(pc, min(nc, nv), alpha, power, two_sided)
        significant = p_value < alpha
        entry = {
            "id": "ABCDE"[i],
            "lift": diff / pc,
            "absoluteDiff": diff,
            "z": z,
            "pValue": p_value,
            "significant": significant,
            "ciAbsolute": ci,
            "observedPower": ND.cdf(abs(z) - za),
            "achievedMde": achieved,
            "requiredSamplePerVariant": required,
            "probabilityToBeatControl": post.p_beats(i, 0),
            "probabilityToBeBest": post.p_best(i),
            "expectedLossAbsolute": post.expected_loss(i, 0),
            "credibleIntervalRelative": [post.lift_quantile(i, 0, tail), post.lift_quantile(i, 0, 1.0 - tail)],
        }
        if sequential is not None:
            planned_looks, look, planned_n = sequential
            frac = min(1.0, min(nc, nv) / planned_n)
            final = look >= planned_looks or frac >= 1.0
            t = [frac * (j + 1) / look for j in range(look)]
            cumulative = [obf_cumulative_spend(alpha, two_sided, x) for x in t]
            if final:
                cumulative[-1] = alpha
            b = boundaries(t, cumulative, two_sided)[-1]
            entry["sequential"] = {"informationFraction": frac, "zBoundary": b, "crossed": abs(z) >= b if two_sided else z >= b, "isFinal": final}
            significant = entry["sequential"]["crossed"]
        entry["verdictZ"] = verdict_z(significant, diff, two_sided, achieved, reference_lift)
        entry["verdictBayes"] = verdict_bayes(entry["probabilityToBeatControl"], confidence, achieved, reference_lift)
        variants.append(entry)
    chi, p_srm = srm([n for n, _ in groups], split)
    total_users = sum(n for n, _ in groups)
    smallest = min(n for n, _ in groups)
    out = {
        "name": name,
        "input": {"groups": [{"users": n, "conversions": c} for n, c in groups], "days": days, "intendedSplit": split, "trafficShare": share,
                  "referenceLift": reference_lift, "sequential": sequential, "revenue": revenue},
        "settings": {"confidence": confidence, "power": power, "hypothesis": "two-sided" if two_sided else "one-sided", "bonferroni": bonferroni},
        "alpha": alpha,
        "rates": [c / n for n, c in groups],
        "variants": variants,
        "srm": {"chiSquare": chi, "pValue": p_srm},
        "extraDays": max(0, math.ceil((required - smallest) * k / (total_users / days))) if days else None,
        "probabilityToBeBestControl": post.p_best(0),
    }
    if revenue is not None and days:
        value, months = revenue
        monthly = total_users / days * 30.0 / share
        out["revenue"] = {
            "monthlyVisitors": monthly,
            "perVariant": [{"extraMonthlyConversions": monthly * (c / n - pc), "monthlyContribution": monthly * (c / n - pc) * value,
                            "horizonImpact": monthly * (c / n - pc) * value * months} for n, c in groups[1:]],
            "forecastLastMonth": [monthly * (c / n) * value * months for n, c in groups],
        }
    return out


def pretest(name, weekly_traffic, weekly_conversions, groups, share, horizon, target, settings, looks):
    confidence, power, two_sided, bonferroni = settings
    alpha = effective_alpha(confidence, groups, bonferroni)
    p = weekly_conversions / weekly_traffic
    weeks = []
    for w in range(1, horizon + 1):
        n = weekly_traffic * share * w / groups
        m = mde(p, n, alpha, power, two_sided)
        weeks.append({"week": w, "visitorsPerVariant": n, "mdeRelative": m, "mdeAbsolute": m * p})
    n_target = sample_size(p, target, alpha, power, two_sided)
    daily = weekly_traffic / 7.0 * share
    days = math.ceil(n_target * groups / daily)
    t, b, r = design(alpha, power, two_sided, looks)
    max_n = n_target * r
    return {
        "name": name,
        "input": {"weeklyTraffic": weekly_traffic, "weeklyConversions": weekly_conversions, "groups": groups, "trafficShare": share,
                  "horizonWeeks": horizon, "targetLift": target, "looks": looks},
        "settings": {"confidence": confidence, "power": power, "hypothesis": "two-sided" if two_sided else "one-sided", "bonferroni": bonferroni},
        "baselineRate": p,
        "alpha": alpha,
        "weeks": weeks,
        "targetLift": {"samplePerVariant": math.ceil(n_target), "days": days},
        "sequential": {
            "inflationFactor": r,
            "maxSamplePerVariant": math.ceil(max_n),
            "boundaries": [{"look": i + 1, "informationFraction": x, "zBoundary": z,
                            "nominalP": 2.0 * upper_tail(z) if two_sided else upper_tail(z)} for i, (x, z) in enumerate(zip(t, b))],
            "planDays": math.ceil(max_n * groups / daily),
        },
    }


def obf_table():
    rows = []
    for two_sided in (True, False):
        for k in (2, 3, 4, 5):
            t, b, r80 = design(0.05, 0.8, two_sided, k)
            r90 = inflation_factor(t, b, 0.05, 0.9, two_sided)
            rows.append({"alpha": 0.05, "hypothesis": "two-sided" if two_sided else "one-sided", "looks": k,
                         "boundaries": b, "inflationFactor": {"0.8": r80, "0.9": r90}, "spentAlpha": spent_alpha(t, b, two_sided)})
    return rows


def rounded(value):
    if isinstance(value, float):
        return float(f"{value:.10g}")
    if isinstance(value, dict):
        return {k: rounded(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [rounded(v) for v in value]
    return value


def main():
    two_sided = (0.95, 0.8, True, True)
    one_sided = (0.95, 0.8, False, True)
    no_bonferroni = (0.95, 0.8, True, False)
    fixture = [(80000, 1600), (80000, 1696)]
    three = [(20000, 400), (20000, 460), (20000, 430)]
    five = [(30000, 900), (30000, 990), (30000, 960), (30000, 880), (30000, 1020)]
    reference = {
        "analysis": [
            analysis("two-group", fixture, 14, two_sided, revenue=(150.0, 6), share=0.5),
            analysis("two-group-one-sided", fixture, 14, one_sided),
            analysis("srm", [(50000, 1000), (48500, 1000)], 14, two_sided),
            analysis("three-group-bonferroni", three, 21, two_sided),
            analysis("three-group-no-bonferroni", three, 21, no_bonferroni),
            analysis("five-group-bonferroni", five, 28, two_sided),
            analysis("five-group-no-bonferroni", five, 28, no_bonferroni),
            analysis("sequential-look-2-of-4", [(40000, 800), (40000, 900)], 14, two_sided, sequential=(4, 2, 80000)),
            analysis("sequential-final", [(82000, 1640), (82000, 1760)], 28, two_sided, sequential=(4, 4, 80000)),
            analysis("sequential-one-sided-look-2-of-4", [(40000, 800), (40000, 900)], 14, one_sided, sequential=(4, 2, 80000)),
            analysis("sequential-one-sided-final", fixture, 14, one_sided, sequential=(4, 4, 80000)),
        ],
        "pretest": [
            pretest("two-group", 10000, 300, 2, 1.0, 4, 0.10, two_sided, 4),
            pretest("three-group-one-sided", 20000, 500, 3, 0.5, 6, 0.15, one_sided, 3),
        ],
        "obf": obf_table(),
    }
    print(json.dumps(rounded(reference), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
