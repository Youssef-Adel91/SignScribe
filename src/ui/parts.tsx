import type { ReactNode } from 'react';
import { assetUrl } from './assets';

/* Every class name below is copied from the Figma export (pixel values = Figma values). */

export function Asset({ id, className }: { id: string; className: string }) {
  return (
    <div className={className} data-node-id={id}>
      <img alt="" className="absolute block inset-0 max-w-none size-full" src={assetUrl(id)} />
    </div>
  );
}

type Press = { onClick?: () => void };
function pressable(onClick?: () => void) {
  if (!onClick) return {};
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
    },
  };
}
export { pressable };

/* ---------- Top bar ---------- */

export function Brand() {
  return (
    <div className="content-stretch flex gap-[10px] items-center relative shrink-0" data-name="Brand">
      <div className="bg-[#0f766e] content-stretch flex items-center justify-center relative rounded-[10px] shrink-0 size-[36px]">
        <Asset id="2:6" className="relative shrink-0 size-[22px]" />
      </div>
      <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[29px] not-italic relative shrink-0 text-[#0f172a] text-[22px] whitespace-nowrap">
        SignScribe
      </p>
    </div>
  );
}

export type ChipKind = 'green' | 'gray' | 'amber';
export function Chip({ kind, children, onClick }: { kind: ChipKind; children: ReactNode } & Press) {
  const box =
    kind === 'green' ? 'bg-[#dcfce7]' : kind === 'amber' ? 'bg-[#fef3c7]' : 'bg-[#f1f5f9]';
  const dot =
    kind === 'green' ? 'bg-[#16a34a]' : kind === 'amber' ? 'bg-[#f59e0b]' : 'bg-[#94a3b8]';
  const text =
    kind === 'green' ? 'text-[#166534]' : kind === 'amber' ? 'text-[#92400e]' : 'text-[#475569]';
  return (
    <div className={`${box} content-stretch flex gap-[8px] items-center px-[14px] py-[8px] relative rounded-[999px] shrink-0`} {...pressable(onClick)}>
      <div className={`${dot} relative rounded-[4px] shrink-0 size-[8px]`} />
      <p className={`[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[18px] not-italic relative shrink-0 ${text} text-[14px] whitespace-nowrap`}>
        {children}
      </p>
    </div>
  );
}

export type StepState = 'done' | 'active' | 'todo';
const STEP_LABELS = ['Setup', 'Build', 'Review', 'Share'];

export function Steps({ states }: { states: [StepState, StepState, StepState, StepState] }) {
  return (
    <div className="content-stretch flex gap-[10px] items-center relative shrink-0" data-name="Steps">
      {states.map((st, i) => (
        <div key={i} className="contents">
          {i > 0 && <div className="bg-[#cbd5e1] h-[2px] relative shrink-0 w-[28px]" />}
          <div className="content-stretch flex gap-[8px] items-center relative shrink-0">
            {st === 'done' && (
              <div className="bg-[#0f766e] content-stretch flex items-center justify-center relative rounded-[13px] shrink-0 size-[26px]">
                <Asset id="3:15" className="relative shrink-0 size-[14px]" />
              </div>
            )}
            {st === 'active' && (
              <div className="border-3 border-[#0f766e] border-solid content-stretch flex items-center justify-center relative rounded-[13px] shrink-0 size-[26px]">
                <p className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[17px] not-italic relative shrink-0 text-[#0f766e] text-[14px] whitespace-nowrap">{i + 1}</p>
              </div>
            )}
            {st === 'todo' && (
              <div className="border-2 border-[#94a3b8] border-solid content-stretch flex items-center justify-center relative rounded-[13px] shrink-0 size-[26px]">
                <p className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[17px] not-italic relative shrink-0 text-[#475569] text-[14px] whitespace-nowrap">{i + 1}</p>
              </div>
            )}
            {st === 'active' ? (
              <p className="[word-break:break-word] font-['Inter:Bold'] font-bold leading-[20px] not-italic relative shrink-0 text-[#0f766e] text-[15px] whitespace-nowrap">{STEP_LABELS[i]}</p>
            ) : (
              <p className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[20px] not-italic relative shrink-0 text-[#475569] text-[15px] whitespace-nowrap">{STEP_LABELS[i]}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TopBar({ steps, children }: { steps?: [StepState, StepState, StepState, StepState]; children: ReactNode }) {
  return (
    <div className="bg-white border-[#e2e8f0] border-b border-solid content-stretch flex h-[68px] items-center justify-between px-[40px] relative shrink-0 w-full" data-name="Top bar">
      <Brand />
      {steps ? <Steps states={steps} /> : <div className="relative shrink-0 size-px" />}
      <div className="content-stretch flex gap-[10px] items-center relative shrink-0" data-name="Status chips">
        {children}
      </div>
    </div>
  );
}

/* ---------- Gesture hint bar ---------- */

export function Hint({ icon, label, active, onClick }: { icon: string; label: string; active?: boolean } & Press) {
  const box = active
    ? 'bg-[#ccfbf1] border-2 border-[#0f766e] border-solid'
    : 'bg-[#f1f5f9]';
  return (
    <div className={`content-stretch flex gap-[10px] items-center pl-[12px] pr-[18px] py-[6px] relative rounded-[12px] shrink-0 ${box}`} {...pressable(onClick)}>
      <Asset id={icon} className="h-[47px] relative shrink-0 w-[36px]" />
      <p className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[21px] not-italic relative shrink-0 text-[#0f172a] text-[16px] whitespace-nowrap">
        {label}
      </p>
    </div>
  );
}

export function HintBar({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white border-[#e2e8f0] border-solid border-t content-stretch flex gap-[16px] h-[84px] items-center justify-center relative shrink-0 w-full" data-name="Gesture hint bar">
      {children}
    </div>
  );
}

/* ---------- Camera view pieces ---------- */

export function CamChip() {
  return (
    <div className="absolute bg-[rgba(11,18,32,0.78)] content-stretch flex gap-[8px] items-center left-[16px] px-[14px] py-[8px] rounded-[999px] top-[16px]" data-name="chip Camera on">
      <div className="bg-[#16a34a] relative rounded-[4px] shrink-0 size-[8px]" />
      <p className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[18px] not-italic relative shrink-0 text-[14px] text-white whitespace-nowrap">Camera on</p>
    </div>
  );
}

/** Label pill shown inside the camera view (position/background passed as literal classes). */
export function CamLabel({ cls, children }: { cls: string; children: ReactNode }) {
  return (
    <div className={`absolute content-stretch flex items-start px-[18px] py-[10px] rounded-[12px] ${cls}`}>
      <p className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[22px] not-italic relative shrink-0 text-[17px] text-white whitespace-nowrap">{children}</p>
    </div>
  );
}

export function CommandZone({ cls, highlightDone }: { cls: string; highlightDone?: boolean }) {
  const item = 'content-stretch flex flex-col gap-[2px] items-center px-[10px] py-[6px] relative rounded-[12px] shrink-0';
  const lbl = "[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[18px] not-italic relative shrink-0 text-[16px] text-white whitespace-nowrap";
  const zones: [string, string, string, boolean?][] = [
    ['Space', '3:256', 'open'],
    ['Delete', '3:288', 'fist'],
    ['Done', '3:320', 'up', true],
    ['Cancel', '3:352', 'down'],
  ];
  return (
    <div className={`absolute border-2 border-dashed border-white content-stretch flex flex-col gap-[6px] h-[520px] items-center left-[16px] py-[14px] rounded-[16px] top-[64px] w-[150px] ${cls}`} data-name="Command zone">
      <p className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[16px] not-italic relative shrink-0 text-[14px] text-white tracking-[0.8px] whitespace-nowrap">COMMAND ZONE</p>
      {zones.map(([label, icon, , isDone]) => (
        <div key={label} className={`${item} ${highlightDone && isDone ? 'bg-[rgba(15,118,110,0.6)]' : ''}`}>
          <Asset id={icon} className="h-[57px] relative shrink-0 w-[44px]" />
          <p className={lbl}>{label}</p>
        </div>
      ))}
    </div>
  );
}

export function SigningArea() {
  return <div className="absolute border-2 border-dashed border-white h-[430px] left-[210px] opacity-45 rounded-[20px] top-[110px] w-[560px]" data-name="Signing area" />;
}

/** The big 800x600 camera panel used on screens 06-10. */
export function CameraPanel({ children }: { children: ReactNode }) {
  return (
    <div className="bg-[#1e293b] content-stretch flex flex-col h-[600px] items-start overflow-clip relative rounded-[20px] shrink-0 w-[800px]" data-name="Camera view">
      <Asset id="3:247" className="absolute h-[600px] left-0 top-0 w-[800px]" />
      <CamChip />
      {children}
    </div>
  );
}

/* ---------- Side cards ---------- */

export function Card({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-[#e2e8f0] border-solid content-stretch flex flex-col gap-[14px] items-start pb-[24px] pt-[22px] px-[24px] relative rounded-[16px] shrink-0 w-full ${className}`}>
      <p className="[word-break:break-word] font-['Inter:Semi_Bold'] font-semibold leading-[17px] not-italic relative shrink-0 text-[#64748b] text-[14px] tracking-[0.8px] whitespace-nowrap">{title}</p>
      {children}
    </div>
  );
}

export function InfoRow({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="content-stretch flex gap-[14px] items-center relative shrink-0 w-full">
      <div className="bg-[#ccfbf1] content-stretch flex items-center justify-center relative rounded-[22px] shrink-0 size-[44px]">
        <Asset id={icon} className="relative shrink-0 size-[24px]" />
      </div>
      <p className="[word-break:break-word] flex-[1_0_0] font-['Inter:Medium'] font-medium leading-[23px] min-w-px not-italic relative text-[#334155] text-[18px]">{children}</p>
    </div>
  );
}

/** Root of every screen: fills the 1440x900 stage. */
export function Screen({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="bg-[#f8fafc] content-stretch flex flex-col items-start relative size-full" data-name={name}>
      {children}
    </div>
  );
}
