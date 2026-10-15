import { Asset, CamLabel, Card, CommandZone, Hint, SigningArea } from '../ui/parts';
import { BuilderFrame } from '../ui/builder';
import { useNav } from '../nav';
import { useSession } from '../session';

export default function S09WordSuggestion() {
  const nav = useNav();
  const { place } = useSession();
  return (
    <BuilderFrame
      name="09 Word suggestion"
      chipKind="green"
      chipText="Hand detected"
      hints={[['3:1562', 'Yes', nav.next, true], ['3:1594', 'No, keep my word', nav.back], ['3:1626', 'Delete letters', nav.back]]}
      cam={
        <>
          <CommandZone cls="opacity-95" highlightDone />
          <SigningArea />
          <div className="absolute left-[182px] size-[96px] top-[300px]">
            <Asset id="3:1474" className="absolute inset-0" />
            <div className="absolute content-stretch flex inset-0 items-center justify-center">
              <Asset id="3:1478" className="relative shrink-0 size-[38px]" />
            </div>
          </div>
          <CamLabel cls="bg-[rgba(11,18,32,0.82)] left-[250px] top-[490px]">Thumbs up in the command zone = Yes</CamLabel>
        </>
      }
      side={
        <>
          <Card title="YOUR WORD">
            <div className="content-stretch flex h-[100px] items-center relative shrink-0 w-full">
              <div className="content-stretch flex flex-col gap-[2px] items-start relative shrink-0">
                <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[78px] not-italic relative shrink-0 text-[#dc2626] text-[60px] tracking-[6px] whitespace-nowrap">HELO</p>
                <div className="bg-[#dc2626] h-[6px] relative shrink-0 w-[190px]" />
              </div>
            </div>
          </Card>
          <div className="bg-[#f0fdfa] border-3 border-[#0f766e] border-solid content-stretch flex flex-col gap-[12px] items-start pb-[24px] pt-[22px] px-[24px] relative rounded-[16px] shrink-0 w-full">
            <div className="content-stretch flex gap-[8px] items-center relative shrink-0">
              <Asset id="3:1490" className="relative shrink-0 size-[22px]" />
              <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[17px] not-italic relative shrink-0 text-[#115e59] text-[14px] tracking-[0.8px] whitespace-nowrap">DID YOU MEAN</p>
            </div>
            <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[78px] not-italic relative shrink-0 text-[#115e59] text-[60px] tracking-[6px] whitespace-nowrap">HELLO</p>
            <p className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[22px] min-w-full not-italic relative shrink-0 text-[#334155] text-[17px] w-[min-content]">"HELO" is not in the {place} word list. "HELLO" is the closest match.</p>
            <div className="content-stretch flex gap-[12px] items-center relative shrink-0">
              <Hint icon="3:1497" label="Yes, use HELLO" active onClick={nav.next} />
              <Hint icon="3:1529" label="No, keep HELO" onClick={nav.back} />
            </div>
          </div>
        </>
      }
    />
  );
}
