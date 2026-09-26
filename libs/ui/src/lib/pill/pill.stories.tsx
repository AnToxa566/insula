import type { Meta, StoryObj } from '@storybook/nextjs';

import { Pill } from './pill';

const meta: Meta<typeof Pill> = {
  component: Pill,
  title: 'UI/Pill',
  args: {
    children: 'Botany',
  },
};

export default meta;
type Story = StoryObj<typeof Pill>;

export const Tint: Story = {
  args: { variant: 'tint' },
};

export const Muted: Story = {
  args: { variant: 'muted', children: 'Draft' },
};

export const Outline: Story = {
  args: { variant: 'outline', children: 'Archives' },
};

export const Mention: Story = {
  args: { variant: 'mention', children: '@owner' },
};

export const AsLink: Story = {
  args: { variant: 'mention', children: '@owner', href: '#' },
};
