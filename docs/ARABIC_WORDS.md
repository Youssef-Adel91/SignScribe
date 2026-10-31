# Arabic helper words (ArSL stage 1)

`src/nlp/arabicWords.ts` is the list of words an Arabic sentence may contain **besides the words the person chose**. It is used by the sentence validator (`validateSentence(..., 'arabic')` in `src/nlp/validate.ts`) in the browser and on the sentence server, and its words are given to the language model in its instructions. `tests/arabic-words.test.ts` keeps this document and the file in step.

**Source: written by us for this project.** No outside list, corpus or licence is involved. Every entry is a judgement call, like `FUNCTION_WORDS` for English.

## The rule
A word in an Arabic sentence is allowed when it is
1. one of the words the person spelt, or that word with the small words that are written joined to the front of a word in Arabic (و، ف، ب، ل، ك and the article ال, in that order, for example `وماء` for `ماء`); or
2. in the list below.

Anything else is an **added word** and the sentence is refused; the app then keeps the plain words (the offline sentence is the chosen words, nothing added). Vowel marks and the stretching line are ignored when comparing, and the alef forms أ إ آ ٱ are treated as ا, and ى as ي. Teh marbuta (ة) is not ignored.

The sentence must also pass the limits that stay for every language: 200 characters, 25 words, two sentences, no links, Arabic letters and punctuation only (so no digits), and every chosen word must appear.

## The list (52 words)
أنا نحن أنت أنتم هو هي هم هذا هذه ذلك تلك هنا هناك و أو لكن إذا في على من إلى عن مع فضلك لو سمحت ممكن يمكن أرجو هل أريد أحتاج نحتاج نريد يريد يحتاج ما ماذا أين متى كيف كم مرحبا أهلا شكرا عفوا آسف آسفة جدا قليلا كثيرا الآن

Groups: pronouns and pointing words (أنا نحن أنت أنتم هو هي هم هذا هذه ذلك تلك هنا هناك), small joining words (و أو لكن إذا في على من إلى عن مع), asking politely (من فضلك لو سمحت ممكن يمكن أرجو هل), wanting and needing (أريد أحتاج نحتاج نريد يريد يحتاج), question words (ما ماذا أين متى كيف كم), greetings and thanks (مرحبا أهلا شكرا عفوا آسف آسفة), how much (جدا قليلا كثيرا), now (الآن).

## What is left out on purpose
- **Negation** (لا لم لن ليس غير بدون): a sentence must never say the opposite of what was chosen.
- Numbers, times, places, names, and every noun or verb that states a fact. The person chooses those.
- "Yes" (نعم), "because" (لأن), "then" (ثم): they add a claim or an order of events.

## Known limits
- The list is small and the check does not know Arabic grammar: a good sentence with an ending or a joined pronoun that is not in the list (for example `طبيبي`) is refused, and a joined small word in front of a chosen word is accepted without checking that it makes sense.
- Only words the person spelt are accepted as content words. A spelling mistake is not corrected (there is no Arabic dictionary yet, so the word suggestion screen is skipped for Arabic).
- Letters nobody has confirmed yet are written as `⟨id⟩` and such a word is never sent to the server (`docs/KNOWN_ISSUES.md` #16).
