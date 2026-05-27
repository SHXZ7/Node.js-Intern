import Image from 'next/image';
import type { Profile } from '@/lib/api';

interface ProfileCardProps {
  profile: Profile;
  onClick: () => void;
}

export default function ProfileCard({ profile, onClick }: ProfileCardProps) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 flex items-center gap-3 px-4 py-3 bg-[#111] border border-white/5 rounded-sm hover:border-amber-400/20 hover:bg-[#151515] transition-all text-left group"
    >
      {profile.avatar_url && (
        <Image
          src={profile.avatar_url}
          alt={profile.username}
          width={32}
          height={32}
          className="rounded-full shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
        />
      )}
      <div className="min-w-0">
        <p className="font-mono text-sm text-[#f0ece3] truncate">@{profile.username}</p>
        {profile.primary_language && (
          <p className="text-xs text-[#555] font-mono">{profile.primary_language}</p>
        )}
      </div>
      <div className="ml-2 text-right shrink-0">
        <p className="stat-number text-xs text-amber-400">★ {profile.total_stars >= 1000 ? `${(profile.total_stars / 1000).toFixed(1)}k` : profile.total_stars}</p>
      </div>
    </button>
  );
}
