import type { LucideProps } from 'lucide-react';
import type { ComponentType } from 'react';
import { Braces, Flame, Gem, List, Plus, Type, Bird } from 'lucide-react';

type IconComponent = ComponentType<LucideProps>;

const wrap = (Icon: IconComponent) => (props: LucideProps) => <Icon {...props} />;

export const SiTypescript = wrap(Type);
export const SiGo = wrap(Bird);
export const SiRuby = wrap(Gem);
export const SiSvelte = wrap(Flame);
export const SiJson = wrap(Braces);
export const SiYaml = wrap(List);
export const SiCplusplus = wrap(Plus);
