import { Asset, CamChip, Card, Chip, Hint, HintBar, InfoRow, Screen, TopBar, pressable } from '../ui/parts';
import { useNav } from '../nav';
import { useSession } from '../session';

export default function S11ReviewSentence() {
  const nav = useNav();
  const { place } = useSession();
  const phrase = (t: string, icon?: string) => (
    <div key={t} className="bg-[#ccfbf1] content-stretch flex gap-[8px] items-center px-[18px] py-[10px] relative rounded-[12px] shrink-0">
      {icon && <Asset id={icon} className="relative shrink-0 size-[20px]" />}
      <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[34px] not-italic relative shrink-0 text-[#115e59] text-[26px] whitespace-nowrap">{t}</p>
    </div>
  );
  return (
    <Screen name="11 Review sentence">
      <TopBar steps={['done', 'done', 'active', 'todo']}>
        <Chip kind="gray">Context: {place}</Chip>
        <Chip kind="green">Hand detected</Chip>
        <Chip kind="gray" onClick={nav.help}>Both hands up: Help</Chip>
      </TopBar>
      <div className="content-stretch flex flex-[1_0_0] gap-[36px] items-start min-h-px px-[48px] py-[36px] relative w-full" data-name="Body">
        <div className="content-stretch flex flex-[1_0_0] flex-col gap-[16px] items-start min-w-px relative">
          <p className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[17px] not-italic relative shrink-0 text-[#64748b] text-[14px] tracking-[0.8px] whitespace-nowrap">YOUR WORDS</p>
          <div className="content-stretch flex gap-[10px] items-center relative shrink-0">
            {phrase('HELLO')}
            {phrase('I')}
            {phrase('NEED')}
            {phrase('DOCTOR', '3:2080')}
          </div>
          <Asset id="3:2084" className="relative shrink-0 size-[30px]" />
          <div className="bg-[#f0fdfa] border-4 border-[#0f766e] border-solid content-stretch flex flex-col gap-[17px] items-start px-[34px] py-[30px] relative rounded-[24px] shrink-0 w-full">
            <div className="content-stretch flex gap-[8px] items-center relative shrink-0">
              <Asset id="3:2088" className="relative shrink-0 size-[22px]" />
              <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[17px] not-italic relative shrink-0 text-[#115e59] text-[14px] tracking-[0.8px] whitespace-nowrap">SUGGESTED SENTENCE</p>
              <div className="bg-[#ccfbf1] content-stretch flex items-center px-[10px] py-[3px] relative rounded-[999px] shrink-0">
                <p className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[18px] not-italic relative shrink-0 text-[#115e59] text-[14px] whitespace-nowrap">{place} style</p>
              </div>
            </div>
            <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[66px] not-italic relative shrink-0 text-[#0f172a] text-[56px] whitespace-nowrap">Hello, I need a doctor.</p>
            <div className="content-stretch flex gap-[10px] items-center relative shrink-0">
              <Asset id="3:2095" className="relative shrink-0 size-[22px]" />
              <p className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[22px] not-italic relative shrink-0 text-[#334155] text-[17px] whitespace-nowrap">Nothing is shown to the other person until you say yes.</p>
            </div>
            <div className="h-[4px] relative shrink-0 w-px" />
            <div className="content-stretch flex gap-[16px] items-center relative shrink-0">
              <div className="bg-[#0f766e] border-2 border-[#0f766e] border-solid content-stretch flex gap-[12px] items-center pl-[16px] pr-[28px] py-[14px] relative rounded-[16px] shrink-0" {...pressable(nav.next)}>
                <Asset id="3:2102" className="h-[60px] relative shrink-0 w-[46px]" />
                <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[31px] not-italic relative shrink-0 text-[24px] text-white whitespace-nowrap">Yes, use it</p>
              </div>
              <div className="bg-white border-2 border-[#94a3b8] border-solid content-stretch flex gap-[12px] items-center pl-[16px] pr-[28px] py-[14px] relative rounded-[16px] shrink-0" {...pressable(() => nav.go(5))}>
                <Asset id="3:2134" className="h-[60px] relative shrink-0 w-[46px]" />
                <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[31px] not-italic relative shrink-0 text-[#0f172a] text-[24px] whitespace-nowrap">Try another</p>
              </div>
            </div>
          </div>
        </div>
        <div className="content-stretch flex flex-col gap-[20px] items-start relative shrink-0 w-[400px]">
          <div className="bg-[#1e293b] h-[300px] overflow-clip relative rounded-[20px] shrink-0 w-full" data-name="Camera view">
            <Asset id="3:2167" className="absolute h-[300px] left-0 top-0 w-[400px]" />
            <CamChip />
            <Asset id="3:2173" className="absolute h-[143px] left-[145px] top-[120px] w-[110px]" />
            <div className="absolute left-[158px] size-[84px] top-[26px]">
              <Asset id="3:2204" className="absolute inset-0" />
              <div className="absolute content-stretch flex inset-0 items-center justify-center">
                <Asset id="3:2208" className="relative shrink-0 size-[34px]" />
              </div>
            </div>
          </div>
          <Card title="HOW TO ANSWER">
            <InfoRow icon="3:2214">Thumbs up: use this sentence.</InfoRow>
            <InfoRow icon="3:2222">Thumbs down: try another wording.</InfoRow>
            <InfoRow icon="3:2227">Need to add more? Show a card or spell a word.</InfoRow>
          </Card>
        </div>
      </div>
      <HintBar>
        <Hint icon="3:2233" label="Use it" active onClick={nav.next} />
        <Hint icon="3:2265" label="Try another" onClick={() => nav.go(5)} />
        <Hint icon="3:2297" label="Delete last word" onClick={nav.back} />
      </HintBar>
    </Screen>
  );
}
