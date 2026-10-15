import { Asset, Chip, Hint, HintBar, Screen, TopBar, pressable } from '../ui/parts';
import { useNav } from '../nav';
import { useSession, type Place } from '../session';

const PLACES: { key: Place; sub: string; white: string; teal: string }[] = [
  { key: 'Clinic', sub: 'doctor · pain · medicine', white: '2:543', teal: 'x:cross-teal' },
  { key: 'Shop', sub: 'price · size · pay', white: 'x:bag-white', teal: '2:549' },
  { key: 'Work', sub: 'meeting · help · thanks', white: 'x:brief-white', teal: '2:556' },
  { key: 'Home', sub: 'family · food · water', white: 'x:home-white', teal: '2:563' },
];

export default function S04Context() {
  const nav = useNav();
  const { place, setPlace } = useSession();
  const sel = PLACES.findIndex((p) => p.key === place);
  return (
    <Screen name="04 Context">
      <TopBar steps={['active', 'todo', 'todo', 'todo']}>
        <Chip kind="green">Camera on</Chip>
        <Chip kind="green">Hand detected</Chip>
        <Chip kind="gray" onClick={nav.help}>Both hands up: Help</Chip>
      </TopBar>
      <div className="content-stretch flex flex-[1_0_0] items-center justify-center min-h-px px-[60px] py-[32px] relative w-full" data-name="Body">
        <div className="content-stretch flex flex-[1_0_0] flex-col gap-[14px] items-center min-w-px relative">
          <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[52px] not-italic relative shrink-0 text-[#0f172a] text-[40px] text-center whitespace-nowrap">Where are you today?</p>
          <p className="[word-break:break-word] font-['Inter:Regular'] font-normal leading-[25px] not-italic relative shrink-0 text-[#475569] text-[19px] text-center whitespace-nowrap">
            SignScribe prepares words, picture cards and sentence styles for this place.
          </p>
          <div className="h-[22px] relative shrink-0 w-px" />
          <div className="content-stretch flex flex-col h-[320px] items-start relative shrink-0 w-[1260px]" data-name="Context options">
            <div className="content-stretch flex flex-[1_0_0] gap-[24px] items-center justify-center min-h-px relative w-full">
              {PLACES.map((p) => {
                const on = p.key === place;
                return (
                  <div key={p.key} className={`${on ? 'bg-[#f0fdfa] border-4 border-[#0f766e]' : 'bg-white border-2 border-[#cbd5e1]'} border-solid content-stretch flex flex-col gap-[10px] items-center justify-center px-[16px] relative rounded-[20px] shrink-0 size-[300px]`} {...pressable(() => setPlace(p.key))}>
                    <div className={`${on ? 'bg-[#0f766e]' : 'bg-[#f1f5f9]'} content-stretch flex items-center justify-center relative rounded-[42px] shrink-0 size-[84px]`}>
                      <Asset id={on ? p.white : p.teal} className="relative shrink-0 size-[44px]" />
                    </div>
                    <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[39px] not-italic relative shrink-0 text-[#0f172a] text-[30px] whitespace-nowrap">{p.key}</p>
                    <p className="[word-break:break-word] font-['Inter:Medium'] font-medium leading-[21px] min-w-full not-italic relative shrink-0 text-[#475569] text-[16px] text-center w-[min-content]">{p.sub}</p>
                  </div>
                );
              })}
            </div>
            <div className="absolute content-stretch flex flex-col items-center justify-center size-[76px] top-[190px]" style={{ left: 150 + sel * 324 }} data-name="hand pointer">
              <Asset id="2:569" className="absolute left-0 size-[76px] top-0" />
              <div className="bg-[#2563eb] border-3 border-solid border-white relative rounded-[11px] shrink-0 size-[22px]" />
            </div>
          </div>
        </div>
      </div>
      <HintBar>
        <Hint icon="2:576" label="Point and hold: choose" active />
        <Hint icon="2:608" label="Yes" onClick={nav.next} />
        <Hint icon="2:640" label="Back" onClick={nav.back} />
      </HintBar>
    </Screen>
  );
}
