# Controls for the ArSL signing area (space, delete, cancel, done)

The old rule gestures (open palm, fist, thumbs up / down in the command zone) are still there and are **not changed**. This adds controls the model itself can give, so the team can see, with recordings, which way works better for ArSL. Nothing here says one is better: that is what the evaluation and the overlay log are for.

## Two kinds, and which list they are in
`config/alphabets/arsl.json` has a `controls` table (class id -> action) and the class itself is in one of the label lists:

| control | action | kind | where | recognised by |
| --- | --- | --- | --- | --- |
| `ctl_space` | space (new word) | **static** | `static` | the letter model (k-NN / MLP), a hand shape held still, trained from our own takes |
| `ctl_done` | done (finish, = thumbs up) | **static** | `static` | the letter model |
| `ctl_delete` | delete (take the last letter back) | **dynamic** | `dynamic` | $1 (dollarpy-style, `src/recognition/dollarP.ts`) on the path of the **index fingertip** (landmark 8) against templates recorded through the collection page |
| `ctl_cancel` | cancel (go back, = thumbs down) | **dynamic** | `dynamic` | $1 |

The split is a first decision (it is in the file's `todo`): to change it, move the class between `static` and `dynamic` and record again. **Which hand shape and which stroke each control is has not been decided**: the team chooses and records them. The classes are commands, not letters: they are not in the letter lists, are never written, and a model class named `ctl_*` is acted on as the action, not shown.

## How a control acts
- **Static**: classified every still frame like a letter; held for `controlHoldMs` (shorter than a letter's hold) with enough confidence, then the action fires once. No candidate is shown. The hand must change before it can fire again.
- **Dynamic**: the stroke is followed while the index fingertip moves; when it stops, $1 compares it with the templates; at `motionMinScore` or more the action fires at once. The same gate as for J / Z (minimum duration and length) keeps a trembling hand out.
- Both give the same event as the old gesture (`SPACE`, `YES`, `DELETE`, `NO`), so the machine does the same thing.
- **A control wins over a letter in the same frame**: a rule gesture or the command zone stops the model's letters and controls, and a frame that sends a command sends no model event (`src/recognition/priority.ts`).

## Recording (collection page, `/?collect=1&alphabet=arsl`)
The **Controls** box has one button per control ("Control take: space (static)", ...). Static ones are recorded like a letter, dynamic ones like J / Z (the 21 landmarks over 2.2 s; the fingertip path is taken from them). Every take gets `person` = your signer code, so the tools hold whole people out. **Record several takes each, with several people, and record `none` takes too** (hand moving, relaxed, in the command zone): without them nothing can show how often a control fires by mistake. The exported file is data: it stays on the computer (`.gitignore`), never in git.

## Evaluating (leave-one-person-out, controls together with the letters)
    python ml/evaluate.py --data ml/data/arsl21l.jsonl ml/data/controls.jsonl --alphabet arsl --dataset-name ArSL21L+controls --dataset-version "as published + ours" --augment all
(The ArSL21L file has persons; the controls file has persons from the collection page. Both are person ids, so the split is by person. At least two people must have recorded the controls, otherwise a person cannot be left out and the tool says so.)

The report gets a **Controls** section, counts and shares only, never a person:
- static controls: recall, how often each is taken for another control, a letter or `none`; how many letter frames and `none` frames are shown as a control at the confidence limit (false triggers);
- dynamic controls: $1 leave-one-person-out recall and confusion between controls; and the **false triggers**: how many `none` takes (and static letter takes) are long and moving enough for the app to try them and then match a control template.

## Seeing why a control fired or did not (`?letterdebug=1`)
The panel row **decided by** shows, for every frame, who decided: the old rule gesture, a control class (letter model), a $1 template or the letter model, with what it decided and its score. The CSV log has `decided_by`, `decided` and `score` per frame. Use it to see whether `delete` / `cancel` / `space` / `done` fail because the old gesture is not recognised (then the gesture thresholds can be looked at, with a test) or because a control class competes with it. **The old thresholds are not changed** until the log shows why they miss.

## Model files
`ml/export_arsl.py` writes `letters-arsl-mlp.json` and `letters-arsl-knn.json` (the static controls are classes in them) and, when the takes hold dynamic ones, `motion-arsl-dollar.json` (the $1 templates of the dynamic controls). The browser reads `motion-arsl-dollar.json` for ArSL and `motion-dollar.json` (J, Z) for ASL, and refuses templates with labels the alphabet does not have.
