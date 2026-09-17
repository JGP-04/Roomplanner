import { ArrowUpRight } from "lucide-react";
import type { SocialChannel as SocialChannelData } from "@/content/site";

interface SocialChannelProps {
  readonly channel: SocialChannelData;
}

function ChannelContent({ channel }: SocialChannelProps) {
  const Icon = channel.icon;

  return (
    <>
      <span className="social-icon" aria-hidden="true">
        <Icon size={22} strokeWidth={1.7} />
      </span>
      <span className="social-copy">
        <strong>{channel.name}</strong>
        <small>{channel.handle}</small>
      </span>
      {channel.href ? (
        <ArrowUpRight aria-hidden="true" size={22} />
      ) : (
        <span className="coming-soon">Próximamente</span>
      )}
    </>
  );
}

export function SocialChannel({ channel }: SocialChannelProps) {
  if (channel.href) {
    return (
      <a
        className="social-channel"
        href={channel.href}
        target="_blank"
        rel="noopener noreferrer"
      >
        <ChannelContent channel={channel} />
      </a>
    );
  }

  return (
    <div className="social-channel is-disabled" aria-disabled="true">
      <ChannelContent channel={channel} />
    </div>
  );
}
