import { Asset, CamLabel, Card, CommandZone } from '../ui/parts';
import { BuilderFrame } from '../ui/builder';
import { useNav } from '../nav';
import { useSession } from '../session';

const CARDS: [string, string][] = [
  ['Doctor', '3:1904'],
  ['Pain', '3:1908'],
  ['Medicine', '3:1912'],
  ['Water', '3:1918'],
  ['Help', '3:1922'],
  ['Thank you', '3:1927'],
];

export default function S10PictureCard() {
  const nav = useNav();
  const { place } = useSession();
  const cell = (i: number) => {
    const [label, icon] = CARDS[i];
    const on = i === 0;
    return (
      <div key={label} className={`${on ? 'bg-[#ccfbf1] border-3 border-[#0f766e] border-solid' : 'bg-[#f1f5f9]'} content-stretch flex flex-[1_0_0] flex-col gap-[6px] h-[112px] items-center justify-center min-w-px relative rounded-[14px]`}>
        <Asset id={icon} className="relative shrink-0 size-[32px]" />
        <p className={`[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[22px] not-italic relative shrink-0 ${on ? 'text-[#115e59]' : 'text-[#334155]'} text-[17px] whitespace-nowrap`}>{label}</p>
      </div>
    );
  };
  return (
    <BuilderFrame
      name="10 Picture card"
      chipKind="green"
      chipText="Card detected"
      extraChip="Mode: Picture cards"
      hints={[['3:1932', 'Hold a card: add', undefined, true], ['3:1964', 'Done', nav.next], ['3:1996', 'Cancel', nav.back]]}
      cam={
        <>
          <CommandZone cls="opacity-70" />
          <div className="absolute bg-white content-stretch flex flex-col gap-[8px] h-[250px] items-center justify-center left-[380px] rounded-[16px] top-[170px] w-[190px]">
            <Asset id="3:1841" className="relative shrink-0 size-[84px]" />
            <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[34px] not-italic relative shrink-0 text-[#0f172a] text-[26px] whitespace-nowrap">Doctor</p>
          </div>
          <Asset id="3:1844" className="absolute h-[156px] left-[412px] top-[330px] w-[120px]" />
          <div className="absolute border-3 border-[#16a34a] border-dashed h-[274px] left-[368px] rounded-[10px] top-[158px] w-[214px]" />
          <div className="absolute bg-[#15803d] content-stretch flex items-center left-[368px] px-[10px] py-[4px] rounded-[6px] top-[130px]">
            <p className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[18px] not-italic relative shrink-0 text-[14px] text-white whitespace-nowrap">Doctor card · 94%</p>
          </div>
          <div className="absolute bg-[rgba(11,18,32,0.8)] content-stretch flex items-center left-[500px] px-[10px] py-[4px] rounded-[6px] top-[440px]">
            <p className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[16px] not-italic relative shrink-0 text-[13px] text-white whitespace-nowrap">Tracking #1</p>
          </div>
          <div className="absolute left-[600px] size-[100px] top-[150px]">
            <Asset id="3:1880" className="absolute inset-0" />
            <div className="absolute content-stretch flex inset-0 items-center justify-center">
              <Asset id="3:1884" className="relative shrink-0 size-[40px]" />
            </div>
          </div>
          <CamLabel cls="bg-[rgba(11,18,32,0.82)] left-[250px] top-[520px]">Hold the card still to add "doctor"</CamLabel>
        </>
      }
      side={
        <>
          <Card title="YOUR MESSAGE">
            <div className="content-stretch flex gap-[12px] h-[100px] items-center relative shrink-0 w-full">
              <div className="bg-[#ccfbf1] content-stretch flex gap-[8px] items-center px-[18px] py-[10px] relative rounded-[12px] shrink-0">
                <Asset id="3:1893" className="relative shrink-0 size-[20px]" />
                <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[34px] not-italic relative shrink-0 text-[#115e59] text-[26px] whitespace-nowrap">I need</p>
              </div>
              <div className="bg-[#fef3c7] border-2 border-[#f59e0b] border-dashed content-stretch flex items-center px-[18px] py-[10px] relative rounded-[12px] shrink-0">
                <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[34px] not-italic relative shrink-0 text-[#92400e] text-[26px] whitespace-nowrap">doctor</p>
              </div>
            </div>
          </Card>
          <Card title={`${place.toUpperCase()} CARDS`} >
            <div className="content-stretch flex flex-col gap-[12px] items-start relative shrink-0 w-full">
              <div className="content-stretch flex gap-[12px] items-start relative shrink-0 w-full">{cell(0)}{cell(1)}{cell(2)}</div>
              <div className="content-stretch flex gap-[12px] items-start relative shrink-0 w-full">{cell(3)}{cell(4)}{cell(5)}</div>
            </div>
          </Card>
        </>
      }
    />
  );
}
