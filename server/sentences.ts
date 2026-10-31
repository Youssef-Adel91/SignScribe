import { offlineSentence } from '../src/nlp/sentence.ts';
import type { Place } from '../src/nlp/words.ts';
import type { SuggestOk, SuggestRequest } from '../src/nlp/protocol.ts';
import { validateSentence } from '../src/nlp/validate.ts';
import type { SentenceProvider } from './llm.ts';

export interface ServiceOptions {
  provider: SentenceProvider | null;
  timeoutMs: number;
  log?: (line: string) => void;
}

/**
 * Asks the provider for a sentence, checks it with the safety rule, and falls back to the offline rules
 * whenever the provider is missing, slow, fails or breaks the rule. The answer always says which it was.
 */
export class SentenceService {
  private readonly provider: SentenceProvider | null;
  private readonly timeoutMs: number;
  private readonly log: (line: string) => void;
  constructor(o: ServiceOptions) {
    this.provider = o.provider;
    this.timeoutMs = o.timeoutMs;
    this.log = o.log ?? (() => {});
  }

  async suggest(req: SuggestRequest): Promise<SuggestOk> {
    const words = req.words.map((w) => w.toUpperCase());
    // ArSL: the English-only checks are skipped, the limits stay (validate.ts, docs/KNOWN_ISSUES.md)
    const arabic = req.alphabet === 'arsl';
    const offline = (note: string): SuggestOk => {
      const sentence = offlineSentence(
        words,
        req.place as Place,
        req.attempt,
        arabic ? 'arabic' : 'english',
      );
      return { id: req.id, ok: true, type: 'suggest', sentence, source: 'offline', note };
    };
    if (!this.provider) return offline('no language model configured');
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.timeoutMs);
    try {
      const proposed = await this.provider.propose(req, ctl.signal);
      const v = validateSentence(words, proposed, arabic ? 'arabic' : 'english');
      if (!v.ok) {
        // log the kind of problem only, never the words of the person (reasons can name a word)
        this.log(`rejected ${this.provider.id} answer: ${v.reason.split(':')[0]}`);
        return offline(`language model answer rejected (${v.reason})`);
      }
      if (req.avoid?.some((a) => a.trim().toLowerCase() === proposed.trim().toLowerCase()))
        return offline('language model repeated a sentence');
      return { id: req.id, ok: true, type: 'suggest', sentence: proposed.trim(), source: 'llm' };
    } catch (e) {
      const why = ctl.signal.aborted ? 'language model too slow' : 'language model unavailable';
      this.log(`${why}: ${e instanceof Error ? e.message : String(e)}`);
      return offline(why);
    } finally {
      clearTimeout(timer);
    }
  }
}
