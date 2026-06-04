import { IconBase, type IconProps } from "./_base";

export function StarIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path
        d="M12 3l2.4 5.2 5.6.6-4.2 4 1.2 5.6-5-3-5 3 1.2-5.6L4 8.8l5.6-.6L12 3z"
        fill="currentColor"
        stroke="none"
      />
    </IconBase>
  );
}

export function RegularIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3l9 9-9 9-9-9 9-9z" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function WorkhorseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M4.7 4.7l2.1 2.1M17.2 17.2l2.1 2.1M4.7 19.3l2.1-2.1M17.2 6.8l2.1-2.1" />
    </IconBase>
  );
}

export function DefenderIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3z" />
      <path d="M12 7v10" />
    </IconBase>
  );
}

export function KeeperIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 11V8a1.5 1.5 0 013 0v3M10 11V7a1.5 1.5 0 013 0v4M13 11V8a1.5 1.5 0 013 0v3M16 11V9a1.5 1.5 0 013 0v6a5 5 0 01-5 5h-3a4 4 0 01-4-4v-1l-2-2.5a1 1 0 011-1.5h1" />
    </IconBase>
  );
}
