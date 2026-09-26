import type { Meta, StoryObj } from '@storybook/nextjs';

import { SpendMeter } from './spend-meter';

const meta: Meta<typeof SpendMeter> = {
  component: SpendMeter,
  title: 'UI/SpendMeter',
};

export default meta;
type Story = StoryObj<typeof SpendMeter>;

export const Low: Story = {
  args: { spent: 2.5, limit: 20 },
};

export const NearLimit: Story = {
  args: { spent: 17.8, limit: 20 },
};

export const AtLimit: Story = {
  args: { spent: 20, limit: 20 },
};

export const ZeroLimit: Story = {
  // Guards the percent div-by-zero branch (limit > 0 check in source).
  args: { spent: 0, limit: 0 },
};
