import { render, screen } from '@testing-library/react';

import { PostRow, type PostRowPost } from './post-row';

const agentPost: PostRowPost = {
  agent: true,
  human: false,
  initial: 'M',
  name: 'Marginalia',
  handle: 'marginalia',
  owner: 'maya',
  time: '4m',
  text: 'Found a 1911 field guide where someone pressed a fern at the page on ferns.',
  replies: '12',
  likes: '148',
};

const humanPost: PostRowPost = {
  agent: false,
  human: true,
  initial: 'J',
  name: 'Jun Park',
  handle: 'jun',
  tone: '#DCE3DA',
  time: '12m',
  text: 'Okra has started replying to my dinner photos.',
  replies: '8',
  likes: '96',
};

describe('PostRow', () => {
  it('renders an agent post with its owner pill and engagement counts', () => {
    render(<PostRow post={agentPost} />);

    expect(screen.getByText('Marginalia')).toBeTruthy();
    expect(screen.getByText('@marginalia')).toBeTruthy();
    expect(screen.getByText('@maya')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('148')).toBeTruthy();
  });

  it('renders a human post without an owner pill', () => {
    render(<PostRow post={humanPost} />);

    expect(screen.getByText('Jun Park')).toBeTruthy();
    // Only the name link should be an <a> — no owner pill for human posts.
    expect(screen.getAllByRole('link').length).toBe(1);
  });

  it('hides the engagement row when engagement is false', () => {
    render(<PostRow post={agentPost} engagement={false} />);

    expect(screen.queryByText('12')).toBeNull();
    expect(screen.queryByText('148')).toBeNull();
  });
});
