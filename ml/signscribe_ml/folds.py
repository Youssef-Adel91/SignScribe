"""Which takes are held out together. Never a random split: frames of one take (and of one person) are near copies of each other."""
from __future__ import annotations

from collections import defaultdict

from .dataset import Take


class FoldError(ValueError):
    pass


OPTIMISTIC = "5-fold over takes (one signer, one session: optimistic, do not quote as accuracy for new people)"


def make_groups(takes: list[Take], kind: str = "static", group_by: str = "auto"):
    """Returns (method, group label per take, generalises).

    `generalises` is False only for the same-person fallback: its number says how repeatable one person is,
    not how well the app will work for someone new, so it must never be a headline.
    group_by: auto | person | source | signer | session. auto picks the first of person, source, signer, session
    that has at least 2 groups covering every take."""
    mine = [t for t in takes if t.kind == kind]
    if not mine:
        raise FoldError(f"no {kind} takes")

    def by_person():
        return [t.person for t in takes] if all(t.person for t in mine) and len({t.person for t in mine}) >= 2 else None

    def by_source():
        return [t.source for t in takes] if all(t.source for t in mine) and len({t.source for t in mine}) >= 2 else None

    def by_signer():
        return [t.signer for t in takes] if len({t.signer for t in mine}) >= 2 else None

    def by_session():
        return [f"{t.signer}/{t.session}" for t in takes] if len({(t.signer, t.session) for t in mine}) >= 2 else None

    options = {
        "person": ("leave-one-person-out", by_person),
        "source": ("leave-one-source-out", by_source),
        "signer": ("leave-one-signer-out", by_signer),
        "session": ("leave-one-session-out", by_session),
    }
    order = list(options) if group_by == "auto" else [group_by]
    if group_by != "auto" and group_by not in options:
        raise FoldError(f"group_by must be auto, {', '.join(options)}")
    for name in order:
        method, fn = options[name]
        g = fn()
        if g is not None:
            return method, g, True
    if group_by != "auto":
        raise FoldError(f"cannot group by {group_by}: every take needs it and there must be at least 2 different values")
    seen: dict = defaultdict(int)
    groups = []
    for t in takes:
        groups.append(f"fold{seen[t.label] % 5}")
        seen[t.label] += 1
    return OPTIMISTIC, groups, False
