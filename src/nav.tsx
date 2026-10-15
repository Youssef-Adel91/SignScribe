import { createContext, useContext } from 'react';

export type Nav = {
  /** go to a screen by number (1-13) */
  go: (n: number) => void;
  /** previous screen in the history (what "Back" / thumbs-down does) */
  back: () => void;
  /** next screen in the default flow */
  next: () => void;
  /** open / close the gesture guide (screen 13) */
  help: () => void;
};

export const NavContext = createContext<Nav>({ go() {}, back() {}, next() {}, help() {} });
export const useNav = () => useContext(NavContext);
