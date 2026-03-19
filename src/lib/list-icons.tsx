import { createElement } from "react";
import {
  Briefcase,
  Clock,
  Home,
  Lightbulb,
  List,
  Monitor,
  ShoppingBag,
  Smartphone,
  Star,
  Heart,
  Bookmark,
  Flag,
  Folder,
  Music,
  Camera,
  Globe,
  Coffee,
  Book,
  Wrench,
  Dumbbell,
  Utensils,
  Car,
  Plane,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";

export const LIST_ICONS: Record<string, LucideIcon> = {
  list: List,
  home: Home,
  briefcase: Briefcase,
  monitor: Monitor,
  smartphone: Smartphone,
  "shopping-bag": ShoppingBag,
  clock: Clock,
  lightbulb: Lightbulb,
  star: Star,
  heart: Heart,
  bookmark: Bookmark,
  flag: Flag,
  folder: Folder,
  music: Music,
  camera: Camera,
  globe: Globe,
  coffee: Coffee,
  book: Book,
  wrench: Wrench,
  dumbbell: Dumbbell,
  utensils: Utensils,
  car: Car,
  plane: Plane,
  "graduation-cap": GraduationCap,
};

export function getListIcon(iconName: string | null): LucideIcon {
  if (iconName && LIST_ICONS[iconName]) {
    return LIST_ICONS[iconName];
  }
  return List;
}

export function ListIcon({ icon, className }: { icon: string | null; className?: string }) {
  return createElement(getListIcon(icon), { className });
}
