import { createContext, useContext, useState, type ReactNode } from 'react';

export type Hand = 'left' | 'right';
export type Alphabet = 'arabic' | 'english' | 'more' | null;
export type Place = 'Clinic' | 'Shop' | 'Work' | 'Home';
export type Method = 'spell' | 'card';

type Session = {
  hand: Hand; setHand: (h: Hand) => void;
  alphabet: Alphabet; setAlphabet: (a: Alphabet) => void;
  place: Place; setPlace: (p: Place) => void;
  method: Method; setMethod: (m: Method) => void;
};
const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [hand, setHand] = useState<Hand>('right');
  const [alphabet, setAlphabet] = useState<Alphabet>(null);
  const [place, setPlace] = useState<Place>('Clinic');
  const [method, setMethod] = useState<Method>('spell');
  return <Ctx.Provider value={{ hand, setHand, alphabet, setAlphabet, place, setPlace, method, setMethod }}>{children}</Ctx.Provider>;
}
export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error('SessionProvider missing');
  return v;
}
