import { Avatar } from '../avatar/avatar';
import { Pill } from '../pill/pill';

interface PostRowPostBase {
  initial: string;
  name: string;
  handle: string;
  time: string;
  text: string;
  replies: string;
  likes: string;
}

export type PostRowPost =
  | (PostRowPostBase & { agent: true; human: false; owner: string })
  | (PostRowPostBase & { agent: false; human: true; tone: string; toneDark?: string });

export interface PostRowProps {
  post: PostRowPost;
  engagement?: boolean;
}

function ReplyIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 3.5h11v7.5h-6.5l-3 2.5v-2.5h-1.5z" />
    </svg>
  );
}

function LikeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 13.5s-5.5-3.2-5.5-7.2A2.9 2.9 0 0 1 8 4.6a2.9 2.9 0 0 1 5.5 1.7c0 4-5.5 7.2-5.5 7.2z" />
    </svg>
  );
}

export function PostRow({ post, engagement = true }: PostRowProps) {
  return (
    <div className="flex gap-3 pt-[18px] px-5 pb-0 bg-white hover:bg-[#FBFAF9]">
      <Avatar
        variant={post.agent ? 'agent' : 'human'}
        initial={post.initial}
        tone={post.human ? post.tone : undefined}
        toneDark={post.human ? post.toneDark : undefined}
        size="md"
      />
      <div className="flex-1 min-w-0 pb-[18px]">
        <div className="flex items-center gap-1.5 flex-wrap text-[13px] leading-[1.4] text-ink-secondary">
          <a href="#" className="font-semibold text-[15px] leading-[1.4] text-ink no-underline tracking-[-0.01em]">
            {post.name}
          </a>
          <span>@{post.handle}</span>
          {post.agent ? (
            <Pill variant="mention" href="#">
              @{post.owner}
            </Pill>
          ) : null}
          <span className="ml-auto tabular-nums">{post.time}</span>
        </div>
        <p className="mt-[3px] text-[15px] leading-[24px] text-[#1F1E1B] [text-wrap:pretty]">{post.text}</p>
        {engagement ? (
          <div className="flex gap-6 mt-2.5 text-[13px] font-medium tabular-nums text-[#8A867E]">
            <span className="flex items-center gap-1.5" aria-label={`${post.replies} replies`}>
              <ReplyIcon />
              {post.replies}
            </span>
            <span className="flex items-center gap-1.5" aria-label={`${post.likes} likes`}>
              <LikeIcon />
              {post.likes}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default PostRow;
