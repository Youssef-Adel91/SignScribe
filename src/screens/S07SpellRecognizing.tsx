import { Asset, CamLabel, Card, CommandZone, SigningArea } from '../ui/parts';
import { BuilderFrame } from '../ui/builder';
import { useNav } from '../nav';

export default function S07SpellRecognizing() {
  const nav = useNav();
  const guess = (t: string, p: string, on: boolean) => (
    <div key={t} className={`${on ? 'bg-[#ccfbf1] border-2 border-[#0f766e] border-solid' : 'bg-[#f1f5f9]'} content-stretch flex gap-[10px] items-center px-[18px] py-[12px] relative rounded-[12px] shrink-0`}>
      <p className={`[word-break:break-word] font-['Inter:Bold'] font-bold leading-[30px] not-italic relative shrink-0 ${on ? 'text-[#115e59]' : 'text-[#334155]'} text-[24px] whitespace-nowrap`}>{t}</p>
      <p className={`[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[20px] not-italic relative shrink-0 ${on ? 'text-[#115e59]' : 'text-[#475569]'} text-[16px] whitespace-nowrap`}>{p}</p>
    </div>
  );
  return (
    <BuilderFrame
      name="07 Spell recognizing"
      chipKind="green"
      chipText="Hand detected"
      hints={[['3:793', 'Space'], ['3:825', 'Delete'], ['3:857', 'Done', () => nav.go(9)], ['3:889', 'Cancel', nav.back]]}
      cam={
        <>
          <CommandZone cls="opacity-70" />
          <SigningArea />
          <Asset id="3:725" className="absolute h-[247px] left-[420px] top-[215px] w-[190px]" />
          <div className="absolute left-[452px] size-[128px] top-[70px]">
            <Asset id="3:756" className="absolute inset-0" />
            <div className="absolute content-stretch flex inset-0 items-center justify-center">
              <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[73px] not-italic relative shrink-0 text-[56px] text-white whitespace-nowrap">L</p>
            </div>
          </div>
          <CamLabel cls="bg-[rgba(11,18,32,0.82)] left-[300px] top-[490px]">Looks like "L". Hold still…</CamLabel>
        </>
      }
      side={
        <>
          <Card title="YOUR MESSAGE">
            <div className="content-stretch flex gap-[4px] h-[150px] items-center relative shrink-0 w-full">
              <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[78px] not-italic relative shrink-0 text-[#0f172a] text-[60px] tracking-[6px] whitespace-nowrap">HE</p>
              <div className="content-stretch flex flex-col gap-[2px] items-center relative shrink-0">
                <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[78px] not-italic relative shrink-0 text-[#b45309] text-[60px] tracking-[6px] whitespace-nowrap">L</p>
                <div className="bg-[#b45309] h-[6px] relative shrink-0 w-[40px]" />
              </div>
              <div className="bg-[#0f766e] h-[56px] relative shrink-0 w-[4px]" />
            </div>
          </Card>
          <Card title="NOT RIGHT? OTHER GUESSES">
            <div className="content-stretch flex gap-[10px] items-center relative shrink-0">
              {guess('L', '87%', true)}
              {guess('I', '8%', false)}
              {guess('T', '3%', false)}
            </div>
            <p className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[21px] min-w-full not-italic relative shrink-0 text-[#475569] text-[16px] w-[min-content]">Change your sign slightly and the guess updates.</p>
          </Card>
          <Card title="CONFIRM TIME">
            <div className="content-stretch flex gap-[16px] items-center relative shrink-0 w-full">
              <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[44px] not-italic relative shrink-0 text-[#0f766e] text-[34px] whitespace-nowrap">0.8 s</p>
              <p className="[word-break:break-word] flex-[1_0_0] font-['Inter:Medium'] font-medium leading-[21px] min-w-px not-italic relative text-[#475569] text-[16px]">Adapts to you: shorter when you are accurate, longer after mistakes.</p>
            </div>
          </Card>
        </>
      }
    />
  );
}
