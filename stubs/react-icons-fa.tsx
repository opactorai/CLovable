import type { LucideProps } from 'lucide-react';
import type { ComponentType } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Atom,
  Bot,
  Braces,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Code,
  Coffee,
  Database,
  File,
  FileCode,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  Home,
  Lock,
  Monitor,
  Palette,
  Play,
  Plug,
  RefreshCw,
  Rocket,
  RotateCcw,
  Settings,
  Ship,
  Smartphone,
  Square,
  Triangle,
  Workflow,
} from 'lucide-react';

type IconComponent = ComponentType<LucideProps>;

const wrap = (Icon: IconComponent) => (props: LucideProps) => <Icon {...props} />;

export const FaCode = wrap(Code);
export const FaDesktop = wrap(Monitor);
export const FaMobileAlt = wrap(Smartphone);
export const FaPlay = wrap(Play);
export const FaStop = wrap(Square);
export const FaSync = wrap(RefreshCw);
export const FaCog = wrap(Settings);
export const FaRocket = wrap(Rocket);
export const FaFolder = wrap(Folder);
export const FaFolderOpen = wrap(FolderOpen);
export const FaFile = wrap(File);
export const FaFileCode = wrap(FileCode);
export const FaCss3Alt = wrap(Palette);
export const FaHtml5 = wrap(FileCode);
export const FaJs = wrap(Braces);
export const FaReact = wrap(Atom);
export const FaPython = wrap(Workflow);
export const FaDocker = wrap(Ship);
export const FaGitAlt = wrap(GitBranch);
export const FaMarkdown = wrap(FileText);
export const FaDatabase = wrap(Database);
export const FaPhp = wrap(Braces);
export const FaJava = wrap(Coffee);
export const FaRust = wrap(Settings);
export const FaVuejs = wrap(Triangle);
export const FaLock = wrap(Lock);
export const FaHome = wrap(Home);
export const FaChevronUp = wrap(ChevronUp);
export const FaChevronRight = wrap(ChevronRight);
export const FaChevronDown = wrap(ChevronDown);
export const FaArrowLeft = wrap(ArrowLeft);
export const FaArrowRight = wrap(ArrowRight);
export const FaRedo = wrap(RotateCcw);
export const FaRobot = wrap(Bot);
export const FaPlug = wrap(Plug);
