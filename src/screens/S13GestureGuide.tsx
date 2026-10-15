import type { ReactNode } from 'react';
import { Asset, Chip, Hint, HintBar, Screen, TopBar } from '../ui/parts';
import { useNav } from '../nav';

type G = { title: string; desc: string; pill: string; hands: string[]; };
const GESTURES: G[] = [
  { title: 'Space', desc: 'Open palm in the command zone. Hold 0.5 s.', pill: 'Starts a new word', hands: ['3:2505'] },
  { title: 'Delete', desc: 'Fist in the command zone. Removes the last letter.', pill: 'Undo is offered', hands: ['3:2542'] },
  { title: 'Yes / Done', desc: 'Thumbs up. Confirms a suggestion or finishes.', pill: 'Same on every screen', hands: ['3:2579'] },
  { title: 'No / Cancel', desc: 'Thumbs down. Rejects a suggestion or goes back.', pill: 'Same on every screen', hands: ['3:2617'] },
  { title: 'Choose', desc: 'Point at a button and hold until the ring fills.', pill: 'Menus and options', hands: ['3:2654'] },
  { title: 'Help', desc: 'Raise both open hands to open this guide.', pill: 'Works on any screen', hands: ['3:2691', '3:2721'] },
];

function GCard({ g }: { g: G }) {
  const two = g.hands.length === 2;
  const art: ReactNode = two ? (
    <div className="content-stretch flex gap-[0px] items-center justify-center relative shrink-0">
      {g.hands.map((h) => <Asset key={h} id={h} className="h-[91px] relative shrink-0 w-[70px]" />)}
    </div>
  ) : (
    <Asset id={g.hands[0]} className="h-[125px] relative shrink-0 w-[96px]" />
  );
  return (
    <div className="bg-white border-2 border-[#e2e8f0] border-solid content-stretch flex flex-[1_0_0] gap-[26px] h-[210px] items-center min-w-px px-[28px] py-[20px] relative rounded-[20px]">
      <div className="content-stretch flex h-[150px] items-center justify-center relative rounded-[16px] shrink-0 w-[110px]">{art}</div>
      <div className="content-stretch flex flex-[1_0_0] flex-col gap-[8px] items-start min-w-px relative">
        <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[36px] not-italic relative shrink-0 text-[#0f172a] text-[28px] whitespace-nowrap">{g.title}</p>
        <p className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[24px] min-w-full not-italic relative shrink-0 text-[#334155] text-[18px] w-[min-content]">{g.desc}</p>
        <div className="bg-[#ccfbf1] content-stretch flex items-center px-[12px] py-[5px] relative rounded-[999px] shrink-0">
          <p className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[18px] not-italic relative shrink-0 text-[#115e59] text-[14px] whitespace-nowrap">{g.pill}</p>
        </div>
      </div>
    </div>
  );
}

export default function S13GestureGuide() {
  const nav = useNav();
  return (
    <Screen name="13 Gesture guide">
      <TopBar>
        <Chip kind="gray">Help open</Chip>
        <Chip kind="gray" onClick={nav.help}>Both hands up: Help</Chip>
      </TopBar>
      <div className="content-stretch flex flex-[1_0_0] flex-col gap-[12px] items-start justify-center min-h-px px-[60px] py-[28px] relative w-full" data-name="Body">
        <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[52px] not-italic relative shrink-0 text-[#0f172a] text-[40px] whitespace-nowrap">Gesture guide</p>
        <p className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[25px] not-italic relative shrink-0 text-[#475569] text-[19px] whitespace-nowrap">Show these hand shapes in the command zone, or point and hold on a button. The same gesture always means the same thing.</p>
        <div className="h-[10px] relative shrink-0 w-px" />
        <div className="content-stretch flex flex-col gap-[20px] items-start relative shrink-0 w-full">
          <div className="content-stretch flex gap-[20px] items-start relative shrink-0 w-full">
            {GESTURES.slice(0, 3).map((g) => <GCard key={g.title} g={g} />)}
          </div>
          <div className="content-stretch flex gap-[20px] items-start relative shrink-0 w-full">
            {GESTURES.slice(3).map((g) => <GCard key={g.title} g={g} />)}
          </div>
        </div>
      </div>
      <HintBar>
        <Hint icon="3:2758" label="Close help" active onClick={nav.help} />
        <Hint icon="3:2790" label="Point and hold: choose" />
      </HintBar>
    </Screen>
  );
}
