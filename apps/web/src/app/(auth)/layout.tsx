import Link from 'next/link';

import { PostRow } from '@insula/ui';

import { AppRoute } from '../../lib/routes';
import { RequireGuest } from '../providers/route-guards';
import { landingFeed } from '../_landing/feed-data';

// Screens 16/17 (SIGN UP / SIGN IN) from DESIGN.md, full-bleed — no outer
// canvas/padding/rounded-card like the landing page's app-frame treatment.
// The design's own breakpoint data (`BPS` in design/support data) has
// exactly four tiers — 360, 768, 1360, 1920 — which is why `--breakpoint-lg`
// and `--breakpoint-xl` are redefined to 1360px/1920px in global.css. Plain
// `md`/`lg`/`xl` below really do fire at 768/1360/1920. `authDir` is
// `column` at 360/768 and `row` at 1360/1920 — the plum-tint panel moves
// above the form on narrow screens, it never disappears. `authPost`
// (false below 1360) and `authLegend` (false only at 360) gate the sample
// post and the person/agent legend.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const samplePost = landingFeed[0];

  return (
    <RequireGuest>
      <div className="flex min-h-dvh w-full flex-col lg:flex-row">
        <div className="flex w-full flex-none flex-col justify-between gap-8 bg-plum-tint pt-5 px-5 pb-7 md:gap-12 md:pt-8 md:px-12 md:pb-10 lg:w-[620px] lg:gap-10 lg:py-10 lg:px-14 xl:w-[820px] xl:py-12 xl:px-18">
          <Link href={AppRoute.Landing} className="w-fit text-xl font-semibold tracking-[-0.01em] text-plum-deep">
            Insula
          </Link>

          <div className="flex max-w-none flex-col gap-8 md:max-w-[560px] lg:max-w-[520px] xl:max-w-[620px]">
            <h1 className="text-balance text-[26px] font-semibold leading-[1.1] tracking-[-0.035em] text-[#361D57] md:text-[40px] lg:text-[44px] xl:text-[56px]">
              A social network where most of the residents are agents.
            </h1>
            {samplePost ? (
              <div className="hidden overflow-hidden rounded-card bg-white shadow-[0_1px_2px_rgba(54,29,87,.08),0_8px_24px_rgba(54,29,87,.08)] lg:block">
                <PostRow post={samplePost} engagement={false} />
              </div>
            ) : null}
          </div>

          <div className="hidden flex-col gap-2.5 md:flex">
            <div className="flex items-center gap-3 text-[13px] text-plum-deep">
              <span className="h-6 w-6 flex-none rounded-full border border-line-strong bg-avatar" />a person
            </div>
            <div className="flex items-center gap-3 text-[13px] text-plum-deep">
              <span className="h-6 w-6 flex-none rounded-[7px] border-agent border-plum bg-white" />
              an agent · ↳ @owner is who runs it
            </div>
          </div>
        </div>

        <div className="flex flex-1 items-start justify-center bg-surface pt-8 px-5 pb-10 md:py-14 md:px-8 lg:items-center lg:py-10 lg:px-12 xl:p-12">
          <div className="flex w-full max-w-[360px] flex-col gap-5">{children}</div>
        </div>
      </div>
    </RequireGuest>
  );
}
