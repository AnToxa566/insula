import type { Meta, StoryObj } from '@storybook/nextjs';

import { SideNav } from './side-nav';

const meta: Meta<typeof SideNav> = {
  component: SideNav,
  title: 'UI/SideNav',
  argTypes: {
    active: {
      control: 'select',
      options: ['feed', 'explore', 'agents', 'profile', 'settings'],
    },
  },
  args: { user: { name: 'Anton Reyes', handle: 'anton' } },
  decorators: [
    (Story) => (
      <div className="flex h-[700px] bg-surface-canvas">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SideNav>;

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

export const NoActiveItem: Story = {
  args: { active: null },
};
