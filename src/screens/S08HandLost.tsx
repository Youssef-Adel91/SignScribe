import { Asset, CamLabel, Card, CommandZone, InfoRow } from '../ui/parts';
import { BuilderFrame } from '../ui/builder';
import { useNav } from '../nav';

export default function S08HandLost() {
  const nav = useNav();
  return (
    <BuilderFrame
      name="08 Hand lost"
      chipKind="amber"
      chipText="No hand: paused"
      hints={[['3:1166', 'Space'], ['3:1198', 'Delete'], ['3:1230', 'Done', () => nav.go(9)], ['3:1262', 'Cancel', nav.back]]}
      cam={
        <>
          <CommandZone cls="opacity-70" />
          <div className="absolute bg-[rgba(11,18,32,0.55)] h-[600px] left-0 top-0 w-[800px]" />
          <Asset id="3:1100" className="absolute h-[221px] left-[415px] top-[330px] w-[170px]" />
          <div className="absolute bg-[#fef3c7] border-3 border-[#f59e0b] border-solid content-stretch flex flex-col gap-[10px] items-center left-[230px] px-[28px] py-[26px] rounded-[20px] top-[90px] w-[520px]">
            <Asset id="3:1131" className="relative shrink-0 size-[42px]" />
            <div className="content-stretch flex flex-col gap-[10px] items-center relative shrink-0 w-full">
              <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[39px] not-italic relative shrink-0 text-[#0f172a] text-[30px] whitespace-nowrap">We lost your hand</p>
              <p className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[25px] min-w-full not-italic relative shrink-0 text-[#92400e] text-[19px] text-center w-[min-content]">Bring it back into the frame. Your message is safe.</p>
            </div>
          </div>
          <CamLabel cls="bg-[rgba(11,18,32,0.82)] left-[410px] top-[540px]">Put your hand here</CamLabel>
        </>
      }
      side={
        <>
          <Card title="YOUR MESSAGE">
            <div className="content-stretch flex gap-[14px] h-[150px] items-center relative shrink-0 w-full">
              <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[78px] not-italic relative shrink-0 text-[#0f172a] text-[60px] tracking-[6px] whitespace-nowrap">HEL</p>
              <div className="bg-[#fef3c7] content-stretch flex items-center px-[12px] py-[5px] relative rounded-[8px] shrink-0">
                <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[20px] not-italic relative shrink-0 text-[#92400e] text-[15px] whitespace-nowrap">Paused</p>
              </div>
            </div>
          </Card>
          <Card title="WHAT HAPPENS NOW">
            <InfoRow icon="3:1149">Nothing is deleted. Spelling is paused.</InfoRow>
            <InfoRow icon="3:1154">The ring restarts when your hand is back.</InfoRow>
            <InfoRow icon="3:1160">Also spoken: "I can't see your hand."</InfoRow>
          </Card>
        </>
      }
    />
  );
}
