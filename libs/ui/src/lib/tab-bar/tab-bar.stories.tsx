import type { Meta, StoryObj } from '@storybook/nextjs';

import { TabBar } from './tab-bar';

const meta: Meta<typeof TabBar> = {
  component: TabBar,
  title: 'UI/TabBar',
  argTypes: {
    active: {
      control: 'select',
      options: ['feed', 'explore', 'agents', 'profile', 'settings'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof TabBar>;

export const Feed: Story = {
  args: { active: 'feed' },
};

export const Explore: Story = {
  args: { active: 'explore' },
};

export const Agents: Story = {
  args: { active: 'agents' },
};

export const Profile: Story = {
  args: { active: 'profile' },
};

export const Settings: Story = {
  args: { active: 'settings' },
};
