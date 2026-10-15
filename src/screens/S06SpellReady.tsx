import { CamLabel, Card, CommandZone, InfoRow, SigningArea } from '../ui/parts';
import { BuilderFrame } from '../ui/builder';
import { useNav } from '../nav';

export default function S06SpellReady() {
  const nav = useNav();
  return (
    <BuilderFrame
      name="06 Spell ready"
      chipKind="amber"
      chipText="Waiting for a hand"
      hints={[['3:418', 'Space'], ['3:450', 'Delete'], ['3:482', 'Done', nav.next], ['3:514', 'Cancel', nav.back]]}
      cam={
        <>
          <CommandZone cls="opacity-95" />
          <SigningArea />
          <div className="absolute bg-[rgba(11,18,32,0.7)] content-stretch flex items-start left-[224px] px-[14px] py-[8px] rounded-[8px] top-[122px]">
            <p className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[16px] not-italic relative shrink-0 text-[14px] text-white tracking-[0.8px] whitespace-nowrap">SIGNING AREA</p>
          </div>
          <CamLabel cls="bg-[rgba(11,18,32,0.82)] left-[330px] top-[490px]">Show your first letter</CamLabel>
        </>
      }
      side={
        <>
          <Card title="YOUR MESSAGE">
            <div className="content-stretch flex gap-[6px] h-[150px] items-center relative shrink-0 w-full">
              <div className="bg-[#0f766e] h-[56px] relative shrink-0 w-[4px]" />
              <p className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[34px] not-italic relative shrink-0 text-[#64748b] text-[26px] whitespace-nowrap">Your letters will appear here</p>
            </div>
          </Card>
          <Card title="HOW IT WORKS">
            <InfoRow icon="3:399">Sign a letter and hold it still until the ring fills.</InfoRow>
            <InfoRow icon="3:407">Use the command zone for space, delete and done.</InfoRow>
            <InfoRow icon="3:412">Stuck? Raise both hands for help.</InfoRow>
          </Card>
        </>
      }
    />
  );
}
