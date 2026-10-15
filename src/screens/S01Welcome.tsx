import { Asset, Chip, Screen, TopBar, CamChip, pressable } from '../ui/parts';
import { useNav } from '../nav';

export default function S01Welcome() {
  const nav = useNav();
  return (
    <Screen name="01 Welcome">
      <TopBar>
        <Chip kind="green">Camera on</Chip>
        <Chip kind="gray" onClick={nav.help}>Both hands up: Help</Chip>
      </TopBar>
      <div className="content-stretch flex flex-[1_0_0] gap-[72px] items-center min-h-px px-[96px] py-[40px] relative w-full" data-name="Body">
        <div className="content-stretch flex flex-[1_0_0] flex-col items-start min-w-px relative" data-name="Intro">
          <div className="bg-[#ccfbf1] content-stretch flex items-start px-[14px] py-[6px] relative rounded-[999px] shrink-0">
            <p className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[18px] not-italic relative shrink-0 text-[#115e59] text-[14px] whitespace-nowrap">
              Gesture-controlled. No keyboard or mouse.
            </p>
          </div>
          <div className="h-[20px] relative shrink-0 w-px" />
          <div className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[0] not-italic relative shrink-0 text-[#0f172a] text-[60px] whitespace-nowrap">
            <p className="leading-[68px] mb-0">Sign it.</p>
            <p className="leading-[68px]">See it written.</p>
          </div>
          <div className="h-[16px] relative shrink-0 w-px" />
          <p className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[32px] min-w-full not-italic relative shrink-0 text-[#475569] text-[22px] w-[min-content]">
            Spell with your hands or show a picture card. SignScribe writes your message for the person in front of you.
          </p>
          <div className="h-[32px] relative shrink-0 w-px" />
          <div className="bg-[#f0fdfa] border-2 border-[#ccfbf1] border-solid content-stretch flex gap-[24px] items-center px-[28px] py-[24px] relative rounded-[20px] shrink-0 w-full" data-name="Wake instruction" {...pressable(nav.next)}>
            <Asset id="2:30" className="h-[75px] relative shrink-0 w-[58px]" />
            <div className="[word-break:break-word] content-stretch flex flex-[1_0_0] flex-col gap-[6px] items-start min-w-px not-italic relative">
              <p className="font-['Inter:Bold'] font-bold leading-[34px] relative shrink-0 text-[#0f172a] text-[26px] whitespace-nowrap">
                Raise your open hand to start
              </p>
              <p className="font-['Inter:Regular'] font-normal leading-[23px] min-w-full relative shrink-0 text-[#475569] text-[18px] w-[min-content]">
                Hold it up for 2 seconds. Nothing to click or type.
              </p>
            </div>
          </div>
          <div className="h-[20px] relative shrink-0 w-px" />
          <div className="content-stretch flex gap-[10px] items-center relative shrink-0" data-name="Privacy note">
            <Asset id="2:65" className="relative shrink-0 size-[22px]" />
            <p className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[21px] not-italic relative shrink-0 text-[#475569] text-[16px] whitespace-nowrap">
              Video is processed on this device. Nothing is recorded.
            </p>
          </div>
        </div>
        <div className="bg-[#1e293b] content-stretch flex flex-col h-[560px] items-start overflow-clip relative rounded-[20px] shrink-0 w-[600px]" data-name="Camera view (wake)">
          <Asset id="2:70" className="absolute h-[560px] left-0 top-0 w-[600px]" />
          <CamChip />
          <div className="absolute content-stretch flex flex-col items-center justify-center left-[150px] size-[300px] top-[150px]" data-name="hold ring">
            <Asset id="2:77" className="absolute left-0 size-[300px] top-0" />
          </div>
          <Asset id="2:82" className="absolute h-[247px] left-[205px] top-[205px] w-[190px]" />
          <div className="absolute bg-[rgba(11,18,32,0.8)] content-stretch flex items-start left-[170px] px-[18px] py-[10px] rounded-[12px] top-[490px]" data-name="live caption">
            <p className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[22px] not-italic relative shrink-0 text-[17px] text-white whitespace-nowrap">
              Hand detected. Keep holding…
            </p>
          </div>
        </div>
      </div>
    </Screen>
  );
}
