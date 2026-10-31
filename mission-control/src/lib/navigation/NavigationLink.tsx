"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useNavigationRouter } from "./NavigationProvider";

type Props = Omit<ComponentProps<typeof Link>, "href" | "onNavigate"> & { href: string };

/** Keep Next prefetch/modifier behavior while sharing the pending transition with live subscribers. */
export function NavigationLink({ href, replace, scroll, ...props }: Props): React.JSX.Element {
  const router = useNavigationRouter();
  return (
    <Link
      {...props}
      href={href}
      replace={replace}
      scroll={scroll}
      onNavigate={(event) => {
        event.preventDefault();
        if (replace) router.replace(href, { scroll });
        else router.push(href, { scroll });
      }}
    />
  );
}
