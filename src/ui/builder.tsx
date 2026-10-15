import type { ReactNode } from 'react';
import { useNav } from '../nav';
import { useSession } from '../session';
import { Chip, Hint, HintBar, Screen, TopBar, CameraPanel, type ChipKind } from './parts';

/** Shared frame of screens 06-08: top bar, camera + right column, hint bar. */
export function BuilderFrame(props: {
  name: string;
  chipKind: ChipKind;
  chipText: string;
  extraChip?: string;
  cam: ReactNode;
  side: ReactNode;
  hints: [string, string, (() => void)?, boolean?][];
}) {
  const nav = useNav();
  const { place } = useSession();
  return (
    <Screen name={props.name}>
      <TopBar steps={['done', 'active', 'todo', 'todo']}>
        <Chip kind="gray">Context: {place}</Chip>
        {props.extraChip && <Chip kind="gray">{props.extraChip}</Chip>}
        <Chip kind={props.chipKind}>{props.chipText}</Chip>
        <Chip kind="gray" onClick={nav.help}>Both hands up: Help</Chip>
      </TopBar>
      <div className="content-stretch flex flex-[1_0_0] gap-[36px] items-center min-h-px px-[48px] py-[28px] relative w-full" data-name="Body">
        <CameraPanel>{props.cam}</CameraPanel>
        <div className="content-stretch flex flex-[1_0_0] flex-col gap-[20px] h-[600px] items-start min-w-px relative">{props.side}</div>
      </div>
      <HintBar>
        {props.hints.map(([icon, label, onClick, active]) => (
          <Hint key={label} icon={icon} label={label} active={active} onClick={onClick} />
        ))}
      </HintBar>
    </Screen>
  );
}
