import { IconBase, type IconProps } from "./_base";

export function GoalIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7l3.5 2.5-1.3 4.2h-4.4L8.5 9.5 12 7z" />
      <path d="M12 3v4M3.5 9l4 .5M20.5 9l-4 .5M6.5 18l3-3.5M17.5 18l-3-3.5" />
    </IconBase>
  );
}

export function AssistIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="18" cy="12" r="3.5" />
      <circle cx="18" cy="12" r="1" fill="currentColor" stroke="none" />
      <path d="M3 18c2-7 7-10 11-9" />
      <path d="M11.5 4.5L14.5 7.5M11.5 10.5L14.5 7.5" />
    </IconBase>
  );
}

export function TackleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 5l6 6M5 19l6-6M19 5l-6 6M19 19l-6-6" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function PassIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="5" cy="12" r="2" fill="currentColor" stroke="none" />
      <path d="M7 12h13M16 8l4 4-4 4" />
    </IconBase>
  );
}

export function SaveIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 11V7a1 1 0 012 0v4M10 11V5a1 1 0 012 0v6M13 11V6a1 1 0 012 0v5M16 11V8a1 1 0 012 0v7a5 5 0 01-5 5h-4a3 3 0 01-3-3v-1l-2-3a1 1 0 011-1.5h2" />
    </IconBase>
  );
}

export function CleanSheetIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path
        d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3z"
        fill="currentColor"
        stroke="none"
      />
    </IconBase>
  );
}

export function ShotOnTargetIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </IconBase>
  );
}
