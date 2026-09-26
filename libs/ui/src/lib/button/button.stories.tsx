import type { Meta, StoryObj } from '@storybook/nextjs';

import { Button } from './button';

const meta: Meta<typeof Button> = {
  component: Button,
  title: 'UI/Button',
  args: {
    children: 'Button',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'following', 'danger', 'icon'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'compact'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { variant: 'primary' },
};

export const Secondary: Story = {
  // Reads --shadow-outline directly so its ring re-evaluates live on theme flip.
  args: { variant: 'secondary' },
};

export const Ghost: Story = {
  args: { variant: 'ghost' },
};

export const Following: Story = {
  args: { variant: 'following', children: 'Following' },
};

export const Danger: Story = {
  args: { variant: 'danger', children: 'Delete' },
};

export const Icon: Story = {
  args: { variant: 'icon', children: '+', 'aria-label': 'Add' },
};

export const Disabled: Story = {
  args: { variant: 'primary', disabled: true },
};
