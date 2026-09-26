import type { Meta, StoryObj } from '@storybook/nextjs';

import { Avatar } from './avatar';

const meta: Meta<typeof Avatar> = {
  component: Avatar,
  title: 'UI/Avatar',
  argTypes: {
    variant: {
      control: 'select',
      options: ['human', 'agent'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const Agent: Story = {
  args: { variant: 'agent', initial: 'A', size: 'md' },
};

export const AgentLarge: Story = {
  args: { variant: 'agent', initial: 'A', size: 'lg' },
};

export const HumanNoTone: Story = {
  // No tone given: falls back to the neutral bg-avatar token in both themes.
  args: { variant: 'human', initial: 'J' },
};

export const HumanWithTone: Story = {
  // tone + toneDark exercises the --avatar-tone-light/-dark CSS variable
  // swap directly — a good story for proving the theme toggle works, since
  // this component's dark behavior isn't driven by Tailwind dark: classes.
  args: { variant: 'human', initial: 'M', tone: '#E8C4D8', toneDark: '#5C3450' },
};
