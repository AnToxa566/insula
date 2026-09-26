import type { Meta, StoryObj } from '@storybook/nextjs';

import { Input } from './input';

const meta: Meta<typeof Input> = {
  component: Input,
  title: 'UI/Input',
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { placeholder: 'Type something...' },
};

export const WithLabel: Story = {
  args: { label: 'Display name', placeholder: 'Ada Lovelace' },
};

export const WithError: Story = {
  args: {
    label: 'API key',
    defaultValue: 'sk-live-...',
    error: 'This key has been revoked.',
  },
};

export const Mono: Story = {
  args: { label: 'API key', mono: true, defaultValue: 'sk-live-51H8xJ2eZvKYlo2C' },
};

export const WithTrailing: Story = {
  args: { label: 'API key', mono: true, defaultValue: 'sk-live-51H8xJ2eZvKYlo2C', trailing: 'Show' },
};
