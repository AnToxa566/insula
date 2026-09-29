import type { Meta, StoryObj } from '@storybook/nextjs';

import { DropdownMenu, type DropdownMenuEntry } from './dropdown-menu';

const meta: Meta<typeof DropdownMenu> = {
  component: DropdownMenu,
  title: 'UI/DropdownMenu',
  argTypes: {
    placement: { control: 'select', options: ['auto', 'up', 'down'] },
    align: { control: 'select', options: ['start', 'end'] },
  },
};

export default meta;
type Story = StoryObj<typeof DropdownMenu>;

// Icons are Remix Icons (the closest match to the design's inline SVGs, which
// are placeholders): Edit → pencil, Pause → pause, Delete → delete-bin.
const agentItems: DropdownMenuEntry[] = [
  { type: 'item', id: 'edit', label: 'Edit agent', icon: 'pencil', onSelect: () => undefined },
  { type: 'item', id: 'pause', label: 'Pause', icon: 'pause', onSelect: () => undefined },
  { type: 'divider' },
  { type: 'item', id: 'delete', label: 'Delete agent', icon: 'delete-bin', danger: true, onSelect: () => undefined },
];

const overflowTrigger = 'flex h-8 w-8 items-center justify-center rounded-lg bg-surface-subtle text-ink hover:bg-surface-canvas';

// Overflow menu on an agent card / detail: right-aligned to the icon button.
export const OpensDown: Story = {
  args: {
    label: 'Agent actions',
    placement: 'down',
    align: 'end',
    items: agentItems,
    triggerClassName: overflowTrigger,
    trigger: () => <i className="ri-more-fill text-[18px] leading-none" aria-hidden="true" />,
  },
  decorators: [
    (Story) => (
      <div className="flex h-[260px] w-[320px] justify-end bg-surface-canvas p-3">
        <Story />
      </div>
    ),
  ],
};

// Account-style menu: the trigger sits at the bottom, so the menu opens up at full trigger width.
export const OpensUp: Story = {
  args: {
    label: 'Account menu',
    placement: 'up',
    className: 'w-full',
    items: [{ type: 'item', id: 'logout', label: 'Log out', icon: 'logout-box', onSelect: () => undefined }],
    triggerClassName:
      'flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left hover:bg-[#EDEBE7] dark:hover:bg-[#252422]',
    trigger: () => (
      <>
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-avatar text-xs font-semibold text-[#3F3D4A] dark:text-[#D6D4DE]">
          A
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium leading-[1.3] text-ink">Anton Reyes</span>
          <span className="block truncate text-xs leading-[1.4] text-ink-secondary">@anton</span>
        </span>
        <i className="ri-expand-up-down-line text-base leading-none text-[#A8A49C]" aria-hidden="true" />
      </>
    ),
  },
  decorators: [
    (Story) => (
      <div className="flex h-[260px] w-[200px] flex-col justify-end bg-surface-canvas p-3">
        <Story />
      </div>
    ),
  ],
};

export const DisabledItem: Story = {
  args: {
    ...OpensDown.args,
    items: [
      { type: 'item', id: 'edit', label: 'Edit agent', icon: 'pencil', onSelect: () => undefined },
      { type: 'item', id: 'pause', label: 'Pause', icon: 'pause', disabled: true, onSelect: () => undefined },
      { type: 'divider' },
      { type: 'item', id: 'delete', label: 'Delete agent', icon: 'delete-bin', danger: true, onSelect: () => undefined },
    ],
  },
  decorators: OpensDown.decorators,
};

// Static, always-open rendering of every item state for visual comparison with the design sheet.
export const ItemStates: Story = {
  render: () => (
    <div className="flex w-56 flex-col rounded-xl bg-surface p-1 shadow-[0_0_0_1px_rgba(26,25,23,.08),0_8px_24px_rgba(26,25,23,.10)] dark:shadow-[0_0_0_1px_rgba(255,255,255,.08),0_8px_24px_rgba(0,0,0,.45)]">
      {[
        ['Default', 'text-ink'],
        ['Hover', 'bg-surface-canvas text-ink dark:bg-surface-subtle'],
        ['Focus', 'text-ink shadow-[inset_0_0_0_1px_var(--color-plum)]'],
        ['Danger', 'text-danger'],
        ['Danger hover', 'bg-[#F8E9E6] text-danger dark:bg-surface-subtle'],
        ['Disabled', 'text-ink-muted'],
      ].map(([label, classes]) => (
        <div key={label} className={`flex h-9 items-center rounded-lg px-2.5 text-sm font-medium leading-[1.4] ${classes}`}>
          {label}
        </div>
      ))}
    </div>
  ),
};
