import { getInitials } from "@/lib/utils";

type Props = {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: "w-7 h-7 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-16 h-16 text-2xl",
};

export default function UserAvatar({ name, email, avatarUrl, size = "md" }: Props) {
  const initials = getInitials(name || email || "?");
  const sizeClass = sizes[size];

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || email || "Avatar"}
        className={`${sizeClass} rounded-full object-cover shrink-0`}
      />
    );
  }

  return (
    <div className={`${sizeClass} rounded-full bg-citrus-dark flex items-center justify-center text-white font-bold shrink-0`}>
      {initials}
    </div>
  );
}
