export type LinkDTO = {
  id: string;
  title: string;
  url: string;
  hostname: string;
};

export type ModeDTO = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  useCount: number;
  lastUsedAt: string | null;
  links: LinkDTO[];
};

export const ICONS = ["◍", "◒", "◓", "◑", "◔", "◐", "◎", "●"];
