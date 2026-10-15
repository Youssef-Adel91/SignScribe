import { Asset, Chip, Hint, HintBar, Screen, TopBar, CamChip } from '../ui/parts';
import { useNav } from '../nav';

function Check({ tone, icon, tail, title, text }: { tone: 'ok' | 'warn'; icon: string; tail: string; title: string; text: string }) {
  const box = tone === 'ok' ? 'bg-[#dcfce7] border-[#16a34a]' : 'bg-[#fef3c7] border-[#f59e0b]';
  const sub = tone === 'ok' ? 'text-[#166534]' : 'text-[#92400e]';
  return (
    <div className={`${box} border-2 border-solid content-stretch flex gap-[16px] items-center px-[20px] py-[18px] relative rounded-[16px] shrink-0 w-full`}>
      <div className="bg-white content-stretch flex items-center justify-center relative rounded-[24px] shrink-0 size-[48px]">
        <Asset id={icon} className="relative shrink-0 size-[26px]" />
      </div>
      <div className="[word-break:break-word] content-stretch flex flex-[1_0_0] flex-col gap-[2px] items-start min-w-px not-italic relative">
        <p className="font-['Inter:Bold'] font-bold leading-[26px] relative shrink-0 text-[#0f172a] text-[20px] whitespace-nowrap">{title}</p>
        <p className={`font-['Inter:Medium'] font-medium leading-[21px] min-w-full relative shrink-0 ${sub} text-[16px] w-[min-content]`}>{text}</p>
      </div>
      <Asset id={tail} className="relative shrink-0 size-[28px]" />
    </div>
  );
}

export default function S02CameraCheck() {
  const nav = useNav();
  return (
    <Screen name="02 Camera check">
      <TopBar steps={['active', 'todo', 'todo', 'todo']}>
        <Chip kind="green">Camera on</Chip>
        <Chip kind="green">Hand detected</Chip>
        <Chip kind="gray" onClick={nav.help}>Both hands up: Help</Chip>
      </TopBar>
      <div className="content-stretch flex flex-[1_0_0] gap-[40px] items-start min-h-px px-[48px] py-[32px] relative w-full" data-name="Body">
        <div className="bg-[#1e293b] content-stretch flex flex-col h-[600px] items-start overflow-clip relative rounded-[20px] shrink-0 w-[800px]" data-name="Camera view (setup)">
          <Asset id="2:156" className="absolute h-[600px] left-0 top-0 w-[800px]" />
          <CamChip />
          <div className="absolute border-3 border-dashed border-white h-[470px] left-[140px] opacity-60 rounded-[20px] top-[70px] w-[520px]" data-name="hand guide frame" />
          <Asset id="2:163" className="absolute h-[299px] left-[285px] top-[200px] w-[230px]" />
          <div className="absolute bg-[rgba(11,18,32,0.8)] content-stretch flex items-start left-[205px] px-[18px] py-[10px] rounded-[12px] top-[552px]">
            <p className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[22px] not-italic relative shrink-0 text-[17px] text-white whitespace-nowrap">
              Keep your hands inside the dashed frame
            </p>
          </div>
        </div>
        <div className="content-stretch flex flex-[1_0_0] flex-col gap-[14px] items-start min-w-px relative">
          <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[47px] not-italic relative shrink-0 text-[#0f172a] text-[36px] whitespace-nowrap">
            Checking your setup
          </p>
          <p className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[25px] min-w-full not-italic relative shrink-0 text-[#475569] text-[19px] w-[min-content]">
            Stay as you are. We continue automatically when everything is green.
          </p>
          <div className="h-[10px] relative shrink-0 w-px" />
          <div className="content-stretch flex flex-col gap-[12px] items-start relative shrink-0 w-full">
            <Check tone="ok" icon="2:202" tail="2:208" title="Light" text="Good light on your hands" />
            <Check tone="warn" icon="2:212" tail="2:217" title="Distance" text="A bit far. Move a little closer." />
            <Check tone="ok" icon="2:222" tail="2:230" title="Hand visible" text="Your whole hand is in view" />
          </div>
          <div className="h-[6px] relative shrink-0 w-px" />
          <div className="bg-[#dbeafe] content-stretch flex gap-[10px] items-center px-[16px] py-[14px] relative rounded-[12px] shrink-0 w-full" data-name="Spoken tip">
            <Asset id="2:234" className="relative shrink-0 size-[24px]" />
            <p className="[word-break:break-word] flex-[1_0_0] font-['Inter:Semi_Bold'] font-semibold leading-[22px] min-w-px not-italic relative text-[#1e3a8a] text-[17px]">{`Spoken tip: "Move a little closer."`}</p>
          </div>
        </div>
      </div>
      <HintBar>
        <Hint icon="2:240" label="Hold still while we check" active onClick={nav.next} />
      </HintBar>
    </Screen>
  );
}
