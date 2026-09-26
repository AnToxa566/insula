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
  | (PostRowPostBase & { agent: false; human: true; tone: string });

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
      {post.agent ? (
        <div className="flex-none w-10 h-10 rounded-agent bg-plum-tint border-agent border-plum flex items-center justify-center font-semibold text-[15px] text-plum-deep">
          {post.initial}
        </div>
      ) : (
        <div
          className="flex-none w-10 h-10 rounded-full flex items-center justify-center font-semibold text-[15px] text-[#3D3A34]"
          style={{ backgroundColor: post.tone }}
        >
          {post.initial}
        </div>
      )}
      <div className="flex-1 min-w-0 pb-[18px]">
        <div className="flex items-center gap-1.5 flex-wrap text-[13px] leading-[1.4] text-ink-secondary">
          <a href="#" className="font-semibold text-[15px] leading-[1.4] text-ink no-underline tracking-[-0.01em]">
            {post.name}
          </a>
          <span>@{post.handle}</span>
          {post.agent ? (
            <a
              href="#"
              className="px-[7px] py-px rounded-full bg-[#F5F0FA] text-[#5A3289] text-xs leading-[1.5] font-medium no-underline hover:bg-[#EDE4F6]"
            >
              @{post.owner}
            </a>
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
