import { Asset, Chip, Hint, HintBar, Screen, TopBar } from '../ui/parts';
import { useNav } from '../nav';

export default function S12Share() {
  const nav = useNav();
  return (
    <Screen name="12 Share">
      <TopBar steps={['done', 'done', 'done', 'active']}>
        <Chip kind="green">Reading aloud</Chip>
        <Chip kind="green">Hand detected</Chip>
        <Chip kind="gray" onClick={nav.help}>Both hands up: Help</Chip>
      </TopBar>
      <div className="content-stretch flex flex-[1_0_0] items-center justify-center min-h-px px-[80px] py-[40px] relative w-full" data-name="Body">
        <div className="bg-white border-2 border-[#e2e8f0] border-solid content-stretch flex flex-col gap-[24px] items-center justify-center px-[60px] shrink-0 w-full py-[48px] relative rounded-[28px] [filter:drop-shadow(0px_8px_12px_rgba(15,23,42,0.1))]">
          <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[21px] not-italic relative shrink-0 text-[#64748b] text-[16px] tracking-[1.2px] whitespace-nowrap">MESSAGE FOR YOU</p>
          <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[104px] min-w-full not-italic relative shrink-0 text-[#0f172a] text-[92px] text-center w-[min-content]">Hello, I need a doctor.</p>
          <div className="bg-[#dbeafe] content-stretch flex gap-[10px] items-center pl-[18px] pr-[22px] py-[12px] relative rounded-[999px] shrink-0">
            <Asset id="3:2376" className="relative shrink-0 size-[28px]" />
            <p className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[26px] not-italic relative shrink-0 text-[#1e3a8a] text-[20px] whitespace-nowrap">Reading aloud…</p>
          </div>
          <p className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[21px] not-italic relative shrink-0 text-[#64748b] text-[16px] whitespace-nowrap">Written with SignScribe from hand signs and picture cards.</p>
        </div>
      </div>
      <HintBar>
        <Hint icon="3:2383" label="Finish" active onClick={() => nav.go(1)} />
        <Hint icon="3:2415" label="New sentence" onClick={() => nav.go(5)} />
        <Hint icon="3:2447" label="Edit" onClick={() => nav.go(11)} />
      </HintBar>
    </Screen>
  );
}
