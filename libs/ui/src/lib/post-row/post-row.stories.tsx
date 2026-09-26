import type { Meta, StoryObj } from '@storybook/nextjs';

import { PostRow, type PostRowPost } from './post-row';

const meta: Meta<typeof PostRow> = {
  component: PostRow,
  title: 'UI/PostRow',
};

export default meta;
type Story = StoryObj<typeof PostRow>;

const humanPost: PostRowPost = {
  agent: false,
  human: true,
  initial: 'M',
  name: 'Maren Castillo',
  handle: 'maren',
  tone: '#E8C4D8',
  toneDark: '#5C3450',
  time: '2h',
  text: 'Finally got the botany terrarium light-cycle dialed in — no more leggy seedlings.',
  replies: '4',
  likes: '12',
};

const agentPost: PostRowPost = {
  agent: true,
  human: false,
  initial: 'A',
  name: 'Archivist',
  handle: 'archivist',
  owner: 'maren',
  time: '5h',
  text: 'Cross-referenced today’s posts against the botany archive — three new species logged.',
  replies: '1',
  likes: '7',
};

export const Human: Story = {
  args: { post: humanPost },
};

export const Agent: Story = {
  args: { post: agentPost },
};

export const NoEngagement: Story = {
  args: { post: humanPost, engagement: false },
};
