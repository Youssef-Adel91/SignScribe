import { Asset, Chip, Hint, HintBar, Screen, TopBar, pressable } from '../ui/parts';
import { useNav } from '../nav';
import { useSession } from '../session';

export default function S05Method() {
  const nav = useNav();
  const { method, setMethod, place } = useSession();
  const spell = method === 'spell';
  return (
    <Screen name="05 Method">
      <TopBar steps={['done', 'active', 'todo', 'todo']}>
        <Chip kind="gray">Context: {place}</Chip>
        <Chip kind="green">Hand detected</Chip>
        <Chip kind="gray" onClick={nav.help}>Both hands up: Help</Chip>
      </TopBar>
      <div className="content-stretch flex flex-[1_0_0] items-center justify-center min-h-px px-[60px] py-[32px] relative w-full" data-name="Body">
        <div className="content-stretch flex flex-[1_0_0] flex-col gap-[14px] items-center min-w-px relative">
          <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[52px] not-italic relative shrink-0 text-[#0f172a] text-[40px] text-center whitespace-nowrap">How do you want to build your message?</p>
          <p className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[25px] not-italic relative shrink-0 text-[#475569] text-[19px] text-center whitespace-nowrap">You can switch at any time. Both ways need only your hands and the camera.</p>
          <div className="h-[11px] relative shrink-0 w-px" />
          <div className="content-stretch flex flex-col h-[470px] items-start relative shrink-0 w-[1180px]" data-name="Options">
            <div className="content-stretch flex flex-[1_0_0] gap-[36px] items-center justify-center min-h-px relative w-full">
              <div className={`${spell ? 'bg-[#f0fdfa] border-4 border-[#0f766e]' : 'bg-white border-2 border-[#cbd5e1]'} border-solid content-stretch flex flex-col gap-[14px] h-[470px] items-center justify-start pt-[30px] px-[28px] relative rounded-[24px] shrink-0 w-[560px]`} {...pressable(() => setMethod('spell'))}>
                <div className="content-stretch flex h-[210px] items-center justify-center relative shrink-0 w-full">
                  <Asset id="3:52" className="h-[169px] relative shrink-0 w-[130px]" />
                </div>
                <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[42px] not-italic relative shrink-0 text-[#0f172a] text-[32px] whitespace-nowrap">Spell with signs</p>
                <p className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[25px] min-w-full not-italic relative shrink-0 text-[#475569] text-[19px] text-center w-[min-content]">Sign letters one at a time. Works for any word, including names.</p>
                <div className={`${spell ? 'bg-[#ccfbf1]' : 'bg-[#f1f5f9]'} content-stretch flex items-center mt-[18px] px-[16px] py-[7px] relative rounded-[999px] shrink-0`}>
                  <p className={`[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[20px] not-italic relative shrink-0 ${spell ? 'text-[#115e59]' : 'text-[#475569]'} text-[15px] whitespace-nowrap`}>Best for names and new words</p>
                </div>
              </div>
              <div className={`${!spell ? 'bg-[#f0fdfa] border-4 border-[#0f766e]' : 'bg-white border-2 border-[#cbd5e1]'} border-solid content-stretch flex flex-col gap-[14px] h-[470px] items-center justify-start pt-[30px] px-[28px] relative rounded-[24px] shrink-0 w-[560px]`} {...pressable(() => setMethod('card'))}>
                <div className="content-stretch flex h-[210px] items-center justify-center relative shrink-0 w-full">
                  <div className="h-[236px] relative shrink-0 w-[200px]">
                    <div className="absolute bg-white border-3 border-[#0f766e] border-solid content-stretch flex flex-col items-center justify-center left-[12px] rounded-[16px] top-[10px] h-[216px] w-[176px]">
                      <Asset id="3:91" className="relative shrink-0 size-[72px]" />
                    </div>
                    <div className="absolute border-3 border-[#16a34a] border-dashed h-[232px] left-[0px] rounded-[10px] top-[2px] w-[200px]" />
                    <div className="absolute bg-[#15803d] content-stretch flex items-center left-[0px] px-[10px] py-[4px] rounded-[6px] top-[-12px]">
                      <p className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[16px] not-italic relative shrink-0 text-[13px] text-white whitespace-nowrap">Card 94%</p>
                    </div>
                  </div>
                </div>
                <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[42px] not-italic relative shrink-0 text-[#0f172a] text-[32px] whitespace-nowrap">Show a picture card</p>
                <p className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[25px] min-w-full not-italic relative shrink-0 text-[#475569] text-[19px] text-center w-[min-content]">Hold up a printed card. Fast for common phrases.</p>
                <div className={`${!spell ? 'bg-[#ccfbf1]' : 'bg-[#f1f5f9]'} content-stretch flex items-center mt-[18px] px-[16px] py-[7px] relative rounded-[999px] shrink-0`}>
                  <p className={`[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[20px] not-italic relative shrink-0 ${!spell ? 'text-[#115e59]' : 'text-[#475569]'} text-[15px] whitespace-nowrap`}>Best for common phrases</p>
                </div>
              </div>
            </div>
            <div className="absolute content-stretch flex flex-col items-center justify-center size-[76px] top-[90px]" style={{ left: spell ? 410 : 1006 }} data-name="hand pointer">
              <Asset id="3:102" className="absolute left-0 size-[76px] top-0" />
              <div className="bg-[#2563eb] border-3 border-solid border-white relative rounded-[11px] shrink-0 size-[22px]" />
            </div>
          </div>
        </div>
      </div>
      <HintBar>
        <Hint icon="3:109" label="Point and hold: choose" active />
        <Hint icon="3:141" label="Yes" onClick={nav.next} />
        <Hint icon="3:173" label="Back" onClick={nav.back} />
      </HintBar>
    </Screen>
  );
}
