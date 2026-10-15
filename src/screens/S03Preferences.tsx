import { Asset, Chip, Hint, HintBar, Screen, TopBar, pressable } from '../ui/parts';
import { useNav } from '../nav';
import { useSession, type Alphabet } from '../session';

function HandTile({ side, selected, onPick }: { side: 'left' | 'right'; selected: boolean; onPick: () => void }) {
  const box = selected ? 'bg-[#f0fdfa] border-4 border-[#0f766e]' : 'bg-white border-2 border-[#cbd5e1]';
  const icon = side === 'left' ? (selected ? 'x:left-teal' : '2:319') : selected ? '2:351' : 'x:right-gray';
  return (
    <div className={`${box} border-solid content-stretch flex flex-col gap-[14px] h-[300px] items-center justify-center py-[18px] relative rounded-[20px] shrink-0 w-[380px]`} {...pressable(onPick)}>
      <Asset id={icon} className="h-[130px] relative shrink-0 w-[100px]" />
      <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[36px] not-italic relative shrink-0 text-[#0f172a] text-[28px] whitespace-nowrap">
        {side === 'left' ? 'Left hand' : 'Right hand'}
      </p>
      {selected && (
        <div className="absolute bg-[#0f766e] content-stretch flex items-center justify-center left-[326px] rounded-[18px] size-[36px] top-[10px]">
          <Asset id="2:383" className="relative shrink-0 size-[22px]" />
        </div>
      )}
    </div>
  );
}

function AlphaTile({ title, sub, selected, onPick }: { title: string; sub: string; selected: boolean; onPick: () => void }) {
  const box = selected ? 'bg-[#f0fdfa] border-4 border-[#0f766e]' : 'bg-white border-2 border-[#cbd5e1]';
  return (
    <div className={`${box} border-solid content-stretch flex flex-col gap-[4px] h-[120px] items-center justify-center relative rounded-[20px] shrink-0 w-[240px]`} {...pressable(onPick)}>
      <p className="font-['Inter:Bold'] font-bold leading-[34px] relative shrink-0 text-[#0f172a] text-[26px]">{title}</p>
      <p className="font-['Inter:Medium'] font-medium leading-[20px] relative shrink-0 text-[#475569] text-[15px]">{sub}</p>
    </div>
  );
}

export default function S03Preferences() {
  const nav = useNav();
  const { hand, setHand, alphabet, setAlphabet } = useSession();
  const alpha = (a: Alphabet) => () => setAlphabet(alphabet === a ? null : a);
  return (
    <Screen name="03 Preferences">
      <TopBar steps={['active', 'todo', 'todo', 'todo']}>
        <Chip kind="green">Camera on</Chip>
        <Chip kind="green">Hand detected</Chip>
        <Chip kind="gray" onClick={nav.help}>Both hands up: Help</Chip>
      </TopBar>
      <div className="content-stretch flex flex-[1_0_0] items-center justify-center min-h-px px-[96px] py-[32px] relative w-full" data-name="Body">
        <div className="content-stretch flex flex-[1_0_0] flex-col gap-[12px] items-center min-w-px relative">
          <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[52px] not-italic relative shrink-0 text-[#0f172a] text-[40px] text-center whitespace-nowrap">Two quick choices</p>
          <p className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[25px] not-italic relative shrink-0 text-[#475569] text-[19px] text-center whitespace-nowrap">
            Point at a choice and hold still. The ring shows when it is chosen.
          </p>
          <div className="h-[18px] relative shrink-0 w-px" />
          <p className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[29px] not-italic relative shrink-0 text-[#0f172a] text-[22px] whitespace-nowrap">Which hand do you sign with?</p>
          <div className="content-stretch flex gap-[28px] items-start relative shrink-0">
            <HandTile side="left" selected={hand === 'left'} onPick={() => setHand('left')} />
            <HandTile side="right" selected={hand === 'right'} onPick={() => setHand('right')} />
          </div>
          <div className="h-[18px] relative shrink-0 w-px" />
          <p className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[29px] not-italic relative shrink-0 text-[#0f172a] text-[22px] whitespace-nowrap">Which sign alphabet?</p>
          <div className="[word-break:break-word] content-stretch flex gap-[20px] items-start not-italic relative shrink-0 whitespace-nowrap">
            <AlphaTile title="Arabic" sub="ArSL letters" selected={alphabet === 'arabic'} onPick={alpha('arabic')} />
            <AlphaTile title="English" sub="Fingerspelling" selected={alphabet === 'english'} onPick={alpha('english')} />
            <AlphaTile title="More…" sub="Other alphabets" selected={alphabet === 'more'} onPick={alpha('more')} />
          </div>
        </div>
      </div>
      <HintBar>
        <Hint icon="2:399" label="Point and hold: choose" active />
        <Hint icon="2:431" label="Continue" onClick={nav.next} />
        <Hint icon="2:463" label="Back" onClick={nav.back} />
      </HintBar>
    </Screen>
  );
}
